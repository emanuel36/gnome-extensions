# Panel Tidy: order and hide top bar items

New extension `extensions/panel-tidy/` replacing Top Bar Organizer
(`top-bar-organizer@julian.gse.jsts.xyz`) and Just Perfection
(`just-perfection-desktop@just-perfection`) on this machine. Target: GNOME Shell 46, X11.
Both are already uninstalled; the bar is currently in GNOME's default state.

## Why

The user used two extensions to get one result: each top bar item where they want it,
and the items they never use hidden. Both were far bigger than that need:

- Just Perfection has ~100 settings; only 6 were changed from the default: hide the
  keyboard layout indicator, the accessibility menu, and the Quick Settings toggles
  Airplane Mode, Night Light, Dark Style and Keyboard (keyboard backlight).
- Top Bar Organizer replaces the panel's internal `Panel._addToPanelBox`, so every
  extension that adds a panel item runs through its code. A broken appindicator made it
  throw `appIndicator is undefined` and broke adding items for other extensions. This is
  the "gets in the way of the others" the user wants to avoid.

The user wants one small extension that does only these two things and never breaks
other extensions.

## Goals

- Set the order of items in the left, center and right boxes of the top bar, including
  moving an item from one box to another.
- Hide chosen top bar items (system ones such as `keyboard` and `a11y`, extensions,
  appindicators).
- Hide chosen Quick Settings toggles.
- Configure it in a preferences window; changes apply immediately, with no shell restart.

## Non-goals

- Anything else Just Perfection does (dash, OSD, workspace, search, animations...).
- Reordering Quick Settings toggles (only show/hide).
- Hiding Quick Settings sliders (volume, brightness) or the top row (battery, screenshot,
  settings, lock, power buttons).
- Styling the bar (sizes, spacing, colours).
- Multi-monitor or per-monitor layouts.

## Anti-goals

- Overriding or monkey-patching shell functions or prototypes (`_addToPanelBox`,
  `addToStatusArea`...). The extension only reacts to items that already exist.
- One bad item (a broken appindicator, an extension that destroys its button) stopping
  the extension from handling the rest, or throwing into another extension's code.
- Any visible change left behind after `disable()`: every hidden item must be visible
  again.

## Behaviour

### Top bar items

- Items are identified by their `Main.panel.statusArea` role (`dateMenu`, `quickSettings`,
  `system-monitor@emanuel36`...).
- Exception, found while building: appindicator roles carry a process id
  (`appindicator-legacy:Slack:246928`) or a D-Bus address
  (`appindicator-:1.129@/org/ayatana/...`) that change every time the app starts. App
  icons are saved as `appindicator-kstatusnotifieritem-<app id>` (Top Bar Organizer's key,
  so its saved order carries over) and legacy tray icons as
  `appindicator-legacy-<wm class>`. An app icon that has no id yet is retried when its
  indicator emits `ready`.
- `statusArea` can hold `null` entries (the appindicator extension leaves them when it
  replaces an icon); they are skipped.
- Items inserted into the panel boxes directly, without `addToStatusArea`, are not seen.
  Next Up did that; it now registers itself with `addToStatusArea` (its `which-panel`
  setting only picks the initial box).
- The saved state is, per box, an ordered list of item keys, plus a list of hidden keys.
- When the order is applied, each listed item that exists is placed in its box at its
  listed order. Items that don't exist right now (e.g. Slack closed) are skipped.
