# Todo

GNOME Shell 46 extension with a plain task list in the top bar. The bar shows how many
tasks are pending. In the popup, type a task and press Enter to add it on top, click it to
move it down to Done (click again to bring it back), and use ✕ to delete any task. Drag a
pending task by its handle to change the order: the order is the priority.

Tasks are saved in `~/.local/share/todo@emanuel36/tasks.json`. A file that can't be read
is moved to `tasks.json.bad` and the list starts empty.

Replaces Todo.txt on this machine. Design: `docs/superpowers/specs/2026-10-22-todo-design.md`.

## Tests

```bash
gjs -m extensions/todo/tasks.test.js
gjs -m extensions/todo/store.test.js
```
