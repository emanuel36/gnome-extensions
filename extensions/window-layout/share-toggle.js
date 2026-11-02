import GObject from 'gi://GObject';
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import {QuickMenuToggle, SystemIndicator} from 'resource:///org/gnome/shell/ui/quickSettings.js';

import {isNormal} from './share-mode.js';

const ICON = 'screen-shared-symbolic';

// Panel Tidy lists Quick Settings toggles by class name
const ShareModeToggle = GObject.registerClass(
class ShareModeToggle extends QuickMenuToggle {
    _init() {
        super._init({title: 'Share Mode', iconName: ICON, toggleMode: false});
        this.menu.setHeader(ICON, 'Share Mode', 'Share a window');
        this._windows = new PopupMenu.PopupMenuSection();
        this.menu.addMenuItem(this._windows);
    }
});

// The Share Mode toggle, whose menu lists the windows to share, plus a bar icon shown while
// the mode is on. Clicking the toggle turns the mode off, or opens the list when it is off.
export const ShareModeIndicator = GObject.registerClass(
class ShareModeIndicator extends SystemIndicator {
    _init(shareMode) {
        super._init();
        this._shareMode = shareMode;
        this._icon = this._addIndicator();
        this._icon.icon_name = ICON;

        this._toggle = new ShareModeToggle();
        this._toggle.connect('clicked', () => {
            // The inner toggle stays clickable when the outer one is not reactive
            if (this._shareMode.active)
                this._shareMode.stop();
            else if (global.display.get_n_monitors() >= 2)
                this._toggle.menu.open();
        });
        this._toggle.menu.connect('open-state-changed', (_menu, open) => {
            if (open)
                this._listWindows();
        });
        this.quickSettingsItems.push(this._toggle);

        this._sessionModeId = Main.sessionMode.connect('updated', () => this.sync());
        this.sync();
    }

    _listWindows() {
        const section = this._toggle._windows;
        section.removeAll();
        const tracker = Shell.WindowTracker.get_default();
        const windows = global.display.get_tab_list(Meta.TabList.NORMAL_ALL, null);
        for (const win of windows.filter(isNormal)) {
            const app = tracker.get_window_app(win);
            const item = new PopupMenu.PopupImageMenuItem(win.get_title() ?? '',
                app?.get_icon() ?? 'application-x-executable-symbolic');
            item.connect('activate', () => {
                Main.panel.closeQuickSettings();
                this._shareMode.start(win);
            });
            section.addMenuItem(item);
        }
    }

    sync() {
        const active = this._shareMode.active;
        const enough = global.display.get_n_monitors() >= 2;
        const shared = this._shareMode.sharedWindow;
        this._toggle.checked = active;
        this._toggle.reactive = enough || active;
        if (!enough && !active)
            this._toggle.subtitle = 'Needs two monitors';
        else if (active && shared)
            this._toggle.subtitle = Shell.WindowTracker.get_default().get_window_app(shared)
                ?.get_name() ?? null;
        else
            this._toggle.subtitle = null;
        this._toggle.visible = !Main.sessionMode.isLocked;
        this._icon.visible = active;
    }

    destroy() {
        Main.sessionMode.disconnect(this._sessionModeId);
        this.quickSettingsItems.forEach(item => item.destroy());
        super.destroy();
    }
});
