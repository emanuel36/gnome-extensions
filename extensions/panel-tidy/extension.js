import GLib from 'gi://GLib';

import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {QuickMenuToggle, QuickToggle} from 'resource:///org/gnome/shell/ui/quickSettings.js';

import {
    BOXES, SYSTEM_NAMES, addNewKeys, fallbackName, itemKey, mergeToggles, toggleId,
} from './order.js';

// Only reacts to items that already exist (signals on the panel boxes and the Quick
// Settings grid); never overrides shell functions, so other extensions' items are added
// exactly as without it.
export default class PanelTidyExtension extends Extension {
    enable() {
        this._settings = this.getSettings();
        this._boxes = {
            left: Main.panel._leftBox,
            center: Main.panel._centerBox,
            right: Main.panel._rightBox,
        };
        this._grid = Main.panel.statusArea.quickSettings?.menu._grid ?? null;
        this._hiddenItems = new Map(); // key -> {container, visibleId, destroyId}
        this._hiddenToggles = new Map(); // toggle actor -> {natural, id, destroyId, busy}
        this._failed = new Set();
        this._waiting = new Map(); // app indicator without an id yet -> 'ready' handler id
        this._signals = [];
        for (const box of Object.values(this._boxes))
            this._connect(box, 'child-added', () => this._schedule());
        if (this._grid)
            this._connect(this._grid, 'child-added', () => this._schedule());
        this._connect(this._settings, 'changed', () => this._schedule());
        this._apply();
    }

    disable() {
        if (this._idleId)
            GLib.source_remove(this._idleId);
        this._idleId = 0;
        for (const [obj, id] of this._signals)
            obj.disconnect(id);
        for (const [appIndicator, id] of this._waiting)
            appIndicator.disconnect(id);
        for (const key of [...this._hiddenItems.keys()])
            this._showItem(key);
        for (const toggle of [...this._hiddenToggles.keys()])
            this._showToggle(toggle);
        this._signals = this._waiting = null;
        this._hiddenItems = this._hiddenToggles = this._failed = null;
        this._boxes = this._grid = this._settings = null;
    }

    _connect(obj, signal, handler) {
        this._signals.push([obj, obj.connect(signal, handler)]);
    }

