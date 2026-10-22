import GLib from 'gi://GLib';
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';

import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import {planLayout} from './layout.js';

// Wait for monitors and windows to settle before arranging: docking fires several
// monitors-changed signals, and Mutter moves windows around right after each one.
const SETTLE_MS = 2000;

export default class WindowLayoutExtension extends Extension {
    enable() {
        this._settings = this.getSettings();
        Main.wm.addKeybinding('apply-layout', this._settings, Meta.KeyBindingFlags.NONE,
            Shell.ActionMode.NORMAL | Shell.ActionMode.OVERVIEW, () => this._apply());
        this._monitorsId = Main.layoutManager.connect('monitors-changed',
            () => this._schedule());
        // Enabled during shell startup (login or restart): arrange once it is done.
        if (Main.layoutManager._startingUp) {
            this._startupId = Main.layoutManager.connect('startup-complete',
                () => this._schedule());
        }
    }

    disable() {
        Main.wm.removeKeybinding('apply-layout');
        Main.layoutManager.disconnect(this._monitorsId);
        if (this._startupId)
            Main.layoutManager.disconnect(this._startupId);
        if (this._timeoutId)
            GLib.source_remove(this._timeoutId);
        this._monitorsId = this._startupId = this._timeoutId = 0;
        this._settings = null;
    }

    _schedule() {
        if (this._timeoutId)
            GLib.source_remove(this._timeoutId);
        this._timeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, SETTLE_MS, () => {
            this._timeoutId = 0;
            this._apply();
            return GLib.SOURCE_REMOVE;
        });
    }

    _apply() {
        const workspace = global.workspace_manager.get_active_workspace();
        const monitors = [];
        for (let i = 0; i < global.display.get_n_monitors(); i++) {
            const {x, y, width, height} = workspace.get_work_area_for_monitor(i);
            monitors.push({index: i, x, y, width, height});
        }

        const windows = new Map(global.get_window_actors()
            .map(actor => actor.meta_window)
            .filter(w => w.get_window_type() === Meta.WindowType.NORMAL &&
                !w.is_skip_taskbar() && !w.get_transient_for() && !w.is_fullscreen() &&
                w.get_wm_class())
            .map(w => [w.get_id(), w]));

        const plan = planLayout(monitors, global.display.get_primary_monitor(),
            [...windows.values()].map(w => ({
                id: w.get_id(), wmClass: w.get_wm_class(), seq: w.get_stable_sequence(),
            })));

        for (const step of plan) {
            const win = windows.get(step.id);
            if (step.action === 'maximize') {
                if (win.get_monitor() !== step.monitor)
                    win.move_to_monitor(step.monitor);
                win.maximize(Meta.MaximizeFlags.BOTH);
            } else {
                if (win.get_maximized())
                    win.unmaximize(Meta.MaximizeFlags.BOTH);
                if (win.get_monitor() !== step.monitor)
                    win.move_to_monitor(step.monitor);
                const {x, y, width, height} = step.rect;
                win.move_resize_frame(true, x, y, width, height);
                win.raise();
            }
        }
    }
}
