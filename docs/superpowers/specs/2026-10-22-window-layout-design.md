# Window Layout extension

## Why

Undocking the laptop, redocking it, and restarting GNOME Shell while developing extensions
all leave windows in a layout I then fix by hand. This extension puts them back.

## Layout

- **Two or more monitors:** the side monitor is the first non-primary portrait monitor
  (fallback: first non-primary). Slack takes the top 60% of its work area. Discord or
  ZapZap take the bottom 40%; when both are open they share the slot and Discord ends up
  on top. Both slots span the full monitor width with no gap. Every other normal window is
  maximized on the primary monitor.
- **One monitor:** every normal window is maximized on it, side apps included.
- Apps are matched by WM_CLASS, case-insensitive: `slack`, `discord`, `zapzap`.

## Triggers

- `monitors-changed`, debounced 2 s so docking settles first.
- Shell startup (login or X11 restart), 2 s after `startup-complete`.
- Shortcut Super+Shift+W (gsettings key `apply-layout`).

The extension declares the `unlock-dialog` session mode so it is not disabled on lock:
otherwise a dock or undock while locked would be missed, and every unlock would re-run the
startup arrangement.

## Calls made without asking

- Only the oldest window of each side app is tiled; extra windows of those apps (Slack
  huddles, a second Discord window) are left alone.
- Fullscreen windows, dialogs, and skip-taskbar windows are left alone.
- "Full screen" for the other apps means maximized, which is how they were already used.
- Windows opened after a trigger are not arranged automatically; use the shortcut.
- License: MIT. Only GNOME Shell 46 is declared.

## Code

`layout.js` holds the pure planning logic and is covered by `layout.test.js`
(`gjs -m extensions/window-layout/layout.test.js`). `extension.js` only reads monitors and
windows from Mutter and applies the plan.
