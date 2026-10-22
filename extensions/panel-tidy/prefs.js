import Adw from 'gi://Adw';
import Gdk from 'gi://Gdk';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';

import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

import {BOXES, fallbackName, forgetKey, moveKey} from './order.js';

const BOX_TITLES = {left: 'Left', center: 'Center', right: 'Right'};

export default class PanelTidyPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        this._settings = this.getSettings();
        window.set_default_size(560, 820);

        const page = new Adw.PreferencesPage();
        window.add(page);

        this._lists = {};
        for (const box of BOXES) {
            const group = new Adw.PreferencesGroup({title: BOX_TITLES[box]});
            if (box === 'left')
                group.description = 'Drag items to reorder them or move them to another side.';
            this._lists[box] = this._newList(box);
            group.add(this._lists[box]);
            page.add(group);
        }
        const toggleGroup = new Adw.PreferencesGroup({
            title: 'Quick Settings',
            description: 'Toggles shown in the system menu.',
        });
        this._lists.toggles = this._newList(null);
        toggleGroup.add(this._lists.toggles);
        page.add(toggleGroup);

        // The extension writes what it sees on the bar: rebuild whenever anything changes.
        const changedId = this._settings.connect('changed', () => this._scheduleRebuild());
        window.connect('close-request', () => {
            this._settings.disconnect(changedId);
            if (this._idleId)
                GLib.source_remove(this._idleId);
            this._idleId = 0;
            return false;
        });
        this._rebuild();
    }

    _newList(box) {
        const list = new Gtk.ListBox({selection_mode: Gtk.SelectionMode.NONE});
        list.add_css_class('boxed-list');
        if (box) {
            list.set_placeholder(new Gtk.Label({
                label: 'Drop items here', margin_top: 12, margin_bottom: 12,
                css_classes: ['dim-label'],
            }));
            // Dropping on the list itself (an empty box, or below the last row) appends.
            const target = Gtk.DropTarget.new(GObject.TYPE_STRING, Gdk.DragAction.MOVE);
            target.connect('drop', (_t, key) => this._move(key, box, null));
            list.add_controller(target);
        }
        return list;
    }

    _scheduleRebuild() {
        if (this._idleId)
            return;
        this._idleId = GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
            this._idleId = 0;
            this._rebuild();
            return GLib.SOURCE_REMOVE;
        });
    }

    _orders() {
        const orders = {};
        for (const box of BOXES)
            orders[box] = this._settings.get_strv(`${box}-box-order`);
        return orders;
    }

    _rebuild() {
        const orders = this._orders();
        const names = this._settings.get_value('item-names').deepUnpack();
        const present = new Set(this._settings.get_strv('present-items'));
        const hidden = new Set(this._settings.get_strv('hidden-items'));
        for (const box of BOXES) {
            this._lists[box].remove_all();
            for (const key of orders[box]) {
                this._lists[box].append(this._itemRow(box, key, names[key] ?? fallbackName(key),
                    present.has(key), hidden.has(key)));
            }
        }

        const presentToggles = new Set(this._settings.get_strv('present-toggles'));
        const hiddenToggles = new Set(this._settings.get_strv('hidden-toggles'));
        this._lists.toggles.remove_all();
        for (const [id, name] of this._settings.get_value('known-toggles').deepUnpack()) {
            this._lists.toggles.append(this._toggleRow(id, name, presentToggles.has(id),
                hiddenToggles.has(id)));
        }
    }

    _itemRow(box, key, name, present, hidden) {
        const row = this._row(name, present, hidden, 'hidden-items', key,
            () => this._forgetItem(key));
        row.add_prefix(new Gtk.Image({icon_name: 'list-drag-handle-symbolic'}));

        const source = new Gtk.DragSource({actions: Gdk.DragAction.MOVE});
        source.connect('prepare', () => Gdk.ContentProvider.new_for_value(key));
        source.connect('drag-begin', (_s, drag) => {
            Gtk.DragIcon.get_for_drag(drag).set_child(new Gtk.Label({
                label: name, margin_start: 12, margin_end: 12, margin_top: 6,
                margin_bottom: 6, css_classes: ['card'],
            }));
        });
        row.add_controller(source);

        // Upper half of a row: drop before it; lower half: before the next one.
        const target = Gtk.DropTarget.new(GObject.TYPE_STRING, Gdk.DragAction.MOVE);
        target.connect('drop', (_t, dropped, _x, y) => {
            if (dropped === key)
                return true;
            const order = this._orders()[box].filter(r => r !== dropped);
            const index = order.indexOf(key) + (y > row.get_height() / 2 ? 1 : 0);
            this._move(dropped, box, order[index] ?? null);
            return true;
        });
        row.add_controller(target);
        return row;
    }

    _toggleRow(id, name, present, hidden) {
        return this._row(name, present, hidden, 'hidden-toggles', id,
            () => this._forgetToggle(id));
    }

    // A row with a show/hide switch; items not running get a hint and a forget button.
    _row(name, present, hidden, hiddenKey, id, forget) {
        const row = new Adw.ActionRow({title: GLib.markup_escape_text(name, -1)});
        if (!present) {
            row.subtitle = 'Not running';
            row.add_css_class('dim-label');
            const button = new Gtk.Button({
                icon_name: 'user-trash-symbolic', valign: Gtk.Align.CENTER,
                tooltip_text: 'Forget', css_classes: ['flat'],
            });
            button.connect('clicked', forget);
            row.add_suffix(button);
        }
        const toggle = new Gtk.Switch({active: !hidden, valign: Gtk.Align.CENTER,
            tooltip_text: 'Show'});
        toggle.connect('notify::active', () => {
            const ids = this._settings.get_strv(hiddenKey).filter(i => i !== id);
            if (!toggle.active)
                ids.push(id);
            this._settings.set_strv(hiddenKey, ids);
        });
        row.add_suffix(toggle);
        row.activatable_widget = toggle;
        return row;
    }

    _move(key, box, before) {
        const orders = moveKey(this._orders(), key, box, before);
        for (const b of BOXES)
            this._settings.set_strv(`${b}-box-order`, orders[b]);
        return true;
    }

    _forgetItem(key) {
        const orders = forgetKey(this._orders(), key);
        for (const box of BOXES)
            this._settings.set_strv(`${box}-box-order`, orders[box]);
        const names = this._settings.get_value('item-names').deepUnpack();
        delete names[key];
        this._settings.set_value('item-names', new GLib.Variant('a{ss}', names));
        this._settings.set_strv('hidden-items',
            this._settings.get_strv('hidden-items').filter(k => k !== key));
    }

    _forgetToggle(id) {
        const known = this._settings.get_value('known-toggles').deepUnpack();
        this._settings.set_value('known-toggles',
            new GLib.Variant('a(ss)', known.filter(([i]) => i !== id)));
        this._settings.set_strv('hidden-toggles',
            this._settings.get_strv('hidden-toggles').filter(i => i !== id));
    }
}
