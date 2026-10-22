/* extension.js
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 2 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 *
 * SPDX-License-Identifier: GPL-2.0-or-later
 *
 * Modified 2026-10-22 by emanuel36: read events from the date menu's event source and
 * refresh when it changes; remove the indicator from whichever box holds it on disable;
 * compact text, hidden when nothing is left, no confetti icon; register the indicator in
 * the panel's status area; pass today's events to the indicator for its popup.
 */

import GLib from "gi://GLib";
import GObject from "gi://GObject";

import * as Main from "resource:///org/gnome/shell/ui/main.js";
import { Extension } from "resource:///org/gnome/shell/extensions/extension.js";

import Indicator from "./src/indicator.js";
import * as DateHelperFunctions from "./src/date.js";

const IndicatorInstance = GObject.registerClass(Indicator);

export default class NextUpExtension extends Extension {
  enable() {
    this._indicator = new IndicatorInstance({
      openPrefsCallback: this.openPreferences.bind(this),
    });

    this._dateMenu = Main.panel.statusArea.dateMenu;

    this._settings = this.getSettings();
    this._settingChangedSignal = this._settings.connect(
      "changed::which-panel",
      () => {
        this.unloadIndicator();
        this.loadIndicator();
      }
    );

    // Wait 3 seconds before loading the indicator
    // So that it isn't loaded too early and positioned after other elements in the panel
    this.delaySourceId = GLib.timeout_add_seconds(
      GLib.PRIORITY_DEFAULT,
      3,
      () => {
        this.loadIndicator();
        this.refreshIndicator();
        this._startLoop();

        return false;
      }
    );
  }

  _startLoop() {
    this.sourceId = GLib.timeout_add_seconds(
      GLib.PRIORITY_DEFAULT,
      5, // seconds to wait
      () => {
        this.refreshIndicator();

        return GLib.SOURCE_CONTINUE;
      }
    );
  }

  // Registered in the panel's status area, so tools that order the top bar (Panel Tidy)
  // see it like any other item
  loadIndicator() {
    const whichPanel = this._settings.get_int("which-panel");

    // If aligned to left, place it after workspaces indicator
    const index = whichPanel === 0 ? 1 : 0;

    if (Main.panel.statusArea[this.uuid]) {
      const boxes = [
        Main.panel._leftBox,
        Main.panel._centerBox,
        Main.panel._rightBox,
      ];
      boxes[whichPanel].insert_child_at_index(this._indicator.container, index);
    } else {
      const box = ["left", "center", "right"][whichPanel];
      Main.panel.addToStatusArea(this.uuid, this._indicator, index, box);
    }
  }

  unloadIndicator() {
    this._indicator.container
      .get_parent()
      ?.remove_child(this._indicator.container);
  }

  // Use the date menu's event source: the calendar server keeps a single requested range,
  // set by the date menu. A source of our own only got events when the date menu happened
  // to request a new range, and requesting one ourselves would change it for the date menu.
  _getEventSource() {
    // The date menu replaces its source when the session mode changes (e.g. unlock)
    const source = this._dateMenu._eventSource;
    if (source !== this._eventSource) {
      this._disconnectEventSource();
      this._eventSource = source;
      this._eventSourceChangedId = source.connect("changed", () =>
        this.refreshIndicator()
      );
    }

    this._ensureTodayRequested(source);
    return source;
  }

  // Browsing to another month in the date menu moves the requested range away from today
  // until the menu opens again; select today, as opening the menu would
  _ensureTodayRequested(source) {
    const begin = source._lastRequestBegin;
    const end = source._lastRequestEnd;
    if (!begin || !end || this._dateMenu.menu.isOpen) return;

    const now = new Date();
    if (now < begin || now >= end) this._dateMenu._calendar.setDate(now);
  }

  _disconnectEventSource() {
    if (this._eventSourceChangedId) {
      this._eventSource.disconnect(this._eventSourceChangedId);
      this._eventSourceChangedId = null;
    }
    this._eventSource = null;
  }

  refreshIndicator() {
    const todaysEvents = DateHelperFunctions.getTodaysEvents(
      this._getEventSource()
    );
    this._indicator.setEvents(todaysEvents);
    const eventStatus =
      DateHelperFunctions.getNextEventsToDisplay(todaysEvents);
    this._indicator.setStatus(
      DateHelperFunctions.eventStatusToIndicatorText(eventStatus)
    );
  }

  disable() {
    this.unloadIndicator();
    this._disconnectEventSource();
    this._dateMenu = null;

    this._settings.disconnect(this._settingChangedSignal);
    this._settings = null;

    this._indicator.destroy();
    this._indicator = null;

    if (this.sourceId) {
      GLib.Source.remove(this.sourceId);
      this.sourceId = null;
    }

    if (this.delaySourceId) {
      GLib.Source.remove(this.delaySourceId);
      this.delaySourceId = null;
    }
  }
}
