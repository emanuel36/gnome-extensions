// The panel button (CPU, RAM) and its popup with network details.

import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Gio from 'gi://Gio';
import Pango from 'gi://Pango';
import St from 'gi://St';

import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

import {
    cpuSubline, formatDataSize, formatMemKb, formatMemTotals, formatPercent, formatRate,
    formatShare,
} from './format.js';

const TOP_ROWS = 5;
const COLUMN_WIDTH = 200;
// St's CSS has no opacity, so secondary text is faded on the actor
const FADED = 150;
const NET_ICONS = {
    cable: 'network-wired-symbolic',
    wifi: 'network-wireless-signal-excellent-symbolic',
};

function label(props = {}) {
    return new St.Label({y_align: Clutter.ActorAlign.CENTER, ...props});
}

export const SystemMonitorIndicator = GObject.registerClass(
class SystemMonitorIndicator extends PanelMenu.Button {
    _init(extensionPath) {
        super._init(0.0, 'System Monitor');

        this._iconPath = name => Gio.icon_new_for_string(
            GLib.build_filenamev([extensionPath, 'icons', `${name}.svg`]));

        const bar = new St.BoxLayout({style_class: 'panel-status-menu-box system-monitor-bar'});
        bar.add_child(this._barIcon('cpu-symbolic'));
        this._cpuLabel = label({text: '…', style_class: 'system-monitor-bar-value'});
        bar.add_child(this._cpuLabel);
        bar.add_child(this._barIcon('ram-symbolic'));
        this._ramLabel = label({text: '…', style_class: 'system-monitor-bar-value'});
        bar.add_child(this._ramLabel);
        this.add_child(bar);

        this._createPopup();
    }

    _barIcon(name) {
        return new St.Icon({
            gicon: this._iconPath(name),
            style_class: 'system-status-icon system-monitor-bar-icon',
        });
    }

    _createPopup() {
        const columns = new St.BoxLayout({style_class: 'system-monitor-columns'});
        this._cpu = this._createColumn('cpu-symbolic', 'CPU');
        this._memory = this._createColumn('ram-symbolic', 'Memory');
        columns.add_child(this._cpu.box);
        columns.add_child(this._memory.box);

        const statsItem = new PopupMenu.PopupBaseMenuItem({reactive: false, can_focus: false});
        statsItem.add_child(columns);
        this.menu.addMenuItem(statsItem);

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        this._netBox = new St.BoxLayout({
            vertical: true,
            x_expand: true,
            style_class: 'system-monitor-net',
        });
        const netItem = new PopupMenu.PopupBaseMenuItem({reactive: false, can_focus: false});
        netItem.add_child(this._netBox);
        this.menu.addMenuItem(netItem);
        this._netNames = null;
        this._netRows = new Map();
    }

    _createColumn(iconName, title) {
        const box = new St.BoxLayout({
            vertical: true,
            style_class: 'system-monitor-column',
            width: COLUMN_WIDTH,
        });

        const header = new St.BoxLayout({style_class: 'system-monitor-header'});
        header.add_child(new St.Icon({gicon: this._iconPath(iconName), icon_size: 16}));
        header.add_child(label({text: title, style_class: 'system-monitor-title'}));
        const total = label({
            text: '…',
            style_class: 'system-monitor-total',
            x_expand: true,
            x_align: Clutter.ActorAlign.END,
        });
        header.add_child(total);
        box.add_child(header);

        const usage = new St.Widget({style_class: 'system-monitor-usage', width: COLUMN_WIDTH});
        const fill = new St.Widget({style_class: 'system-monitor-usage-fill', width: 0});
        usage.add_child(fill);
        box.add_child(usage);

        const subline = label({style_class: 'system-monitor-subline', opacity: FADED});
        box.add_child(subline);

        const rows = [];
        for (let i = 0; i < TOP_ROWS; i++) {
            const row = new St.BoxLayout({style_class: 'system-monitor-row'});
            const name = label({x_expand: true});
            name.clutter_text.ellipsize = Pango.EllipsizeMode.END;
            const value = label({style_class: 'system-monitor-row-value'});
            row.add_child(name);
            row.add_child(value);
            box.add_child(row);
            rows.push({name, value});
        }

        return {box, total, fill, subline, rows};
    }

    setBar({cpu, ram}) {
        this._cpuLabel.text = cpu === null ? '…' : formatPercent(cpu);
        this._ramLabel.text = ram === null ? '…' : formatPercent(ram);
    }

    _setColumn(column, percent, subline, top, formatValue) {
        column.total.text = percent === null ? '…' : formatPercent(percent);
        column.fill.width = Math.round(Math.min(100, Math.max(0, percent ?? 0)) / 100 *
            COLUMN_WIDTH);
        column.subline.text = subline;
        column.subline.visible = subline !== '';

        column.rows.forEach(({name, value}, i) => {
            const entry = top?.[i];
            // A null list means "not measured yet" (CPU needs two scans)
            name.text = top === null && i === 0 ? '…' : entry?.name ?? '';
            name.opacity = top === null ? FADED : 255;
            value.text = entry ? formatValue(entry.value) : '';
        });
    }

    setCpu({percent, tempC, freqKhz, top}) {
        this._setColumn(this._cpu, percent, cpuSubline(tempC, freqKhz), top, formatShare);
    }

    setMemory({percent, usedKb, totalKb, top}) {
        this._setColumn(this._memory, percent, formatMemTotals(usedKb, totalKb), top,
            formatMemKb);
    }

    setNetwork(rows) {
        const names = rows.map(r => r.name).join(',');
        if (names !== this._netNames) {
            this._netNames = names;
            this._buildNetRows(rows);
        }
        for (const row of rows) {
            const actors = this._netRows.get(row.name);
            actors.today.text = `· ${formatDataSize(row.usedToday)} today`;
            actors.down.text = `↓ ${formatRate(row.down)}`;
            actors.up.text = `↑ ${formatRate(row.up)}`;
        }
    }

    _buildNetRows(rows) {
        this._netBox.destroy_all_children();
        this._netRows.clear();

        if (rows.length === 0) {
            this._netBox.add_child(label({text: 'Offline', opacity: FADED}));
            return;
        }

        for (const row of rows) {
            const box = new St.BoxLayout({style_class: 'system-monitor-net-row'});
            box.add_child(new St.Icon({icon_name: NET_ICONS[row.kind], icon_size: 16}));
            box.add_child(label({text: row.label}));
            const today = label({opacity: FADED, x_expand: true});
            box.add_child(today);
            const rate = () => label({
                style_class: 'system-monitor-rate',
                x_align: Clutter.ActorAlign.END,
            });
            const down = rate();
            const up = rate();
            box.add_child(down);
            box.add_child(up);
            this._netBox.add_child(box);
            this._netRows.set(row.name, {today, down, up});
        }
    }
});
