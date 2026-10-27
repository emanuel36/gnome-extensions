// Pure logic of the Network tile: no shell, GTK or NM imports, so it runs under plain `gjs -m`.
//
// Cable: {device, name, speed, present, connected, profiles: [{id, name}], active}
// Wifi: {present, enabled (radio on), connected, ssid}
// Remembered: {cables: [{device, profile}], wifi: ssid or null}

const WIRED_ICON = 'network-wired-symbolic';
const WIFI_ICON = 'network-wireless-signal-excellent-symbolic';

const connectedCables = cables => cables.filter(c => c.present && c.connected);

/**
 * Subtitle of the tile.
 *
 * @param {number} cableCount - cables connected right now
 * @param {boolean} wifiConnected - whether Wi-Fi is connected
 * @returns {string} for example `2 Wired · Wi-Fi`
 */
export function summary(cableCount, wifiConnected) {
    const parts = [];
    if (cableCount > 1)
        parts.push(`${cableCount} Wired`);
    else if (cableCount === 1)
        parts.push('Wired');
    if (wifiConnected)
        parts.push('Wi-Fi');
    return parts.length ? parts.join(' · ') : 'Disconnected';
}

/**
 * Subtitle of the menu header: the name of a single cable, a count for several, then the
 * Wi-Fi network.
 *
 * @param {object[]} cables
 * @param {object} wifi
 * @returns {string}
 */
export function headerSummary(cables, wifi) {
    const up = connectedCables(cables);
    const parts = [];
    if (up.length > 1)
        parts.push(`${up.length} Wired`);
    else if (up.length === 1)
        parts.push(up[0].name);
    if (wifi.connected)
        parts.push(wifi.ssid);
    return parts.length ? parts.join(' · ') : 'Disconnected';
}

// Names of the two kinds of cable: a USB adapter (the dock) or the machine's own port.
const DOCK_NAME = 'Dock';
const PORT_NAME = 'Ethernet';

/**
 * Names of the wired devices: `Dock` for a USB adapter, `Ethernet` for a built-in port,
 * numbered when the same name would show twice.
 *
 * @param {string[]} udis - sysfs paths of the devices (NM.Device udi)
 * @returns {string[]}
 */
export function cableNames(udis) {
    const names = udis.map(udi => /\/usb\d*\//.test(udi) ? DOCK_NAME : PORT_NAME);
    const total = new Map();
    names.forEach(name => total.set(name, (total.get(name) ?? 0) + 1));
    const seen = new Map();
    return names.map(name => {
        if (total.get(name) === 1)
            return name;
        seen.set(name, (seen.get(name) ?? 0) + 1);
        return `${name} ${seen.get(name)}`;
    });
}

/**
 * Whether the tile stands for Wi-Fi alone, like the shell's own Wi-Fi tile: no cable is
 * plugged in and there is a Wi-Fi device.
 *
 * @param {object[]} cables
 * @param {object} wifi
 * @returns {boolean}
 */
export const wifiOnly = (cables, wifi) => wifi.present && !cables.some(c => c.present);

/**
 * Icon of the tile as a Wi-Fi tile, like the shell's own: off, on but not connected, or
 * connected.
 *
 * @param {object} wifi
 * @returns {string}
 */
export function wifiIcon(wifi) {
    if (!wifi.enabled)
        return 'network-wireless-disabled-symbolic';
    return wifi.connected ? WIFI_ICON : 'network-wireless-offline-symbolic';
}

export const tileIcon = cableCount => cableCount > 0 ? WIRED_ICON : WIFI_ICON;

/**
 * Icon for a Wi-Fi network, with the same thresholds as the shell's own network menu.
 *
 * @param {number} strength - signal strength, 0 to 100
 * @returns {string}
 */
export function signalIcon(strength) {
    const level = strength >= 80 ? 'excellent' : strength >= 55 ? 'good'
        : strength >= 30 ? 'ok' : strength >= 5 ? 'weak' : 'none';
    return `network-wireless-signal-${level}-symbolic`;
}

export const tileOn =(cables, wifi) => connectedCables(cables).length > 0 || wifi.connected;

/**
 * Rows of the Wired section: one per cable that is plugged in. A cable lists its profiles
 * only when it has more than one.
 *
 * @param {object[]} cables
 * @returns {{device: string, title: string, subtitle: string, on: boolean,
 *     profiles: {id: string, name: string, active: boolean}[]}[]}
 */
export function cableRows(cables) {
    return cables.filter(c => c.present).map(c => ({
        device: c.device,
        title: c.name,
        subtitle: [
            c.connected ? c.profiles.find(p => p.id === c.active)?.name ?? c.active
                : 'Disconnected',
            c.speed,
        ].filter(Boolean).join(' · '),
        on: c.connected,
        profiles: c.profiles.length > 1
            ? c.profiles.map(p => ({id: p.id, name: p.name, active: p.id === c.active}))
            : [],
    }));
}

/**
 * Profiles that can be used on a device: those bound to no interface or to this one, and to
 * no MAC address or to this one.
 *
 * @param {{id: string, name: string, iface: ?string, mac: ?string}[]} profiles
 * @param {{iface: string, mac: string}} device
 * @returns {{id: string, name: string}[]}
 */
export function profilesFor(profiles, device) {
    return profiles
        .filter(p => (p.iface === null || p.iface === device.iface) &&
            (p.mac === null || p.mac === device.mac))
        .map(({id, name}) => ({id, name}));
}

/**
 * What a click on the tile body does. As a Wi-Fi tile: switch the radio, like the shell does.
 * With anything connected: disconnect everything and remember what was up. With nothing
 * connected: reconnect what was remembered, or open the menu when there is nothing to
 * reconnect.
 *
 * @param {object[]} cables
 * @param {object} wifi
 * @param {?object} remembered - what the last disconnect left behind
 * @returns {{kind: string, remember?: object, targets?: object}}
 */
export function tileAction(cables, wifi, remembered) {
    if (wifiOnly(cables, wifi))
        return {kind: 'toggleWifi'};
    const up = connectedCables(cables);
    if (up.length || wifi.connected) {
        return {
            kind: 'disconnect',
            remember: {
                cables: up.map(c => ({device: c.device, profile: c.active})),
                wifi: wifi.connected ? wifi.ssid : null,
            },
        };
    }
    if (remembered && (remembered.cables.length || remembered.wifi !== null))
        return {kind: 'reconnect', targets: remembered};
    return {kind: 'openMenu'};
}
