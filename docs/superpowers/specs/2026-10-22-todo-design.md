# Todo: a plain task list in the top bar

New extension `extensions/todo/` replacing Todo.txt (`todo.txt@bart.libert.gmail.com`,
EGO v44 running; the repo copy in `extensions/todo-txt/` is v56 and declares only Shell
51, so it does not run here). Target: GNOME Shell 46, X11.

## Why

The user wants a much simpler to-do list than Todo.txt: just list tasks, tick them off,
delete them. Todo.txt brings the whole todo.txt syntax (`(A)` priorities, `+project`,
`@context`, dates, separate `done.txt`), a large preferences window and a build step; none
of it is used. Its priority letters are replaced by one idea: the order of the list is the
priority, and the user sets it by dragging.

The current `todo.txt`/`done.txt` hold only test lines, so nothing is migrated.

## Goals

- Add a task by typing in the popup and pressing Enter.
- Click a task to mark it done; done tasks move below the pending ones.
- Click a done task to make it pending again.
- Delete any task (pending or done).
- Reorder pending tasks by drag and drop; the order is the priority.
- Show the number of pending tasks in the top bar.
- Keep tasks across shell restarts and logouts.

## Non-goals

- Editing a task's text after it is created (my call; delete and re-add instead).
- Priorities, projects, contexts, due dates, reminders, notifications.
- todo.txt file format or compatibility with other todo.txt tools.
- Preferences window or settings of any kind.
- Reordering done tasks, multiple lists, sync between machines.
- Keyboard shortcut to open the popup.

## Anti-goals

- Losing tasks: a crash, a shell restart or a malformed file must never wipe the list.
- Losing the drag-and-drop order (it is the only priority there is).
- A bar item that is wide or wordy: the user wants the bar compact.

## Look

Approved mockup: `.superpowers/brainstorm/296152-1792686398/content/todo-design.html`
(local, gitignored). It follows the System Monitor style (`extensions/system-monitor/
stylesheet.css`): popup colours from the shell theme, titles `#e0e0e0`, secondary text
`#9a9a9a`/`#ccc`, thin `rgba(255,255,255,.12)` separators.

### Top bar

- A checkbox symbolic icon followed by the number of pending tasks (`☑ 3`).
- With no pending tasks, only the icon.
- At the far left of the bar, as wide as the Ubuntu Dock on the primary monitor, with
  its content centred, so it caps the dock's column (user's request after first use). It
  follows the dock's width; with no dock it takes its natural width.

### Popup

From top to bottom:

1. A text entry with the hint `New task…`. It gets keyboard focus when the popup opens.
   Enter adds the trimmed text as a pending task **at the top** of the list and clears the
   entry; empty or whitespace-only text is ignored. The popup stays open, so several tasks
   can be added in a row.
2. Pending tasks, one row each: drag handle (`⋮⋮`), text in the normal (white) popup
   text colour, `✕`. No checkbox (removed after trying it: too big, the row itself is the
   control).
3. A section header `Done · N` with a thin rule, shown only when there are done tasks.
4. Done tasks: no handle, text dimmed (no strike-through: the user found dimming
   enough), `✕`. Most
   recently completed first.
5. With no tasks at all: a dimmed `No tasks` under the entry.

Details:

- Row hover highlights the row; the `✕` is faint and becomes fully visible on hover.
- Long text wraps (my call; the popup has a fixed width of about 320 px as in the mockup,
  so it doesn't grow with long tasks).
- If the list gets taller than the screen allows, the task area scrolls; the entry stays
  at the top.
- Bar and popup text in English, like the rest of the system.

## Behaviour

- **Click** a pending task's text: it moves to the top of Done.
- **Click** a done task's text: it moves to the end of the pending list.
- **`✕`**: deletes the task immediately, no confirmation, no undo.
- **Drag** a pending task by its handle: while dragging, a blue line (`#3584e4`) shows
  where it will drop and the original row is faded. Dropping places it there. Only within
  the pending list; done tasks cannot be dragged and dropping into the Done area does
  nothing.
- Clicking a task, `✕` or the handle must not close the popup. Pressing the handle
  without dragging does not toggle the task.
- Every change is saved right away.

## Storage

- One JSON file at `~/.local/share/todo@emanuel36/tasks.json`, with the tasks in display
  order (pending in priority order, then done most recent first). Each task needs at least
  its text and whether it is done. Exact shape is the builder's.
- Written atomically (write to a temp file, then rename) so a crash mid-write never leaves
  a truncated file.
- Missing file: start with an empty list. Unreadable or malformed file: start empty, log
  the error, and move the bad file aside (e.g. `tasks.json.bad`) instead of overwriting it.
- No GSettings schema.

## Constraints

- GNOME Shell 46, ESM extension API, plain JavaScript, no build step.
- UUID `todo@emanuel36`, name "Todo" (my call); no `_generated` key.
- Register the indicator with `Main.panel.addToStatusArea` so Panel Tidy can order it.
- License MIT, like `panel-tidy` and `window-layout`: written from scratch, no code from
  Todo.txt.
- Repo rules: 100-char lines, absolute imports only (sibling `./` imports are fine), pure
  logic (add, toggle, delete, move, parse/serialize) in a module without shell imports,
  unit-checked with `gjs -m` like `extensions/panel-tidy/order.test.js`.
- Drag and drop: the shell's `resource:///org/gnome/shell/ui/dnd.js` is the expected
  tool; it is the riskiest part of the build, so try it early.
- `disable()` destroys the indicator, disconnects everything and drops all references.

## Rollout

- Install as a link from the repo into `~/.local/share/gnome-shell/extensions/`, like the
  other extensions written here; enable; restart the shell.
- Panel Tidy: its saved `left-box-order` lists `todoTxt`; set it to
  `['todo@emanuel36', 'activities', 'next-up@emanuel36']` (far left, see Top bar) and drop
  the stale `'todoTxt'` entry from `item-names`, via `dconf`. The indicator itself is
  added first in the left box too, so it lands there even without Panel Tidy.
- Disable and uninstall `todo.txt@bart.libert.gmail.com`, remove it from
  `enabled-extensions`, reset its dconf path
  (`/org/gnome/shell/extensions/TodoTxt/`), and delete `~/.local/share/todo.txt/`
  (test data only).
- **Delete `extensions/todo-txt/` from the repo** (replace, don't deprecate). Update the
  root README tables and the context doc.

## Left to the builder

- Module split, JSON shape, CSS class names.
- How drag and drop is wired (drag actor, drop target, computing the insert index).
- The bar icon name, as long as it is a symbolic checkbox-like icon from the theme.
- How the popup is built (a custom `PopupBaseMenuItem` per row, or plain St widgets in one
  section), as long as clicks inside it don't close the menu.
