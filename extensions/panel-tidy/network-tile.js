// The Network tile and its menu. What to show comes from network.js, the data and the actions
// from a NetworkSource.
import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Shell from 'gi://Shell';
import St from 'gi://St';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import {QuickMenuToggle} from 'resource:///org/gnome/shell/ui/quickSettings.js';

import {
    cableRows, headerSummary, signalIcon, summary, tileAction, tileIcon, tileOn, wifiIcon,
    wifiOnly,
} from './network.js';

const NETWORK_SETTINGS = 'gnome-network-panel.desktop';
const WIFI_SETTINGS = 'gnome-wifi-panel.desktop';
const PENDING_SECONDS = 20;
const MAX_VISIBLE_NETWORKS = 8; // as in the shell's own Wi-Fi menu

function openSettings(desktopFile) {
    Main.panel.closeQuickSettings();
    Shell.AppSystem.get_default().lookup_app(desktopFile)?.activate();
}

// A switch row with a second line of text. A row with a list below (profiles, networks) opens
// it on click, with a chevron on the left; then only the switch turns it on and off.
const SwitchRow = GObject.registerClass({
    Signals: {'expand': {}},
}, class SwitchRow extends PopupMenu.PopupSwitchMenuItem {
    _init(title, subtitle, on, expandable, expanded) {
        super._init(title, on);
        const [t, s] = [title, subtitle].map(text => GLib.markup_escape_text(text, -1));
        this.label.clutter_text.set_markup(`${t}\n<span size="small" alpha="70%">${s}</span>`);

        this._expandable = expandable;
        // Kept on rows without a list too, so that all titles line up.
        this.insert_child_below(new St.Icon({
            icon_name: expanded ? 'pan-down-symbolic' : 'pan-end-symbolic',
            style_class: 'popup-menu-icon',
            opacity: expandable ? 255 : 0,
        }), this.label);

        // A button of its own, so that a click on the switch doesn't open the list.
        this._statusBin.child = null;
        const button = new St.Button({child: this._switch, y_align: Clutter.ActorAlign.CENTER});
        button.connect('clicked', () => this.toggle());
        this._statusBin.child = button;
    }

    // Toggling keeps the menu open, like the native device rows; the base class would close it.
    activate(event) {
        const space = event?.type() === Clutter.EventType.KEY_PRESS &&
            event.get_key_symbol() === Clutter.KEY_space;
        if (this._expandable && !space)
            this.emit('expand');
        else if (this._switch.mapped)
            this.toggle();
    }
});

// A Wi-Fi network laid out like the shell's own: signal and lock, name, check when active.
function networkItem(network) {
    const item = new PopupMenu.PopupBaseMenuItem();
    item.add_child(new St.Icon({
        icon_name: signalIcon(network.strength),
        style_class: 'popup-menu-icon',
    }));
    item.add_child(new St.Icon({
        icon_name: network.secured ? 'network-wireless-encrypted-symbolic' : '',
        style_class: 'wireless-secure-icon',
        y_align: Clutter.ActorAlign.END,
    }));
    item.add_child(new St.Label({text: network.name, x_expand: true}));
    item.add_child(new St.Icon({
        icon_name: 'object-select-symbolic',
        style_class: 'popup-menu-icon',
        opacity: network.active ? 255 : 0,
    }));
    return item;
}

