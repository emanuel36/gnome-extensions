# Share Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Share Mode toggle to Window Layout that leaves only a chosen window on the
primary monitor during screen sharing and puts everything back afterwards.

**Architecture:** Pure planning in `share.js` (where each window goes, restore, dock offset,
switcher offset), tested with `gjs -m`. A `ShareMode` controller in `share-mode.js` applies
the plans and owns all system changes (windows, dock, banners, notifications, Alt+Tab
patch, new-window redirect) with a single `start`/`stop` pair. A `QuickMenuToggle` in
`share-toggle.js` lists windows. `extension.js` wires them and skips Window Layout's own
arrangement while the mode is on.

**Tech Stack:** GJS, GNOME Shell 46 ESM extension API, Mutter `Meta`, `Gio.Settings`.

**Spec:** `docs/superpowers/specs/2026-10-31-share-mode-design.md`

## Global Constraints

- GNOME Shell 46, X11; plain JavaScript, no build step.
- Stays in `window-layout@emanuel36`; no `_generated` key; license MIT.
- 100-char lines; absolute imports, sibling `./` imports fine; Google-style JSDoc on
  non-trivial exports.
- Pure modules import nothing from the shell.
- UI text in English: title `Share Mode`, menu header `Share a window`, subtitle
  `Needs two monitors` with fewer than two monitors, subtitle while on = shared window's
  app name.
- Icon `screen-shared-symbolic` (present in Adwaita and Yaru).
- "Secondary" monitor = `sideMonitorIndex(monitors, primary)` from `layout.js`.
- Normal window = type NORMAL, not skip-taskbar, not transient (same filter as
  `extension.js` `_apply`, minus the fullscreen and wm-class checks).
- Every system change made by `start` is undone by `stop`, and `disable()` calls `stop`.
- Commits: Conventional Commits, scope `window-layout`, subject ≤50 chars, body bullets
  ≤72 chars, ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **A window bigger than the secondary monitor** (1920-wide window onto a 1080-wide
   portrait monitor) must end fully on it, shrunk to fit. Test in Task 1.
2. **Switching the shared window while on** must not overwrite the positions saved at the
   first turn on, or turning off restores to the mode's own layout. Test in Task 1
   (`mergeSaved`).
3. **A window closed during the mode** must be skipped on restore, not crash it. Test in
   Task 1 (`planRestore`).
4. **Primary monitor not at index 0** (dock setting is an offset from the primary). Test in
   Task 1 (`dockOffset`).
5. **Minimized windows and windows on other workspaces on the primary monitor** move too;
   otherwise they appear on the shared screen when restored or switched to. Test in Task 1
   (`planShare` ignores those states; the controller passes all normal windows).

---

### Task 1: Pure planning module

**Files:**
- Create: `extensions/window-layout/share.js`
- Test: `extensions/window-layout/share.test.js`
- Modify: `CLAUDE.md` (add `gjs -m extensions/window-layout/share.test.js` to the test
  list, after the `layout.test.js` line)

**Interfaces:**
- Consumes: `sideMonitorIndex(monitors, primaryIndex)` from `./layout.js`.
- Produces (all exported from `share.js`):
  - `type Rect = {x, y, width, height}`; `type Area = Rect & {index}` (a monitor work area,
    the shape `layout.js` already uses).
  - `placeOn(rect: Rect, from: Rect, to: Rect) -> Rect`: keeps the offset from `from`'s
    top-left, shrinks width/height to at most `to`'s, then shifts so the result lies
    inside `to`.
  - `planShare(monitors: Area[], primaryIndex: number, windows: Array<{id, monitor:
    number, rect: Rect}>, sharedId) -> Array<{id, monitor: number, rect: Rect}>`: one entry
    per window to move. The shared window gets an entry only if it is not on the primary;
    every other window on the primary gets an entry to the secondary. Windows on other
    monitors get none. Returns `[]` when there is no secondary monitor.
  - `mergeSaved(saved: Object<id, S>, current: Object<id, S>) -> Object<id, S>`: entries of
    `saved` win; ids only in `current` are added.
  - `planRestore(saved: Object<id, S>, openIds: Set) -> Array<[id, S]>`: saved entries
    whose id is still open.
  - `dockOffset(primaryIndex: number, targetIndex: number, count: number) -> number`: the
    value of Ubuntu Dock's `preferred-monitor` that selects `targetIndex` (the dock reads
    it as `(primaryIndex + value) % count`).
  - `centerOffset(from: Rect, to: Rect) -> {x, y}`: integer translation that moves the
    centre of `from` onto the centre of `to`.

