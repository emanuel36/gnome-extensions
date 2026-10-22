# Panel Tidy

GNOME Shell 46 extension that orders the top bar items across the left, center and right
boxes, and hides the top bar items and Quick Settings toggles you don't use. Everything
is set in its preferences window (drag rows to reorder, switches to show or hide) and
applies immediately.

It never overrides shell functions: it only reacts when items appear on the bar or in
Quick Settings, so other extensions add their items exactly as without it. A new item is
left where its extension put it and shown; it then appears in the preferences window.
Disabling the extension shows everything it hid.

Items are saved by their panel role, except app icons (appindicators), whose roles change
every time the app starts: they are saved by app id, or by window class for legacy tray
icons. Extensions that insert their button into the panel boxes directly, without
`Main.panel.addToStatusArea`, are not seen.

Replaces Top Bar Organizer and Just Perfection on this machine. Design:
`docs/superpowers/specs/2026-10-22-panel-tidy-design.md`.

## Tests

```bash
gjs -m extensions/panel-tidy/order.test.js
```

## Credits

The appindicator key format (`appindicator-kstatusnotifieritem-<app id>`) follows
[Top Bar Organizer](https://gitlab.gnome.org/june/top-bar-organizer), so its saved order
could be carried over; no code was copied.
