import GLib from 'gi://GLib';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';

import {TodoIndicator} from './indicator.js';

const DOCK_NAME = 'dashtodockContainer';

export default class TodoExtension extends Extension {
    enable() {
        const path = GLib.build_filenamev([GLib.get_user_data_dir(), this.uuid, 'tasks.json']);
        this._indicator = new TodoIndicator(path);
        // Far left of the bar, above the Ubuntu Dock
        Main.panel.addToStatusArea(this.uuid, this._indicator, 0, 'left');

        // The dock can appear after us or be rebuilt (monitor or dock settings changes)
        this._uiGroupIds = ['child-added', 'child-removed'].map(signal =>
            Main.uiGroup.connect(signal, () => this._syncWidth()));
        this._syncWidth();
    }

    disable() {
        for (const id of this._uiGroupIds)
            Main.uiGroup.disconnect(id);
        this._uiGroupIds = null;
        this._watchDock(null);
        this._indicator?.destroy();
        this._indicator = null;
    }

    // Same width as the dock on the primary monitor, so the item caps the dock's column;
    // natural width when there is no dock
    _syncWidth() {
        const dock = Main.uiGroup.get_children().find(actor =>
            actor.name === DOCK_NAME && actor.monitorIndex === Main.layoutManager.primaryIndex);
        this._watchDock(dock ?? null);
        this._indicator.width = dock ? dock.width : -1;
    }

    _watchDock(dock) {
        if (dock === this._dock)
            return;
        if (this._dock)
            this._dock.disconnect(this._dockWidthId);
        this._dock = dock;
        this._dockWidthId = dock?.connect('notify::width', () => this._syncWidth());
    }
}