- [ ] **Step 1: Write the failing tests** in `share.test.js`, using the same `check(name,
  actual, expected)` JSON-compare helper and exit code as `layout.test.js`, with these
  areas: `MAIN = {index: 0, x: 1080, y: 32, width: 1920, height: 1048}`,
  `PORTRAIT = {index: 1, x: 0, y: 0, width: 1080, height: 1920}`.

```js
check('placeOn keeps the offset',
    placeOn({x: 1180, y: 132, width: 800, height: 600}, MAIN, PORTRAIT),
    {x: 100, y: 100, width: 800, height: 600});
check('placeOn shrinks a window wider than the target',
    placeOn({x: 1080, y: 32, width: 1920, height: 1048}, MAIN, PORTRAIT),
    {x: 0, y: 0, width: 1080, height: 1048});
check('placeOn shifts a window back inside',
    placeOn({x: 2500, y: 32, width: 400, height: 300}, MAIN, PORTRAIT),
    {x: 680, y: 0, width: 400, height: 300});

const wins = [
    {id: 'chrome', monitor: 0, rect: {x: 1180, y: 132, width: 800, height: 600}},
    {id: 'term', monitor: 0, rect: {x: 1080, y: 32, width: 1920, height: 1048}},
    {id: 'slack', monitor: 1, rect: {x: 0, y: 0, width: 1080, height: 1152}},
];
check('share a window already on the primary', planShare([MAIN, PORTRAIT], 0, wins, 'chrome'),
    [{id: 'term', monitor: 1, rect: {x: 0, y: 0, width: 1080, height: 1048}}]);
check('share a window from the secondary', planShare([MAIN, PORTRAIT], 0, wins, 'slack'), [
    {id: 'slack', monitor: 0, rect: {x: 1080, y: 32, width: 1080, height: 1048}},
    {id: 'chrome', monitor: 1, rect: {x: 100, y: 100, width: 800, height: 600}},
    {id: 'term', monitor: 1, rect: {x: 0, y: 0, width: 1080, height: 1048}},
]);
check('no secondary monitor, no plan', planShare([MAIN], 0, wins, 'chrome'), []);

check('saved positions survive a switch',
    mergeSaved({a: 1, b: 2}, {a: 9, c: 3}), {a: 1, b: 2, c: 3});
check('restore skips closed windows',
    planRestore({a: 1, b: 2}, new Set(['b'])), [['b', 2]]);

check('dock offset, primary first', dockOffset(0, 1, 2), 1);
check('dock offset, primary second', dockOffset(1, 0, 2), 1);
check('dock offset, three monitors', dockOffset(2, 1, 3), 2);

check('switcher offset to the portrait monitor', centerOffset(MAIN, PORTRAIT),
    {x: -1500, y: 404});
```

- [ ] **Step 2: Run** `gjs -m extensions/window-layout/share.test.js`
  Expected: fails with a module import error (`share.js` missing).

- [ ] **Step 3: Implement `share.js`** with the signatures above. Header comment like
  `layout.js` ("Pure share-mode planning: no GNOME imports..."). In `planShare`, the
  shared window's entry comes first, then the others in input order.

- [ ] **Step 4: Run** `gjs -m extensions/window-layout/share.test.js` and
  `gjs -m extensions/window-layout/layout.test.js`
  Expected: every line `ok`, exit code 0.

- [ ] **Step 5: Commit** `share.js`, `share.test.js`, `CLAUDE.md`:
  `feat(window-layout): plan share mode moves`.

### Task 2: ShareMode controller: turn on and off

**Files:**
- Create: `extensions/window-layout/share-mode.js`
- Modify: `extensions/window-layout/schemas/org.gnome.shell.extensions.window-layout.gschema.xml`
  (+ recompile `gschemas.compiled` with `glib-compile-schemas extensions/window-layout/schemas`)

**Interfaces:**
- Consumes: everything from Task 1.
- Produces: `export class ShareMode` in `share-mode.js`:
  - `constructor(settings: Gio.Settings, onChanged: () => void)`; on construction calls
    `recover()`.
  - `get active(): boolean`; `get sharedWindow(): Meta.Window | null`.
  - `start(window: Meta.Window)`: turn on, or switch the shared window if already on.
  - `stop({restoreWindows = true} = {})`: turn off; no-op when off.
  - `recover()`: if the `share-saved-state` key is non-empty, restore dock and banners
    from it and clear it.
  - `destroy()`: `stop()`, then drop references.
  - `onChanged` is called after every `start`/`stop` so the toggle can sync.
