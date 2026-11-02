// NetworkManager access for the Network tile: reads the wired devices and Wi-Fi, and acts on
// them. Shapes follow network.js (Cable, Wifi). Only reads and activates what the shell's own
// network indicator shows; nothing here patches the shell.
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';

import {cableNames, profilesFor} from './network.js';

let NM = null;

// 802.11 access point flag: the network needs a key.
const AP_PRIVACY = 0x1;

const formatSpeed = mbps => {
    if (!mbps)
        return '';
    return mbps >= 1000 ? `${mbps / 1000} Gb/s` : `${mbps} Mb/s`;
};

// Some adapters (USB Ethernet) leave NetworkManager's speed at 0; the kernel still knows it.
// The file reads -1 when the link is down.
const kernelSpeed = iface => {
    try {
        const [, bytes] = GLib.file_get_contents(`/sys/class/net/${iface}/speed`);
        return Math.max(0, parseInt(new TextDecoder().decode(bytes), 10) || 0);
    } catch (e) {
        return 0;
    }
};

const ssidOf = ap => {
    const bytes = ap?.get_ssid()?.get_data();
    return bytes ? NM.utils_ssid_to_utf8(bytes) : null;
};

const warn = e => console.warn(`panel-tidy: network: ${e.message}`);

export class NetworkSource {
    /**
     * Connects to NetworkManager the way the shell does.
     *
     * @returns {Promise<?NetworkSource>} null when libnm cannot be loaded or NetworkManager
     *     is not running
     */
    static async create() {
        try {
            ({default: NM} = await import('gi://NM'));
            Gio._promisify(NM.Client, 'new_async');
            Gio._promisify(NM.Client.prototype, 'activate_connection_async');
            Gio._promisify(NM.Device.prototype, 'disconnect_async');
            const client = await NM.Client.new_async(null);
            return client.nm_running ? new NetworkSource(client) : null;
        } catch (e) {
            warn(e);
            return null;
        }
    }

    constructor(client) {
        this._client = client;
        this._callbacks = new Map();
        this._nextId = 1;
        this._hooks = new Map(); // device -> signal ids
        this._clientIds = [
            client.connect('device-added', (c, dev) => {
                this._hook(dev);
                this._changed();
            }),
            client.connect('device-removed', (c, dev) => {
                this._unhook(dev);
                this._changed();
            }),
            ...['connection-added', 'connection-removed', 'notify::wireless-enabled',
                'notify::nm-running'].map(s => client.connect(s, () => this._changed())),
        ];
        client.get_devices().forEach(dev => this._hook(dev));
    }

    destroy() {
        if (this._idleId)
            GLib.source_remove(this._idleId);
        this._idleId = 0;
        this._clientIds.forEach(id => GObject.signal_handler_disconnect(this._client, id));
        for (const dev of [...this._hooks.keys()])
            this._unhook(dev);
        this._callbacks.clear();
        this._client = null;
    }

    /**
     * @param {function(): void} callback - called when anything the tile shows may have changed
     * @returns {number} id for disconnect()
     */
    connect(callback) {
        const id = this._nextId++;
        this._callbacks.set(id, callback);
        return id;
    }

    disconnect(id) {
        this._callbacks.delete(id);
    }

    _hook(dev) {
        const type = dev.get_device_type();
        if (type !== NM.DeviceType.ETHERNET && type !== NM.DeviceType.WIFI)
            return;
        const signals = ['notify::state', 'notify::active-connection'];
        if (type === NM.DeviceType.ETHERNET)
            signals.push('notify::carrier', 'notify::speed');
        else
            signals.push('notify::active-access-point', 'access-point-added',
                'access-point-removed');
        this._hooks.set(dev, signals.map(s => dev.connect(s, () => this._changed())));
    }

    // NM.Device has its own disconnect(), which would take the device offline, so the signal
    // handler goes through GObject.
    _unhook(dev) {
        this._hooks.get(dev)?.forEach(id => GObject.signal_handler_disconnect(dev, id));
        this._hooks.delete(dev);
    }

