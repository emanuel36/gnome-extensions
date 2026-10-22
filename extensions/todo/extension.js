import GLib from 'gi://GLib';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';

import {TodoIndicator} from './indicator.js';

export default class TodoExtension extends Extension {
    enable() {
        const path = GLib.build_filenamev([GLib.get_user_data_dir(), this.uuid, 'tasks.json']);
        this._indicator = new TodoIndicator(path);
        // Left box, after Activities and Next Up
        Main.panel.addToStatusArea(this.uuid, this._indicator, 2, 'left');
    }

    disable() {
        this._indicator?.destroy();
        this._indicator = null;
    }
}
