import Gio from 'gi://Gio';
import Meta from 'gi://Meta';

import {InjectionManager} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {NotificationDestroyedReason} from 'resource:///org/gnome/shell/ui/messageTray.js';
import {SwitcherPopup} from 'resource:///org/gnome/shell/ui/switcherPopup.js';

import {sideMonitorIndex} from './layout.js';
import {dockOffset, mergeSaved, placeOn, planRestore, planShare} from './share.js';

const DOCK_SCHEMA = 'org.gnome.shell.extensions.dash-to-dock';

const MOVABLE_TYPES = [
    Meta.WindowType.NORMAL, Meta.WindowType.DIALOG, Meta.WindowType.MODAL_DIALOG,
    Meta.WindowType.UTILITY,
];

/**
 * @param {Meta.Window} win - Any window.
 * @returns {boolean} Whether the window can be picked for sharing: an app's own window.
 */
export function isNormal(win) {
    return win.get_window_type() === Meta.WindowType.NORMAL && !win.is_skip_taskbar() &&
        !win.get_transient_for();
}

// Windows Share Mode moves: app windows and their dialogs and tool windows, except attached
// dialogs, which Mutter moves along with their parent
function movableWindows() {
    return global.get_window_actors().map(a => a.meta_window)
        .filter(w => MOVABLE_TYPES.includes(w.get_window_type()) && !w.is_attached_dialog());
}

/**
 * @returns {Array<{index: number, x: number, y: number, width: number, height: number}>}
 *     Work area of each monitor on the active workspace.
 */
export function workAreas() {
    const workspace = global.workspace_manager.get_active_workspace();
    const areas = [];
    for (let i = 0; i < global.display.get_n_monitors(); i++) {
        const {x, y, width, height} = workspace.get_work_area_for_monitor(i);
        areas.push({index: i, x, y, width, height});
    }
    return areas;
}

function frameOf(win) {
    const {x, y, width, height} = win.get_frame_rect();
    return {x, y, width, height};
}

function moveWindow(win, monitor, rect) {
    if (win.get_monitor() !== monitor)
        win.move_to_monitor(monitor);
    if (!win.get_maximized())
        win.move_resize_frame(true, rect.x, rect.y, rect.width, rect.height);
}

// Leaves only one window on the primary monitor, with the dock on the secondary one and
// notification banners blocked, and puts everything back on stop(). The dock setting is
// also kept in settings, so a shell restart in the middle can still restore it.
export class ShareMode {
    constructor(settings, onChanged) {
        this._settings = settings;
        this._onChanged = onChanged;
        this._saved = null;
        this._shared = null;
        this._injections = new InjectionManager();
        this._pending = new Map();
        const dockSchema = Gio.SettingsSchemaSource.get_default().lookup(DOCK_SCHEMA, true);
        this._dock = dockSchema ? new Gio.Settings({settings_schema: dockSchema}) : null;
        this.recover();
    }

    get active() {
        return this._saved !== null;
    }

    get sharedWindow() {
        return this._shared;
    }

    start(win) {
        if (global.display.get_n_monitors() < 2 || !win.get_compositor_private())
            return;
        const first = !this.active;
        // The shared window's own dialogs and tool windows stay with it
        const windows = movableWindows().filter(w => w.find_root_ancestor() !== win || w === win);
        const areas = workAreas();
        const primary = global.display.get_primary_monitor();
        const byId = new Map(windows.map(w => [w.get_id(), w]));
        const plan = planShare(areas, primary, windows.map(w => ({
            id: w.get_id(), monitor: w.get_monitor(), rect: frameOf(w),
        })), win.get_id());

        // Only moved windows are saved, so windows the mode never touched keep any change
        // the user makes to them meanwhile
        const moved = {};
        for (const {id} of plan) {
            const w = byId.get(id);
            moved[id] = {
                monitor: w.get_monitor(),
                rect: frameOf(w),
                maximized: w.get_maximized(),
                workspace: w.get_workspace()?.index() ?? -1,
            };
        }
        this._saved = mergeSaved(this._saved ?? {}, moved);
        this._setShared(win);

        for (const step of plan)
            moveWindow(byId.get(step.id), step.monitor, step.rect);
        win.activate(global.get_current_time());

        if (first) {
            this._settings.set_string('share-saved-state', JSON.stringify({
                dock: this._dock?.get_int('preferred-monitor') ?? null,
            }));
            this._dock?.set_int('preferred-monitor',
                dockOffset(primary, sideMonitorIndex(areas, primary), areas.length));
            // The dock shrinks the side monitor's work area once it gets there
            this._workAreasId = global.display.connect('workareas-changed',
                () => this._fitSideWindows());
            this._blockBanners();
            this._clearNotifications();
            this._createdId = global.display.connect('window-created',
                (_display, created) => this._onWindowCreated(created));
            this._moveSwitchers();
        }
        this._onChanged();
    }