    // A burst of signals (a device going up) becomes one callback round.
    _changed() {
        if (this._idleId)
            return;
        this._idleId = GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
            this._idleId = 0;
            this._callbacks.forEach(cb => cb());
            return GLib.SOURCE_REMOVE;
        });
    }

    _devices(type) {
        return this._client.get_devices().filter(d => d.get_device_type() === type);
    }

    _wiredProfiles() {
        return this._client.get_connections()
            .filter(c => c.get_connection_type() === '802-3-ethernet')
            .map(c => ({
                id: c.get_uuid(),
                name: c.get_id(),
                iface: c.get_interface_name() ?? null,
                mac: c.get_setting_wired()?.get_mac_address()?.toUpperCase() ?? null,
            }));
    }

    /**
     * @returns {{cables: object[], wifi: object}} every ethernet device (`present` says whether
     *     a cable is plugged in) and the Wi-Fi device
     */
    snapshot() {
        const devices = this._devices(NM.DeviceType.ETHERNET);
        const names = cableNames(devices.map(dev => dev.get_udi() ?? ''));
        const profiles = this._wiredProfiles();
        const cables = devices.map((dev, i) => {
            const state = dev.get_state();
            return {
                device: dev.get_iface(),
                name: names[i],
                speed: formatSpeed(dev.get_speed() || kernelSpeed(dev.get_iface())),
                present: state > NM.DeviceState.UNAVAILABLE,
                connected: state === NM.DeviceState.ACTIVATED,
                profiles: profilesFor(profiles, {
                    iface: dev.get_iface(),
                    mac: dev.get_hw_address()?.toUpperCase() ?? null,
                }),
                active: dev.get_active_connection()?.get_uuid() ?? null,
            };
        });

        const [wifiDev] = this._devices(NM.DeviceType.WIFI);
        const connected = wifiDev?.get_state() === NM.DeviceState.ACTIVATED;
        const ssid = connected
            ? ssidOf(wifiDev.get_active_access_point()) ??
                wifiDev.get_active_connection()?.get_id() ?? null
            : null;
        return {
            cables,
            wifi: {
                present: wifiDev !== undefined,
                enabled: this._client.wireless_enabled,
                connected,
                ssid,
            },
        };
    }

    _activate(connection, device) {
        this._client.activate_connection_async(connection, device, null, null).catch(warn);
    }

    /**
     * Connects a cable with its first usable profile, or disconnects it.
     *
     * @param {string} device - interface name
     * @param {boolean} on
     */
    setCable(device, on) {
        const dev = this._devices(NM.DeviceType.ETHERNET).find(d => d.get_iface() === device);
        if (!dev)
            return;
        if (!on) {
            dev.disconnect_async(null).catch(warn);
            return;
        }
        const [profile] = this.snapshot().cables.find(c => c.device === device).profiles;
        const connection = profile && this._client.get_connection_by_uuid(profile.id);
        if (connection)
            this._activate(connection, dev);
    }

    activateProfile(device, profileId) {
        const dev = this._devices(NM.DeviceType.ETHERNET).find(d => d.get_iface() === device);
        const connection = this._client.get_connection_by_uuid(profileId);
        if (dev && connection)
            this._activate(connection, dev);
    }

    /** Turns the Wi-Fi radio on or off. */
    setWifi(on) {
        this._client.wireless_set_enabled(on);
    }

    /**
     * Visible networks, one per SSID (the strongest), the connected one first. A network's id
     * is its SSID.
     *
     * @returns {{id: string, name: string, strength: number, secured: boolean,
     *     active: boolean}[]}
     */
    wifiNetworks() {
        const [dev] = this._devices(NM.DeviceType.WIFI);
        if (!dev)
            return [];
        const activeSsid = ssidOf(dev.get_active_access_point());
        const best = new Map();
        for (const ap of dev.get_access_points()) {
            const ssid = ssidOf(ap);
            if (ssid && (!best.has(ssid) || best.get(ssid).get_strength() < ap.get_strength()))
                best.set(ssid, ap);
        }
        return [...best].map(([ssid, ap]) => ({
            id: ssid,
            name: ssid,
            strength: ap.get_strength(),
            secured: (ap.get_flags() & AP_PRIVACY) !== 0 || ap.get_wpa_flags() !== 0 ||
                ap.get_rsn_flags() !== 0,
            active: dev.get_state() === NM.DeviceState.ACTIVATED && ssid === activeSsid,
        })).sort((a, b) => b.active - a.active || b.strength - a.strength);
    }

    requestScan() {
        const [dev] = this._devices(NM.DeviceType.WIFI);
        dev?.request_scan_async(null, () => {});
    }

    /**
     * Connects to a network that has a saved profile.
     *
     * @param {string} id - SSID of the network
     * @returns {boolean} false when no saved profile has that SSID (nothing is done)
     */
    activateNetwork(id) {
        const [dev] = this._devices(NM.DeviceType.WIFI);
        const connection = this._client.get_connections().find(c => {
            const setting = c.get_setting_wireless();
            return setting && [null, 'infrastructure'].includes(setting.get_mode()) &&
                NM.utils_ssid_to_utf8(setting.get_ssid().get_data()) === id;
        });
        if (!dev || !connection)
            return false;
        this._activate(connection, dev);
        return true;
    }
}
