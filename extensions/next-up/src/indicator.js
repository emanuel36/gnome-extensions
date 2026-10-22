// Modified 2026-10-22 by emanuel36: events now come from the date menu (see extension.js);
// calendar icon, faded hint label, hidden when there is nothing to show; clicking opens a
// list of today's events (instead of the date menu) that launches the calendar app.

import Clutter from "gi://Clutter";
import Gio from "gi://Gio";
import Pango from "gi://Pango";
import St from "gi://St";
import * as Main from "resource:///org/gnome/shell/ui/main.js";
import * as PanelMenu from "resource:///org/gnome/shell/ui/panelMenu.js";
import { gettext as _ } from "resource:///org/gnome/shell/extensions/extension.js";

import * as DateHelperFunctions from "./date.js";

const HINT_OPACITY = 150;

function label(text, styleClass) {
  return new St.Label({ text, style_class: styleClass, y_align: Clutter.ActorAlign.CENTER });
}

function rule() {
  return new St.Widget({
    style_class: "next-up-rule",
    x_expand: true,
    y_align: Clutter.ActorAlign.CENTER,
  });
}

// Same choice as the date menu's events section
function getCalendarApp() {
  const apps = Gio.AppInfo.get_recommended_for_type("text/calendar");
  if (apps.length === 0) return null;

  const app = Gio.AppInfo.get_default_for_type("text/calendar", false);
  return apps.some((a) => a.equal(app)) ? app : apps[0];
}

function launchCalendarApp(app) {
  Main.overview.hide();
  const context = global.create_app_launch_context(0, -1);
  if (app.get_id() === "org.gnome.Evolution.desktop") app.launch_action("calendar", context);
  else app.launch([], context);
}

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

  // Same look as the Todo popup: plain widgets, not menu items, which the theme would
  // grey out when not activatable
  _initialiseMenu() {
    this._events = [];

    const box = new St.BoxLayout({ vertical: true, style_class: "next-up-popup" });
    this.menu.box.add_child(box);

    this._header = new St.Label({ x_expand: true });
    const header = new St.BoxLayout({ style_class: "next-up-header" });
    header.add_child(this._header);
    header.add_child(rule());
    box.add_child(header);

    this._list = new St.BoxLayout({ vertical: true });
    box.add_child(this._list);

    box.add_child(rule());
    const settings = this._row([
      new St.Icon({ icon_name: "emblem-system-symbolic", style_class: "next-up-icon" }),
      label("Settings", "next-up-secondary"),
    ]);
    settings.connect("clicked", () => {
      this.menu.close();
      this._openPrefsCallback();
    });
    box.add_child(settings);

    // Rows are built on open, so past/current reflect the time the menu was opened
    this.menu.connect("open-state-changed", (_menu, open) => {
      if (open) this._buildEventRows();
    });
  }

  _row(children, styleClass = "next-up-row") {
    const content = new St.BoxLayout({ x_expand: true });
    children.forEach((c) => content.add_child(c));
    return new St.Button({
      style_class: styleClass,
      x_expand: true,
      can_focus: true,
      child: content,
    });
  }

  _buildEventRows() {
    this._list.destroy_all_children();

    const rows = DateHelperFunctions.getEventListRows(this._events);
    this._header.text = rows.length === 0 ? _("Today") : `${_("Today")} · ${rows.length}`;
    if (rows.length === 0) {
      this._list.add_child(label(_("No events"), "next-up-empty"));
      return;
    }

    const calendarApp = getCalendarApp();
    for (const row of rows) {
      // The dot marks the meeting in progress; other rows keep an empty slot to line up
      const dot = new St.Widget({
        style_class: row.state === "current" ? "next-up-dot next-up-dot-now" : "next-up-dot",
        y_align: Clutter.ActorAlign.CENTER,
      });
      const summary = label(row.summary, "next-up-text");
      summary.x_expand = true;
      summary.clutter_text.ellipsize = Pango.EllipsizeMode.END;

      const button = this._row(
        [dot, label(row.time, "next-up-time"), summary],
        row.state === "past" ? "next-up-row next-up-row-past" : "next-up-row"
      );
      button.reactive = calendarApp !== null;
      button.connect("clicked", () => {
        this.menu.close();
        launchCalendarApp(calendarApp);
      });
      this._list.add_child(button);
    }
  }

  // Today's events, listed in the popup the next time it opens
  setEvents(events) {
    this._events = events;
  }

  // `status` is `{text, hint}`, or null to hide the indicator
  setStatus(status) {
    this.container.visible = status !== null;
    if (status === null) return;

    this.text.set_text(status.text);
    this.hint.set_text(status.hint);
  }
}
