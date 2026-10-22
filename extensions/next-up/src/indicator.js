// Modified 2026-10-22 by emanuel36: events now come from the date menu (see extension.js);
// calendar icon, faded hint label, hidden when there is nothing to show.

import St from "gi://St";
import Clutter from "gi://Clutter";
import * as Main from "resource:///org/gnome/shell/ui/main.js";
import * as PanelMenu from "resource:///org/gnome/shell/ui/panelMenu.js";
import * as PopupMenu from "resource:///org/gnome/shell/ui/popupMenu.js";
import { gettext as _ } from "resource:///org/gnome/shell/extensions/extension.js";

const HINT_OPACITY = 150;

export default class Indicator extends PanelMenu.Button {
  constructor(props) {
    super();
    this._openPrefsCallback = props.openPrefsCallback;
  }

  _init() {
    super._init(0.0, _("Next Up Indicator"));

    this._loadGUI();
    this._initialiseMenu();
  }

  _loadGUI() {
    this._menuLayout = new St.BoxLayout({
      vertical: false,
      clip_to_allocation: true,
      x_align: Clutter.ActorAlign.START,
      y_align: Clutter.ActorAlign.CENTER,
      reactive: true,
      x_expand: true,
      pack_start: false,
    });

    this.icon = new St.Icon({
      icon_name: "x-office-calendar-symbolic",
      icon_size: 12,
      style_class: "system-status-icon",
    });

    this.text = new St.Label({
      y_expand: true,
      y_align: Clutter.ActorAlign.CENTER,
    });

    this.hint = new St.Label({
      style_class: "next-up-hint",
      opacity: HINT_OPACITY,
      y_expand: true,
      y_align: Clutter.ActorAlign.CENTER,
    });

    this._menuLayout.add_child(this.icon);
    this._menuLayout.add_child(this.text);
    this._menuLayout.add_child(this.hint);
    this.add_child(this._menuLayout);

    return;
  }

  _initialiseMenu() {
    const settingsItem = new PopupMenu.PopupMenuItem(_("Settings"));
    settingsItem.connect("activate", () => {
      this._openPrefsCallback();
    });
    this.menu.addMenuItem(settingsItem);
  }

  // `status` is `{text, hint}`, or null to hide the indicator
  setStatus(status) {
    this.container.visible = status !== null;
    if (status === null) return;

    this.text.set_text(status.text);
    this.hint.set_text(status.hint);
  }

  vfunc_event(event) {
    if (
      event.type() == Clutter.EventType.TOUCH_END ||
      event.type() == Clutter.EventType.BUTTON_RELEASE
    ) {
      if (event.get_button() === Clutter.BUTTON_PRIMARY) {
        // Show calendar on left click
        if (this.menu.isOpen) {
          this.menu._getTopMenu().close();
        } else {
          Main.panel.toggleCalendar();
        }
      } else {
        // Show settings menu on right click
        this.menu.toggle();
      }
    }

    return Clutter.EVENT_PROPAGATE;
  }
}