    stop({restoreWindows = true} = {}) {
        if (!this.active)
            return;
        global.display.disconnect(this._createdId);
        global.display.disconnect(this._workAreasId);
        for (const [win, ids] of this._pending)
            ids.forEach(id => win.disconnect(id));
        this._pending.clear();
        this._injections.clear();
        this._unblockBanners();
        Main.layoutManager.primaryMonitor =
            Main.layoutManager.monitors[Main.layoutManager.primaryIndex];
        if (restoreWindows)
            this._restoreWindows();
        this.recover();
        this._saved = null;
        this._setShared(null);
        this._onChanged();
    }

    // Closing the shared window leaves the mode on, with nothing shared
    _setShared(win) {
        this._shared?.disconnect(this._unmanagedId);
        this._shared = win;
        this._unmanagedId = win?.connect('unmanaged', () => {
            this._shared = null;
            this._onChanged();
        });
    }

    // Restores the dock setting saved by start(), if any
    recover() {
        const json = this._settings.get_string('share-saved-state');
        if (!json)
            return;
        this._settings.set_string('share-saved-state', '');
        try {
            const {dock} = JSON.parse(json);
            if (Number.isInteger(dock))
                this._dock?.set_int('preferred-monitor', dock);
        } catch (e) {
            console.warn(`window-layout: bad share-saved-state: ${e.message}`);
        }
    }

    destroy() {
        this.stop();
        this._dock = this._settings = this._onChanged = null;
    }

    // Shrinks windows moved to the side monitor back inside its work area
    _fitSideWindows() {
        const areas = workAreas();
        const side = sideMonitorIndex(areas, global.display.get_primary_monitor());
        for (const w of movableWindows()) {
            if (String(w.get_id()) in this._saved && w.get_monitor() === side)
                moveWindow(w, side, placeOn(frameOf(w), areas[side], areas[side]));
        }
    }

    _restoreWindows() {
        const open = new Map(movableWindows().map(w => [String(w.get_id()), w]));
        for (const [id, state] of planRestore(this._saved, new Set(open.keys()))) {
            const win = open.get(id);
            // A maximized window keeps its own unmaximized size: only move it
            if (!state.maximized && win.get_maximized())
                win.unmaximize(Meta.MaximizeFlags.BOTH);
            moveWindow(win, state.monitor, state.rect);
            if (state.maximized && win.get_maximized() !== state.maximized)
                win.maximize(state.maximized);
            // Windows on a non-primary monitor are on all workspaces and ignore this, so it
            // must come after the move back
            if (state.workspace >= 0)
                win.change_workspace_by_index(state.workspace, false);
        }
    }

    // A new window is placed when first shown, before it is painted: send it to the
    // secondary monitor then if it landed on the primary.
    _onWindowCreated(win) {
        if (!isNormal(win))
            return;
        const shownId = win.connect('shown', () => {
            this._forget(win);
            const primary = global.display.get_primary_monitor();
            if (win === this._shared || win.get_monitor() !== primary)
                return;
            const areas = workAreas();
            const side = sideMonitorIndex(areas, primary);
            if (side !== -1)
                moveWindow(win, side, placeOn(frameOf(win), areas[primary], areas[side]));
        });
        const unmanagedId = win.connect('unmanaged', () => this._forget(win));
        this._pending.set(win, [shownId, unmanagedId]);
    }

    _forget(win) {
        this._pending.get(win)?.forEach(id => win.disconnect(id));
        this._pending.delete(win);
    }

    // Banners show on the primary monitor, and critical ones ignore the show-banners
    // setting: the tray reads _bannerBlocked on every update, so pin it to true while the
    // mode is on. Others (the calendar menu) still set it; their value is kept for later.
    _blockBanners() {
        const tray = Main.messageTray;
        let blocked = tray._bannerBlocked;
        Object.defineProperty(tray, '_bannerBlocked', {
            get: () => true,
            set: value => (blocked = value),
            configurable: true,
        });
        this._unblockBanners = () => {
            delete tray._bannerBlocked;
            tray._bannerBlocked = blocked;
            tray._updateState();
        };
        tray._updateState();
    }

    // Switchers (Alt+Tab and friends) size and place themselves, thumbnails included, on
    // layoutManager.primaryMonitor: point it at the secondary monitor while one is open.
    _moveSwitchers() {
        this._injections.overrideMethod(SwitcherPopup.prototype, 'show', original =>
            function (...args) {
                const layout = Main.layoutManager;
                const side = sideMonitorIndex(layout.monitors, layout.primaryIndex);
                if (side !== -1) {
                    layout.primaryMonitor = layout.monitors[side];
                    this.connect('destroy', () => {
                        if (layout.primaryMonitor === layout.monitors[side])
                            layout.primaryMonitor = layout.monitors[layout.primaryIndex];
                    });
                }
                return original.call(this, ...args);
            });
    }

    _clearNotifications() {
        for (const source of Main.messageTray.getSources()) {
            for (const notification of [...source.notifications])
                notification.destroy(NotificationDestroyedReason.DISMISSED);
        }
    }
}
