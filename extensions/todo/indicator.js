// The panel button (pending count) and its popup: entry, pending tasks, done tasks.

import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Pango from 'gi://Pango';
import St from 'gi://St';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';

import {loadTasks, saveTasks} from './store.js';
import {addTask, deleteTask, pendingCount, toggleTask} from './tasks.js';

// St's CSS has no opacity: the delete button is faded on the actor until its row is hovered
const DELETE_FADED = 90;
const MAX_LIST_SHARE = 0.6;

export const TodoIndicator = GObject.registerClass(
class TodoIndicator extends PanelMenu.Button {
    _init(path) {
        super._init(0.0, 'Todo');
        this._path = path;
        this._tasks = loadTasks(path);

        const bar = new St.BoxLayout({style_class: 'panel-status-menu-box'});
        bar.add_child(new St.Icon({
            icon_name: 'checkbox-checked-symbolic',
            style_class: 'system-status-icon',
        }));
        this._count = new St.Label({
            style_class: 'todo-bar-count',
            y_align: Clutter.ActorAlign.CENTER,
        });
        bar.add_child(this._count);
        this.add_child(bar);

        // Plain widgets, not menu items: clicks on rows never close the menu, and a
        // non-activatable item would be themed as insensitive (grey text)
        const box = new St.BoxLayout({vertical: true, style_class: 'todo-popup'});
        this.menu.box.add_child(box);

        this._entry = new St.Entry({
            hint_text: 'New task…',
            style_class: 'todo-entry',
            can_focus: true,
            x_expand: true,
        });
        this._entry.clutter_text.connect('activate', () => {
            const text = this._entry.get_text();
            this._entry.set_text('');
            this._apply(addTask(this._tasks, text, GLib.uuid_string_random()));
        });
        box.add_child(this._entry);

        this._list = new St.BoxLayout({vertical: true, style_class: 'todo-list'});
        this._scroll = new St.ScrollView({
            hscrollbar_policy: St.PolicyType.NEVER,
            vscrollbar_policy: St.PolicyType.AUTOMATIC,
            overlay_scrollbars: true,
            child: this._list,
        });
        box.add_child(this._scroll);

        this.menu.connect('open-state-changed', (menu, open) => {
            if (open)
                this._onOpen();
        });
        this.connect('destroy', () => {
            if (this._focusId)
                GLib.source_remove(this._focusId);
            this._focusId = 0;
        });

        this._rebuild();
    }

    _onOpen() {
        const monitor = Main.layoutManager.primaryMonitor;
        this._scroll.style = `max-height: ${Math.floor(monitor.height * MAX_LIST_SHARE)}px;`;
        // The menu takes key focus while opening: give it to the entry right after
        if (this._focusId)
            GLib.source_remove(this._focusId);
        this._focusId = GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
            this._focusId = 0;
            this._entry.grab_key_focus();
            return GLib.SOURCE_REMOVE;
        });
    }

    _apply(tasks) {
        if (tasks === this._tasks)
            return;
        this._tasks = tasks;
        try {
            saveTasks(this._path, tasks);
        } catch (e) {
            console.error(`Todo: saving ${this._path} failed: ${e.message}`);
        }
        this._rebuild();
    }

    // Each click rebuilds the list, so the second click of a double click would land on
    // the row that moved under the pointer (deleting or toggling a second task)
    _onClick(change) {
        const now = GLib.get_monotonic_time();
        const doubleClickUs = Clutter.Settings.get_default().double_click_time * 1000;
        if (now - (this._lastClickUs ?? 0) < doubleClickUs)
            return;
        this._lastClickUs = now;
        this._apply(change());
    }

    _rebuild() {
        const pending = pendingCount(this._tasks);
        this._count.text = String(pending);
        this._count.visible = pending > 0;

        this._list.destroy_all_children();
        if (!this._tasks.length) {
            this._list.add_child(new St.Label({
                text: 'No tasks',
                style_class: 'todo-empty',
                x_align: Clutter.ActorAlign.CENTER,
            }));
            return;
        }
        const done = this._tasks.length - pending;
        for (const [i, task] of this._tasks.entries()) {
            if (i === pending)
                this._list.add_child(this._doneHeader(done));
            this._list.add_child(this._row(task));
        }
    }

    _doneHeader(count) {
        const header = new St.BoxLayout({style_class: 'todo-done-header'});
        header.add_child(new St.Label({text: `Done · ${count}`}));
        header.add_child(new St.Widget({
            style_class: 'todo-rule',
            x_expand: true,
            y_align: Clutter.ActorAlign.CENTER,
        }));
        return header;
    }

    _row(task) {
        const row = new St.BoxLayout({
            style_class: task.done ? 'todo-row todo-row-done' : 'todo-row',
            reactive: true,
            track_hover: true,
        });

        // Done rows keep an empty slot so their text lines up with pending ones
        row.add_child(task.done
            ? new St.Widget({style_class: 'todo-handle'})
            : new St.Icon({icon_name: 'list-drag-handle-symbolic', style_class: 'todo-handle'}));

        const label = new St.Label({
            text: task.text,
            style_class: 'todo-text',
            reactive: true,
            x_expand: true,
            y_align: Clutter.ActorAlign.CENTER,
        });
        label.clutter_text.line_wrap = true;
        label.clutter_text.line_wrap_mode = Pango.WrapMode.WORD_CHAR;
        label.clutter_text.ellipsize = Pango.EllipsizeMode.NONE;
        // The text is the toggle: clicking it marks the task done or pending again
        const click = new Clutter.ClickAction();
        click.connect('clicked', () => this._onClick(() => toggleTask(this._tasks, task.id)));
        label.add_action(click);
        row.add_child(label);

        const remove = new St.Button({
            style_class: 'todo-delete',
            opacity: DELETE_FADED,
            y_align: Clutter.ActorAlign.CENTER,
            child: new St.Icon({icon_name: 'window-close-symbolic'}),
        });
        remove.connect('clicked', () => this._onClick(() => deleteTask(this._tasks, task.id)));
        row.connect('notify::hover', () => {
            remove.opacity = row.hover ? 255 : DELETE_FADED;
        });
        row.add_child(remove);

        return row;
    }
});