- Schema key: `share-saved-state`, type `s`, default `''`, summary "Share Mode saved
  state", description "Internal: dock and banner settings to restore; empty when Share
  Mode is off". JSON `{"dock": <int|null>, "banners": <bool>}`; `dock` is null when Ubuntu
  Dock's schema is not installed.

- [ ] **Step 1: Add the schema key and recompile.** Run
  `glib-compile-schemas --strict extensions/window-layout/schemas`; expected: no output.

- [ ] **Step 2: Implement `start(window)`** in this order, matching the spec's "Turn on":
  1. Collect normal windows from `global.get_window_actors()` (all workspaces, minimized
     included). For each: `{monitor: get_monitor(), rect: get_frame_rect(), maximized:
     get_maximized(), workspace: get_workspace()?.index() ?? -1}` keyed by `get_id()`.
     `this._saved = mergeSaved(this._saved ?? {}, collected)`.
  2. Work areas as in `extension.js` `_apply`; call `planShare`. For each entry:
     `move_to_monitor(monitor)`, then `move_resize_frame(true, ...rect)` only if the
     window is not maximized. Then `sharedWindow.activate(global.get_current_time())`.
  3. On first start only: write `share-saved-state` with the current dock
     `preferred-monitor` (via `Gio.SettingsSchemaSource.get_default().lookup(
     'org.gnome.shell.extensions.dash-to-dock', true)`) and `show-banners` of
     `org.gnome.desktop.notifications`; then set `preferred-monitor` to
     `dockOffset(primary, secondary, nMonitors)` and `show-banners` to false.
  4. On first start only: clear notifications: for each `Main.messageTray.getSources()`,
     destroy each of `[...source.notifications]` with
     `MessageTray.NotificationDestroyedReason.DISMISSED`.

- [ ] **Step 3: Implement `stop({restoreWindows})`**: when `restoreWindows`, for each
  `planRestore(this._saved, openIds)` entry: move back to its workspace (if ≥ 0) and
  monitor, unmaximize then `move_resize_frame` to the saved rect, and re-maximize with
  the saved flags if it was maximized. Then `recover()`, clear `_saved` and the shared
  window, call `onChanged`.

- [ ] **Step 4: Manual check** in a nested shell with two monitors, from a terminal:
  `MUTTER_DEBUG_NUM_DUMMY_MONITORS=2 dbus-run-session -- gnome-shell --nested --wayland`
  with a temporary call to `start` on the focused window from `enable()` (do not commit
  it), or from Looking Glass (`Alt+F2`, `lg`). Expected: other windows jump to the
  secondary; `gsettings get org.gnome.desktop.notifications show-banners` reads `false`
  inside the nested session; `stop()` puts them back and banners read the old value.

- [ ] **Step 5: Commit** `share-mode.js` and the schema files:
  `feat(window-layout): add share mode controller`.

### Task 3: While on: new windows and Alt+Tab

**Files:**
- Modify: `extensions/window-layout/share-mode.js`

**Interfaces:**
- Consumes: `centerOffset` (Task 1); `ShareMode` internals (Task 2).
- Produces: no new public API; `start` installs and `stop` removes both behaviours.

- [ ] **Step 1: Redirect new windows.** On first start connect
  `global.display` `window-created`; for the new window wait for its actor's
  `first-frame`, then if it is a normal window, not the shared window, and
  `get_monitor() === primary`, move it to the secondary keeping its size
  (`placeOn` from the primary to the secondary work area). Transient windows are left
  alone (dialogs of the shared window stay with it; others open over their parent on the
  secondary). Disconnect on stop, including pending `first-frame` handlers.

- [ ] **Step 2: Move the switchers.** Use `InjectionManager` from
  `resource:///org/gnome/shell/extensions/extension.js` to wrap
  `SwitcherPopup.prototype.show` (`resource:///org/gnome/shell/ui/switcherPopup.js`):
  call the original, then `this.set_translation(dx, dy, 0)` with
  `centerOffset(primaryMonitor, secondaryMonitor)` (full monitor geometry from
  `Main.layoutManager.monitors`). This covers Alt+Tab, the per-app and the window
  switchers, which all subclass `SwitcherPopup`. `clear()` the injection on stop.

