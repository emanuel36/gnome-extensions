# Share Mode: a clean primary monitor for screen sharing

New feature of the existing Window Layout extension (`extensions/window-layout/`). Target:
GNOME Shell 46, X11 (Ubuntu 24.04).

## Why

The user shares their primary monitor in calls. Everything else on it shows up too: other
windows (Discord and ZapZap hold private conversations), the dock, notification banners
and the Alt+Tab switcher. The user wants one button that leaves only the shared window on
the primary monitor and another click that puts everything back.

Prior art: Levers for macOS (leversmac.com), which tidies the screen before a share.
Brainstorm on 2026-10-31. Decisions taken by the user:

- A manual button, not automatic detection of a share.
- Part of Window Layout, not a separate extension: Window Layout already knows the side
  monitor and moves windows, and it must not rearrange windows during a share.
- Alt+Tab just moves to the secondary monitor; no filtering of apps.
- Notifications are simply cleared when the mode starts.

## Goals

- A **Share Mode** toggle in Quick Settings with a menu (arrow) listing open windows. The
  user picks the window to share; that turns the mode on.
- While on, the primary monitor shows only the chosen window:
  - every other window moves to the secondary monitor;
  - windows opened while the mode is on go straight to the secondary monitor;
  - the Ubuntu Dock moves from the primary to the secondary monitor;
  - notification banners are off, and existing notifications are cleared at turn on;
  - the Alt+Tab switcher appears on the secondary monitor;
  - Window Layout's own arrangement does not run.
- Clicking the toggle again turns the mode off and puts windows, dock and banners back as
  they were.

## Non-goals

- Detecting on its own when a call starts or stops sharing.
- Hiding specific apps anywhere (Alt+Tab, overview, the window list in the menu).
- Changing the Activities overview: on this machine each monitor's overview shows only its
  own windows (`workspaces-only-on-primary` is on), so the primary shows only the shared
  window.
- Bringing cleared notifications back.
- A backdrop behind the window, dark mode, microphone mute (other Levers features).
- Resizing or maximizing the chosen window: it keeps its size.
- Clipboard history and tray icons.
- Anything with a single monitor: the mode needs two.

## Anti-goals

- **Another window visible on the primary monitor while the mode is on**, through the
  paths the user commonly takes: Alt+Tab, a new window opening, a notification banner,
  Window Layout's own rearrangement (shortcut, startup).
- **Leaving the desktop changed after the mode ends**: dock placement and the banner
  setting come back to what they were, even after a shell restart or crash mid-mode.
- Fighting the user: while on, the user may drag a window back to the primary monitor by
  hand; the mode does not push it away again (my call).
- Changing Window Layout's behaviour while the mode is off.

## Look