- **New item** (a role never seen before, e.g. an app installed tomorrow): left where its
  own extension put it and shown — the default behaviour (user's decision). It is added to
  the saved list at that position, so it shows up in the preferences window and can be
  moved or hidden from then on.
- Re-apply the order when items appear (a role is added to a box, e.g. an app starting or
  an extension being enabled) and when the settings change. Coalesce bursts (many items at
  login) into one pass.
- A hidden item stays hidden even if its own code shows it again (the keyboard indicator
  and `a11y` toggle their own visibility).

### Quick Settings toggles

- The window lists the toggles present in the Quick Settings menu, system ones and those
  added by extensions, each with a show/hide switch. No reordering.
- A hidden toggle stays hidden even if its own code shows it again (the keyboard backlight
  and airplane mode toggles sync their own visibility; see Just Perfection's
  `quickSettingsAirplaneModeToggleHide` and `quickSettingsBacklightToggleHide` in
  `extensions/just-perfection/src/lib/API.js` for the pattern).
- Hiding a toggle must not leave a gap in the grid.

### Preferences window

Approved mockup (tab B): `.superpowers/brainstorm/277108-1792682471/content/usabilidade.html`
(local, gitignored).

- One page with four groups: Left, Center, Right, Quick Settings.
- In the three box groups: one row per known item, drag-and-drop to reorder within a group
  and between groups, and a show/hide control per row. Hidden rows look faded.
- Quick Settings group: one row per known toggle with a show/hide control.
- Rows show a readable name, not the raw key (`Slack`, not
  `appindicator-kstatusnotifieritem-Slack_status_icon_1`; `Clock` for `dateMenu`;
  the extension's name for extension items; app icons are named from their app id or
  window class, since titles are often shared, e.g. both update-notifier icons).
- Items that are not present right now (app closed, extension disabled) are shown faded
  with a "not running" hint and a button to forget them (my call: without it the list only
  grows, as Top Bar Organizer's did with entries of removed extensions).
- The prefs process can't see shell actors: the extension records what it has seen (role,
  box, readable name; toggle id and name) in GSettings, and the window reads that.

### Disable

- Show again everything the extension hid, disconnect every signal, drop every reference.
- The order is not reverted (items stay where they are until the shell restarts); this is
  harmless and keeps `disable()` simple.

## Starting state

Seeded once at rollout (by `dconf`, not by code in the extension — my call), so the user
does not start from zero:

- Order from Top Bar Organizer's saved keys (still in dconf under
  `/org/gnome/shell/extensions/top-bar-organizer/`):
  - left: `activities`, `system-monitor@emanuel36`
  - center: `dateMenu`, `next-up@emanuel36`, `todoTxt`
    (Next Up was missing from the old list; placed after the clock, as in the mockup)
  - right: the old `right-box-order` with entries of removed extensions dropped
    (`Resource_Monitor@Ory0n`, `clipboardIndicator`, `tiling-assistant@leleat-on-github`...)
- Hidden: `keyboard`, `a11y`; Quick Settings toggles Airplane Mode, Night Light, Dark
  Style, Keyboard (backlight).

## Constraints

- GNOME Shell 46, ESM extension API. Plain JavaScript, no build step (like the other
  extensions written here). Prefs with GTK4 / libadwaita.
- UUID `panel-tidy@emanuel36`; no `_generated` key. Name "Panel Tidy" is my call.
- License MIT, like `window-layout`: no code was taken from Top Bar Organizer or Just
  Perfection.
- Repo rules: 100-char lines, absolute imports only (sibling `./` imports are fine), pure
  logic (e.g. computing the target order from saved list + present items) in modules
  without shell imports, unit-checked with `gjs -m`.
- Every per-item operation wrapped so an exception is logged (once per item) and the
  pass continues.

## Rollout

- Install as a link from the repo into `~/.local/share/gnome-shell/extensions/`, like the
  other extensions written here.
- Seed the settings (see Starting state), enable, restart the shell, check the bar.
- Remove `top-bar-organizer@julian.gse.jsts.xyz` and `just-perfection-desktop@just-perfection`
  from `enabled-extensions` / `disabled-extensions`, and reset their dconf paths after
  seeding.
- **Delete `extensions/top-bar-organizer/` and `extensions/just-perfection/` from the
  repo** (replace, don't deprecate, as done for Resource Monitor and Network Stats), after
  copying any code and notices that are reused. Update the root README tables and the
  context doc.

## Left to the builder

- How to detect new items and toggles (actor signals on the boxes and on the Quick
  Settings grid, or a short idle after `addToStatusArea`), within the anti-goals.
- How unlisted items keep their place while listed ones are reordered around them.
- The stable id for a Quick Settings toggle (constructor name, title, or both), as long
  as it survives restarts and doesn't change when the toggle's state or subtitle changes.
- How readable names are derived (appindicator title/id, extension metadata name, a small
  map for system roles).
- Settings schema shape, module split, tests, CSS.