- [ ] **Step 3: Manual check** in the nested shell: with the mode on, open a terminal
  (lands on the secondary); open a file dialog from the shared window (stays on the
  primary); press Alt+Tab (shown centred on the secondary, all windows listed). After
  stop, Alt+Tab is centred on the primary again and new windows open normally.

- [ ] **Step 4: Commit**: `feat(window-layout): redirect windows and Alt+Tab`.

### Task 4: Quick Settings toggle and wiring

**Files:**
- Create: `extensions/window-layout/share-toggle.js`
- Modify: `extensions/window-layout/extension.js`,
  `extensions/window-layout/metadata.json`

**Interfaces:**
- Consumes: `ShareMode` (Task 2).
- Produces: `export const ShareModeIndicator` (a `SystemIndicator`) in `share-toggle.js`:
  `constructor(shareMode: ShareMode)`, `sync()`, `destroy()`. The toggle class is
  registered as `ShareModeToggle` (Panel Tidy lists Quick Settings toggles by class name,
  see `away-mode/toggle.js`).

- [ ] **Step 1: Implement `share-toggle.js`** following `away-mode/toggle.js`:
  - `ShareModeToggle extends QuickMenuToggle`, `title: 'Share Mode'`,
    `iconName: 'screen-shared-symbolic'`, `toggleMode: false` (the extension decides).
  - Menu header `setHeader('screen-shared-symbolic', 'Share Mode', 'Share a window')`.
    On menu `open-state-changed` (open), rebuild a section with one
    `PopupImageMenuItem(title, app icon)` per normal window from
    `global.display.get_tab_list(Meta.TabList.NORMAL_ALL, null)`; app from
    `Shell.WindowTracker.get_default().get_window_app(w)`. Activating an item calls
    `shareMode.start(w)` and closes the Quick Settings menu
    (`Main.panel.closeQuickSettings()`).
  - Toggle `clicked`: when active `shareMode.stop()`, otherwise `this.menu.open()`.
  - `sync()`: `checked = active`; subtitle = app name of the shared window (or `null`)
    when on; with fewer than two monitors `reactive = false` and subtitle
    `Needs two monitors`; indicator icon visible only while on.
  - Hidden while `Main.sessionMode.isLocked`, as in Away Mode.
  - Add with `Main.panel.statusArea.quickSettings.addExternalIndicator(indicator)`.

- [ ] **Step 2: Wire `extension.js`**:
  - `enable()`: `this._shareMode = new ShareMode(this._settings, () =>
    this._indicator?.sync())`, then the indicator.
  - `_apply()`: return early when `this._shareMode.active`.
  - `monitors-changed`: if active, `this._shareMode.stop({restoreWindows: false})` before
    scheduling; also `sync()` the indicator (monitor count).
  - `disable()`: destroy indicator, then `this._shareMode.destroy()`, null both.
  - Update `metadata.json` `description` to mention Share Mode in one sentence.

- [ ] **Step 3: Tests.** Run all tests listed in `CLAUDE.md`; expected: all `ok`.

- [ ] **Step 4: Manual check in the real shell** (laptop docked): restart the shell
  (Alt+F2, `r`); run every manual check listed in the spec's Testing section, including
  Super+Shift+W during the mode (nothing moves), X11 restart mid-mode (dock and banners
  come back after the restart) and unplugging the monitor during the mode. Logs:
  `journalctl --user -b | rg -i window-layout`.

- [ ] **Step 5: Commit**: `feat(window-layout): add Share Mode toggle`.

### Task 5: Docs and mockup

**Files:**
- Modify: `extensions/window-layout/README.md`, `README.md` (row 5 description and the
  Window Layout section), `docs/superpowers/2026-10-22-contexto-inicial.md`
- Create: `docs/images/window-layout-share-mode.svg`

- [ ] **Step 1: Mockup.** An SVG in the style of `docs/images/window-layout.svg`, made-up
  data: the Quick Settings toggle `Share Mode` with its open menu `Share a window` listing
  three windows.

- [ ] **Step 2: READMEs** (user-facing only, no code or paths, per CLAUDE.md): what Share
  Mode does, how to turn it on and off, what moves and what comes back; the mockup in both
  READMEs.

- [ ] **Step 3: Context doc**: one line noting Share Mode in Window Layout.

- [ ] **Step 4: Commit**: `docs(window-layout): document Share Mode`.