- **Quick Settings toggle** with a menu, the GNOME 46 way (`QuickMenuToggle` inside a
  `SystemIndicator`), next to the system toggles. Title `Share Mode`. Subtitle while on:
  the chosen window's app name (my call). Icon: a symbolic screen-sharing-like icon from
  the theme (builder's call).
- **Menu**: header `Share a window`, then one item per open normal window (app icon +
  window title), all workspaces. Clicking an item turns the mode on with that window. If
  the mode is already on, clicking another item switches the shared window (my call): the
  new one comes to the primary monitor, the old one goes to the secondary.
- **Clicking the toggle itself** (not the arrow): when on, turns the mode off; when off,
  opens the menu (my call; there is no window to share yet).
- **Top bar**: the toggle's icon shows in the system indicator area while the mode is on
  (my call, same as Away Mode).
- With fewer than two monitors the toggle is insensitive with subtitle `Needs two
  monitors` (my call).
- The toggle is hidden on the lock screen (Window Layout runs in `unlock-dialog` too). The
  mode itself stays on while locked (my call).
- UI text in English, like the other extensions.

## Behaviour

### Which monitor is "secondary"

Window Layout's side monitor (`sideMonitorIndex`): the first non-primary portrait monitor,
or the first non-primary monitor when none is portrait.

### Turn on

1. Remember, for every normal window: its monitor, frame rectangle, maximized state and
   workspace.
2. Move the chosen window to the primary monitor if it is not there, keeping its size
   (clamped to the work area if needed), and focus it.
3. Move every other normal window on the primary monitor, on any workspace, to the
   secondary one. Maximized windows stay maximized there; others keep their size, clamped
   to fit. Windows already on other monitors stay where they are.
4. Move the dock to the secondary monitor.
5. Turn notification banners off and clear all notifications in the clock menu.

Normal window means what Window Layout already considers (type NORMAL, not skip-taskbar,
not transient); transient dialogs follow their parent.

### While on

- A new normal window that maps on the primary monitor is moved to the secondary one.
  Dialogs whose parent is the shared window stay with it (my call; sharing a file picker
  is expected).
- Alt+Tab and the other switchers (per-app, window switcher) are centered on the secondary
  monitor. Their content is unchanged. Switching to a window does not move it.
- Window Layout's arrangement (Super+Shift+W, shell startup) does nothing.
- If the shared window closes, the mode stays on until the user turns it off.
- If the monitor layout changes (a monitor unplugged or added), the mode turns off:
  dock and banners are restored, window positions are not, and Window Layout's normal
  arrangement for the new layout runs as it does today (my call: saved positions refer to
  monitors that changed).

### Turn off

- Every remembered window still open goes back to its monitor, rectangle, maximized
  state and workspace. The shared window too.
- Windows opened during the mode stay where they are.
- The dock placement and the banner setting go back to the values saved at turn on (not
  to fixed defaults).
- The Alt+Tab placement goes back to normal.

### Restarts and disable

- `disable()` with the mode on does a full turn off.
- The saved dock value is persisted in Window Layout's settings when the mode turns on and
  cleared when it turns off. On `enable()`, if it is present, the previous session ended
  mid-mode (X11 restart, crash): restore it and clear (my call). Window positions are not
  restored after a restart.
- The mode always starts off.

## Constraints

- GNOME Shell 46, ESM extension API, plain JavaScript, no build step.
- Stays in the existing `window-layout@emanuel36` extension; update its `metadata.json`
  description and its schema (new internal keys for the persisted saved state, not shown
  anywhere).
- Dock placement is Ubuntu Dock's `org.gnome.shell.extensions.dash-to-dock` settings
  (today `multi-monitor false`, `preferred-monitor-by-connector 'primary'`): point it at the
  secondary monitor's connector. If Ubuntu Dock is not installed, skip this step.
- Banners: blocked in the shell's message tray while the mode is on (critical notifications
  ignore `show-banners`), not through the setting; nothing to persist.
- Alt+Tab placement needs one patch of shell internals (`SwitcherPopup`, which centers on
  the primary monitor). It applies only while the mode is on and is undone on turn off
  and disable.
- Repo rules: 100-char lines, absolute imports (sibling `./` imports fine), pure logic
  (the move plan on turn on, the restore plan, rectangle clamping) in modules without
  shell imports, tested with `gjs -m`.
- License stays MIT (Window Layout is the user's own code).

## Testing

- Unit tests for the pure modules, added to the CLAUDE.md test list.
- Manual checks in the real shell with two monitors (the user docks the laptop): turn on
  with windows on both monitors; a maximized window; a new window during the mode; a file
  dialog from the shared window; Alt+Tab; Super+Shift+W during the mode; switch shared
  window; turn off; X11 restart mid-mode restores the dock; unplug during the
  mode.
- Two dummy monitors are possible in a nested shell (`--nested --wayland`, see CLAUDE.md)
  for early checks.

## Rollout

- Branch `feat/share-mode` in the main checkout (no worktree).
- Restart the shell.
- Update the Window Layout README, its root README row/section, and its mockup SVG (or add
  a second one for the toggle), as the repo rules say.

## Left to the builder

- Module split and file names.
- How to patch the switcher placement, as long as it is undone cleanly.
- The icon name.
- How to clamp rectangles when monitors differ in size.
