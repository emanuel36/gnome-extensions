# Network tile: one Quick Settings tile for Wired and Wi-Fi

New module inside `extensions/panel-tidy/` that replaces the native Wired and Wi-Fi tiles
with one "Network" tile. Target: GNOME Shell 46 on Ubuntu 24.04, X11.

## Why

The Quick Settings grid has two columns, so four tiles fill it as 2×2. Today it holds Wired,
Wi-Fi, Bluetooth and Power Mode. Adding Away Mode as a fifth tile leaves one tile alone on a
third row. Merging Wired and Wi-Fi frees one slot and keeps the grid aligned.

Several wired devices can be connected at the same time (here: `eth0`, a USB Ethernet, and
`enp0s31f6`, the built-in port), so the merged tile and its menu must handle more than one
cable, not just "the" wired connection.

## Decisions already made

- The tile lives in Panel Tidy, as a separate module. Panel Tidy already owns the grid
  (it watches `child-added` and hides toggles), and the native tiles must be hidden by the
  same mechanism, so two extensions would compete for their visibility.
- The grid stays 2×2: Network, Bluetooth, Power Mode, Away Mode. No tile changes size.
- The tile subtitle is a summary ("2 Wired · Wi-Fi"), not a name.
- The Wired section of the menu shows the active profile of each cable and lets the user
  expand the other profiles of a cable.
- Wi-Fi stays compact: one row, with the network list behind a chevron.
- With no cable plugged in, the tile and its menu match the native Wi-Fi tile.

The chosen look is the "Resumo" + "Com perfis" combination of the throwaway mockup
`network-tile-A-multi-wired.html` (untracked, not part of the repo).

## Goals

- One tile that shows the state of every wired device and of Wi-Fi.
- Turn each cable and Wi-Fi on or off independently from the menu.
- Switch a cable between its saved profiles, and Wi-Fi between saved networks.
- Native Wired and Wi-Fi tiles hidden while the module is on, and back exactly as before when
  it is off (`disable()`, or the module failing).
- Logic that decides what to show (summary text, icon, list of cables, tile action) is pure
  and covered by `gjs` tests, like the other extensions.

## Non-goals

- Changing the VPN tile, the top bar network icon, or the Airplane Mode tile.
- Entering Wi-Fi passwords, hidden networks, or creating profiles: unknown networks open
  GNOME Settings ("All Networks" and "Network Settings" rows).
- Reordering tiles; the new tile takes the slot of the first native tile it hides.
- Other tile sizes or compact icon-only tiles.
- Other GNOME versions.

## Anti-goals

- Patching or overriding shell functions or the native network indicator. Like the rest of
  Panel Tidy, it only reacts to objects that exist and hides them.
- A failure in the network code (NetworkManager missing, a device that throws) leaving the
  user without any network tile or breaking ordering and hiding. On failure the native tiles
  must be shown again.
- Any visible change left behind after `disable()`.

## Behaviour

### Tile

- Title "Network". Subtitle, from the devices that are connected right now:

| Wired connected | Wi-Fi connected | Subtitle |
|---|---|---|
| 2 or more | yes | `2 Wired · Wi-Fi` (the number is the count) |
| 2 or more | no | `2 Wired` |
| 1 | yes | `Wired · Wi-Fi` |
| 1 | no | `Wired` |
| 0 | yes | `Wi-Fi` |
| 0 | no | `Disconnected` |

- Icon: the wired icon when at least one cable is connected, the Wi-Fi icon otherwise.
- The tile shows as on when at least one connection is up.
- Click on the tile body: if anything is connected, disconnect every cable and Wi-Fi, and
  remember which ones were connected and with which profile or network. If nothing is
  connected, reconnect only what was remembered; with nothing remembered (for example right
  after the shell starts with everything off), open the menu instead.
- The arrow opens the menu below the row of the tile, as native menus do.

### Menu

- With no cable plugged in, the tile becomes a Wi-Fi tile like the native one: title
  "Wi-Fi", the network name as subtitle, the native Wi-Fi icons, on while the radio is on,
  and a click switches the radio. Its menu has a "Wi-Fi" header, up to 8 networks in the
  native layout, and "All Networks" opening the Wi-Fi settings.
- Header: "Network" with the same summary (device names instead of counts when it fits).
- **Wired** section: one row per wired device with a cable present. Devices without a cable
  are not listed. Each row has the device name ("Dock" for a USB adapter, "Ethernet" for a
  built-in port, numbered when repeated), the active profile or "Disconnected", the link
  speed, and its own switch. A device with more than one saved profile has a chevron on the
  left; a click anywhere on the row but the switch lists the others, and picking one
  activates it. With no cable, the section shows "No cable connected".
- **Wi-Fi** section: one row with "Wi-Fi", the connected network name (or "Off"), a chevron
  and a switch. A click on the row lists saved and visible networks (lock for secured, check for the
  active one); picking one activates it. The list is closed by default.
- Footer row "Network Settings" opens the GNOME Settings network panel.

### Native tiles

- While the module is on, the native Wired and Wi-Fi tiles are hidden and do not appear as
  hideable items in the Panel Tidy preferences; the "Network" tile does.
- If the user already hid a native tile in the preferences, that choice is kept when the
  module is turned off. *Author's call.*

## Author's calls

Settled while writing; none was discussed with the user.

- **Module switch:** one new boolean key, on by default, with a switch in the preferences
  window. Off means the native tiles are shown and the Network tile is removed.
- **Cable states:** a device is listed while its cable is present, even if the user switched
  it off; the row then reads "Disconnected" and the switch turns it back on. Only the
  connected ones count in the subtitle and the on state.
- **Which devices:** physical Ethernet devices only (no bridges, virtual interfaces, tunnels).
  The list follows devices that appear or disappear while the shell runs.
- **Profiles per cable:** a profile bound to another interface is not listed; a profile bound
  to none is listed under every cable.
- **Tile state:** checked when at least one connection is up; no intermediate state while
  NetworkManager activates or deactivates.
- **Saved choices for the native tiles:** while the module is on, the order and hidden
  choices saved for the native Wired and Wi-Fi tiles are ignored; they apply again when it is
  off. The Network tile has its own entry in the preferences.
- **Wi-Fi hardware:** no Wi-Fi device means no Wi-Fi row. Wi-Fi switched off (including by
  airplane mode) shows "Off", and its switch turns it on.
- **If the native tiles cannot be identified reliably** (spike result): the module leaves
  them alone and does not show the Network tile, rather than guessing from icons or titles.

## Constraints

- GNOME Shell 46; modules are cached, so changes need a shell restart.
- Every device and every network is read from NetworkManager. The only new GSettings key is
  the on/off switch of the module (see the author's calls).
- 100-character lines, absolute imports, MIT licence like the rest of Panel Tidy.

## Left to the builder

- How to read NetworkManager from the shell (libnm via `gi://NM` or the objects the shell's
  own network indicator already holds) and how to tell the native Wired and Wi-Fi tiles
  apart. Both are unchecked: the Shell 46 source of the native network indicator was not
  read while writing this, so the first step of the plan is a short spike on a nested shell
  (see the notes on nested sessions in `CLAUDE.md`).
- Module and file names, and how Panel Tidy starts and stops the module.
- Wording of rows not listed here.
- Whether Wi-Fi scanning is requested when the list opens.

## Documentation to update

- `extensions/panel-tidy/README.md`: what the tile does, for users.
- Root `README.md`: the Panel Tidy section and, if the look changes, its mockup in
  `docs/images/`.
- `CLAUDE.md`: add the new test file to the list of `gjs` tests.