    // Many items arrive in a burst at login: handle them in one pass.
    _schedule() {
        if (this._idleId)
            return;
        this._idleId = GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
            this._idleId = 0;
            this._apply();
            return GLib.SOURCE_REMOVE;
        });
    }

    _apply() {
        this._applyItems();
        if (this._grid)
            this._applyToggles();
    }

    // Runs `fn` for one item; a failure is logged once and does not stop the pass.
    _guard(key, fn) {
        try {
            fn();
        } catch (e) {
            if (!this._failed.has(key)) {
                this._failed.add(key);
                console.warn(`${this.uuid}: ${key}: ${e.message}`);
            }
        }
    }

    // Items currently on the bar: key -> {indicator, container, box}, plus keys per box in
    // bar order. statusArea can hold null entries (appindicators leave them behind).
    _readBar() {
        const items = new Map();
        const bar = {};
        for (const [role, indicator] of Object.entries(Main.panel.statusArea)) {
            this._guard(role, () => {
                const container = indicator?.container;
                const parent = container?.get_parent();
                const box = BOXES.find(b => this._boxes[b] === parent);
                if (!box)
                    return;
                const appIndicator = indicator._indicator;
                const key = itemKey(role, appIndicator?.id);
                if (key === null)
                    this._waitForId(appIndicator);
                else if (!items.has(key))
                    items.set(key, {indicator, container, box});
            });
        }
        for (const box of BOXES) {
            const children = this._boxes[box].get_children();
            bar[box] = [...items.keys()].filter(key => items.get(key).box === box)
                .sort((a, b) => children.indexOf(items.get(a).container) -
                    children.indexOf(items.get(b).container));
        }
        return {items, bar};
    }

    // An app icon can reach the bar before its app has told its id: try again once it has.
    _waitForId(appIndicator) {
        if (this._waiting.has(appIndicator))
            return;
        const id = appIndicator.connect('ready', () => {
            appIndicator.disconnect(id);
            this._waiting.delete(appIndicator);
            this._schedule();
        });
        this._waiting.set(appIndicator, id);
    }

    _applyItems() {
        const {items, bar} = this._readBar();
        const saved = {};
        for (const box of BOXES)
            saved[box] = this._settings.get_strv(`${box}-box-order`);
        const {orders, changed} = addNewKeys(saved, bar);
        if (changed) {
            for (const box of BOXES)
                this._setStrv(`${box}-box-order`, orders[box]);
        }

        const names = this._settings.get_value('item-names').deepUnpack();
        for (const [key, {indicator}] of items)
            this._guard(key, () => (names[key] = this._itemName(key, indicator)));
        this._setValue('item-names', 'a{ss}', names);
        this._setStrv('present-items', [...items.keys()]);

        for (const box of BOXES) {
            const target = this._boxes[box];
            orders[box].filter(key => items.has(key)).forEach((key, index) => {
                this._guard(key, () => {
                    const {container} = items.get(key);
                    if (container.get_parent() !== target) {
                        container.get_parent().remove_child(container);
                        target.insert_child_at_index(container, index);
                    } else if (target.get_children().indexOf(container) !== index) {
                        target.set_child_at_index(container, index);
                    }
                });
            });
        }

        const hidden = new Set(this._settings.get_strv('hidden-items'));
        for (const [key, entry] of [...this._hiddenItems]) {
            if (items.get(key)?.container !== entry.container)
                this._showItem(key);
        }
        for (const [key, {container}] of items) {
            this._guard(key, () => {
                if (hidden.has(key))
                    this._hideItem(key, container);
                else
                    this._showItem(key);
            });
        }
    }

    // App icons are named from their key (app id or window class): titles are often shared,
    // e.g. both update-notifier icons.
    _itemName(key, indicator) {
        if (key.startsWith('appindicator-'))
            return fallbackName(key);
        return SYSTEM_NAMES[key] ?? Main.extensionManager.lookup(key)?.metadata.name ??
            (indicator.accessible_name || fallbackName(key));
    }

    // The shell calls container.show() whenever it (re)adds an item, and the keyboard and
    // accessibility indicators manage their own visibility: keep hidden containers hidden.
    _hideItem(key, container) {
        if (this._hiddenItems.has(key))
            return;
        const entry = {container};
        entry.visibleId = container.connect('notify::visible', () => {
            if (container.visible)
                container.hide();
        });
        entry.destroyId = container.connect('destroy', () => {
            if (this._hiddenItems.get(key) === entry)
                this._hiddenItems.delete(key);
        });
        this._hiddenItems.set(key, entry);
        container.hide();
    }

    _showItem(key) {
        const entry = this._hiddenItems.get(key);
        if (!entry)
            return;
        this._hiddenItems.delete(key);
        entry.container.disconnect(entry.visibleId);
        entry.container.disconnect(entry.destroyId);
        entry.container.show();
    }

    _applyToggles() {
        const toggles = this._grid.get_children()
            .filter(c => c instanceof QuickToggle || c instanceof QuickMenuToggle)
            .map(c => ({actor: c, id: toggleId(c.constructor.name, c.title ?? ''),
                name: c.title || c.constructor.name}));
        const known = this._settings.get_value('known-toggles').deepUnpack();
        this._setValue('known-toggles', 'a(ss)',
            mergeToggles(known, toggles.map(t => [t.id, t.name])));
        this._setStrv('present-toggles', toggles.map(t => t.id));

        const hidden = new Set(this._settings.get_strv('hidden-toggles'));
        for (const {actor, id} of toggles) {
            this._guard(id, () => {
                if (hidden.has(id))
                    this._hideToggle(actor);
                else
                    this._showToggle(actor);
            });
        }
    }

    // Toggles such as Airplane Mode and Keyboard (backlight) set their own visibility.
    // Remember what they last asked for, so disable() can give it back.
    _hideToggle(toggle) {
        if (this._hiddenToggles.has(toggle))
            return;
        const state = {natural: toggle.visible, busy: false};
        state.id = toggle.connect('notify::visible', () => {
            if (state.busy)
                return;
            state.natural = toggle.visible;
            if (toggle.visible) {
                state.busy = true;
                toggle.visible = false;
                state.busy = false;
            }
        });
        state.destroyId = toggle.connect('destroy', () => this._hiddenToggles.delete(toggle));
        this._hiddenToggles.set(toggle, state);
        state.busy = true;
        toggle.visible = false;
        state.busy = false;
    }

    _showToggle(toggle) {
        const state = this._hiddenToggles.get(toggle);
        if (!state)
            return;
        this._hiddenToggles.delete(toggle);
        toggle.disconnect(state.id);
        toggle.disconnect(state.destroyId);
        toggle.visible = state.natural;
    }

    // Writes only real changes: every write wakes the 'changed' handler and the prefs window.
    _setStrv(key, value) {
        if (JSON.stringify(this._settings.get_strv(key)) !== JSON.stringify(value))
            this._settings.set_strv(key, value);
    }

    _setValue(key, type, value) {
        const variant = new GLib.Variant(type, value);
        if (!this._settings.get_value(key).equal(variant))
            this._settings.set_value(key, variant);
    }
}