export const NetworkTile = GObject.registerClass(
class NetworkTile extends QuickMenuToggle {
    constructor(source) {
        super({title: 'Network'});
        this._source = source;
        this._expanded = new Set(); // cable devices and 'wifi' whose list is open
        this._remembered = null;
        this._rows = new Map(); // expandable rows by cable device or 'wifi', to restore focus
        this._pending = null; // Wi-Fi network to join once the radio is back
        this._snapshot = source.snapshot();

        this._wiredLabel = new PopupMenu.PopupSeparatorMenuItem('Wired');
        this.menu.addMenuItem(this._wiredLabel);
        this._wired = new PopupMenu.PopupMenuSection();
        this.menu.addMenuItem(this._wired);
        this._wifiLabel = new PopupMenu.PopupSeparatorMenuItem('Wi-Fi');
        this.menu.addMenuItem(this._wifiLabel);
        this._wifi = new PopupMenu.PopupMenuSection();
        this.menu.addMenuItem(this._wifi);
        this._networkSettings = this.menu.addSettingsAction('Network Settings', NETWORK_SETTINGS);
        this._allNetworks = this.menu.addSettingsAction('All Networks', WIFI_SETTINGS);

        this.connect('clicked', () => this._onClicked());
        // As a Wi-Fi tile the networks are always listed, so look for them on open.
        this.menu.connect('open-state-changed', (m, open) => {
            if (open && wifiOnly(this._snapshot.cables, this._snapshot.wifi))
                this._source.requestScan();
        });
        this._sourceId = source.connect(() => this._sync());
        this._sync();
    }

    destroy() {
        this._clearPending();
        this._source?.disconnect(this._sourceId);
        this._source = null;
        // The shell parents the menu in its overlay, so it outlives the tile unless destroyed.
        this.menu.destroy();
        super.destroy();
    }

    // The source calls back from an idle: the tile may have been destroyed in between.
    _sync() {
        if (!this._source)
            return;
        const {cables, wifi} = this._snapshot = this._source.snapshot();
        const up = cables.filter(c => c.present && c.connected).length;
        const only = wifiOnly(cables, wifi);
        // As a Wi-Fi tile it reads like the shell's own: the network name, on while the radio is.
        const icon = only ? wifiIcon(wifi) : tileIcon(up);
        this.set({
            iconName: icon,
            title: only ? 'Wi-Fi' : 'Network',
            subtitle: only ? wifi.ssid : summary(up, wifi.connected),
            checked: only ? wifi.enabled : tileOn(cables, wifi),
        });
        if (only)
            this.menu.setHeader(icon, 'Wi-Fi');
        else
            this.menu.setHeader(tileIcon(up), 'Network', headerSummary(cables, wifi));
        this._wiredLabel.visible = this._wired.actor.visible = !only;
        const {allowSettings} = Main.sessionMode;
        this._networkSettings.visible = allowSettings && !only;
        this._allNetworks.visible = allowSettings && only;
        this._buildWired(cables);
        this._buildWifi(wifi, only);
        this._resumePending(wifi);
    }

    _toggleExpanded(key) {
        if (!this._expanded.delete(key))
            this._expanded.add(key);
        if (key === 'wifi' && this._expanded.has(key))
            this._source.requestScan();
        this._sync();
        this._rows.get(key)?.grab_key_focus();
    }

    // Rows are rebuilt only when what they show changes: a rebuild drops hover and focus.
    _buildWired(cables) {
        const rows = cableRows(cables);
        const key = JSON.stringify(rows.map(r => [r, this._expanded.has(r.device)]));
        if (key === this._wiredKey)
            return;
        this._wiredKey = key;
        this._wired.removeAll();
        [...this._rows.keys()].filter(k => k !== 'wifi').forEach(k => this._rows.delete(k));
        if (!rows.length) {
            this._wired.addMenuItem(
                new PopupMenu.PopupMenuItem('No cable connected', {reactive: false}));
            return;
        }
        for (const row of rows) {
            const open = this._expanded.has(row.device);
            const item = new SwitchRow(row.title, row.subtitle, row.on, row.profiles.length > 0,
                open);
            item.connect('toggled', (i, state) => this._source.setCable(row.device, state));
            item.connect('expand', () => this._toggleExpanded(row.device));
            this._rows.set(row.device, item);
            this._wired.addMenuItem(item);
            if (!open)
                continue;
            for (const profile of row.profiles) {
                const entry = new PopupMenu.PopupMenuItem(profile.name);
                entry.setOrnament(profile.active
                    ? PopupMenu.Ornament.CHECK : PopupMenu.Ornament.NONE);
                entry.connect('activate',
                    () => this._source.activateProfile(row.device, profile.id));
                this._wired.addMenuItem(entry);
            }
        }
    }

    _buildWifi(wifi, only) {
        this._wifiLabel.visible = wifi.present && !only;
        this._wifi.actor.visible = wifi.present;
        const open = wifi.present && wifi.enabled && (only || this._expanded.has('wifi'));
        const all = open ? this._source.wifiNetworks() : [];
        const networks = only ? all.slice(0, MAX_VISIBLE_NETWORKS) : all;
        // The order of the networks is left out: signal strength keeps shuffling it.
        const key = JSON.stringify([wifi, only, open,
            networks.map(n => [n.id, n.active, n.secured, signalIcon(n.strength)]).sort()]);
        if (key === this._wifiKey)
            return;
        this._wifiKey = key;
        this._wifi.removeAll();
        this._rows.delete('wifi');
        if (!wifi.present)
            return;
        if (!only) {
            const subtitle = wifi.connected ? wifi.ssid : wifi.enabled ? 'Not connected' : 'Off';
            const item = new SwitchRow('Wi-Fi', subtitle, wifi.enabled, wifi.enabled, open);
            item.connect('toggled', (i, state) => this._source.setWifi(state));
            item.connect('expand', () => this._toggleExpanded('wifi'));
            this._rows.set('wifi', item);
            this._wifi.addMenuItem(item);
        }
        for (const network of networks) {
            const entry = networkItem(network);
            entry.connect('activate', () => {
                if (!this._source.activateNetwork(network.id))
                    openSettings(WIFI_SETTINGS);
            });
            this._wifi.addMenuItem(entry);
        }
    }

    _onClicked() {
        const {cables, wifi} = this._snapshot;
        const action = tileAction(cables, wifi, this._remembered);
        if (action.kind === 'toggleWifi') {
            this._remembered = null; // a later Network click must not bring back an old state
            this._source.setWifi(!wifi.enabled);
        } else if (action.kind === 'openMenu') {
            this.menu.open();
        } else if (action.kind === 'disconnect') {
            this._remembered = action.remember;
            this._clearPending();
            cables.filter(c => c.present && c.connected)
                .forEach(c => this._source.setCable(c.device, false));
            if (wifi.connected)
                this._source.setWifi(false);
        } else {
            const {cables: targets, wifi: ssid} = action.targets;
            targets.forEach(t => this._source.activateProfile(t.device, t.profile));
            if (ssid !== null) {
                this._source.setWifi(true);
                this._setPending(ssid);
            }
        }
    }

    // After the radio comes back, join the network that was connected before.
    _setPending(ssid) {
        this._clearPending();
        const timeoutId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, PENDING_SECONDS, () => {
            this._pending = null;
            return GLib.SOURCE_REMOVE;
        });
        this._pending = {ssid, timeoutId};
    }

    _clearPending() {
        if (this._pending)
            GLib.source_remove(this._pending.timeoutId);
        this._pending = null;
    }

    _resumePending(wifi) {
        if (!this._pending || !wifi.enabled || wifi.connected)
            return;
        const {ssid} = this._pending;
        if (!this._source.wifiNetworks().some(n => n.id === ssid))
            return;
        this._clearPending();
        this._source.activateNetwork(ssid);
    }
});
