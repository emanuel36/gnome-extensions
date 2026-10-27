# Network Tile Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the native Wired and Wi-Fi Quick Settings tiles with one "Network" tile inside Panel Tidy, so the grid stays 2×2 with Away Mode added.

**Architecture:** Pure display logic in `network.js` (tested with `gjs`), NetworkManager access in `network-source.js`, the tile and its menu in `network-tile.js`, and `network-module.js` which adds the tile, hides the native ones through Panel Tidy's existing hide mechanism and undoes it all on `disable()`. Nothing is patched; the module only reacts to tiles that exist.

**Tech Stack:** GNOME Shell 46 extension (GJS, ES modules), libnm via `gi://NM`, `gjs -m` tests.

**Spec:** `docs/superpowers/specs/2026-10-27-network-tile-design.md`

## Global Constraints

- GNOME Shell 46, Ubuntu 24.04, X11; modules are cached, so JS changes need a shell restart.
- Code in `extensions/panel-tidy/`; MIT licence; 100-character lines; absolute imports (the
  `resource:///` and `gi://` ones, and `./file.js` siblings as `order.js` already does).
- Never override or patch shell functions; only react to existing objects.
- A failure in the network code leaves the native Wired and Wi-Fi tiles visible and does not
  stop Panel Tidy ordering and hiding.
- Nothing stays changed after `disable()`.
- Tile title "Network"; subtitle table: `2 Wired · Wi-Fi`, `2 Wired`, `Wired · Wi-Fi`, `Wired`,
  `Wi-Fi`, `Disconnected` (the count is the number of connected cables).
- Wired menu rows: only devices with a cable present; physical Ethernet only; one new
  GSettings key, `merge-network` (boolean, default true).
- Conventional Commits, subject at most 50 characters, body lines at most 72. All work on
  `feat/network-tile`; no merge into `main` without the user asking.

## Review Focus

- NetworkManager unavailable or `gi://NM` failing to import: native tiles stay visible, Panel
  Tidy keeps working (Task 4).
- A cable unplugged or plugged while the menu is open: rows update, no use of destroyed
  actors (Task 3).
- Click with everything off and nothing remembered (fresh shell): opens the menu, connects
  nothing (Task 1).
- Wi-Fi switched off on purpose, tile clicked off and on again: Wi-Fi stays off (Task 1).
- Profile bound to another device's interface or MAC is not listed; an unbound profile is
  listed under each cable (Task 1).

---

### Task 1: Pure logic in `network.js`

**Files:**
- Create: `extensions/panel-tidy/network.js`
- Test: `extensions/panel-tidy/network.test.js` (same `check(name, actual, expected)` style as
  `order.test.js`; run with `gjs -m extensions/panel-tidy/network.test.js`)

**Interfaces:**
- Produces, with `Cable = {device: string, name: string, speed: string, present: boolean,
  connected: boolean, profiles: {id: string, name: string}[], active: string|null}`,
  `Wifi = {present: boolean, connected: boolean, ssid: string|null}` and
  `Remembered = {cables: {device: string, profile: string}[], wifi: string|null}`:
  - `summary(connectedCables: number, wifiConnected: boolean): string`
  - `headerSummary(cables: Cable[], wifi: Wifi): string`
  - `tileIcon(connectedCables: number): string`
  - `tileOn(cables: Cable[], wifi: Wifi): boolean`
  - `cableRows(cables: Cable[]): {device, title, subtitle, on, profiles: {id, name, active}[]}[]`
  - `profilesFor(profiles: {id, name, iface: string|null, mac: string|null}[],
    device: {iface: string, mac: string}): {id, name}[]`
  - `tileAction(cables: Cable[], wifi: Wifi, remembered: Remembered|null):
    {kind: 'disconnect', remember: Remembered} | {kind: 'reconnect', targets: Remembered}
    | {kind: 'openMenu'}`

- [ ] **Step 1: Write the failing tests.** One `check` per row of the spec's subtitle table
  (`summary(2, true) === '2 Wired · Wi-Fi'`, `summary(3, false) === '3 Wired'`,
  `summary(1, true) === 'Wired · Wi-Fi'`, `summary(1, false) === 'Wired'`,
  `summary(0, true) === 'Wi-Fi'`, `summary(0, false) === 'Disconnected'`); `tileIcon(1) ===
  'network-wired-symbolic'`, `tileIcon(0) === 'network-wireless-signal-excellent-symbolic'`;
  `headerSummary` for two connected cables plus SSID `Emanuel` is `2 Wired · Emanuel`, for the
  single cable `USB Ethernet` alone is `USB Ethernet`, with no cable `Emanuel`, with nothing
  `Disconnected`; `cableRows` skips `present: false`, gives `netplan-eth0 · 1 Gb/s` as the
  subtitle of a connected cable, `Disconnected` for a switched-off one, and lists `profiles`
  (active flagged) only when the cable has more than one.
- [ ] **Step 2: Write the failing tests for the rest.** `profilesFor`: a profile with
  `iface: 'enp0s31f6'` is dropped for `eth0`; one with a different `mac` is dropped; one with
  both null is kept for both devices. `tileAction`: connected `eth0` on `netplan-eth0` plus
  Wi-Fi `Emanuel` gives `disconnect` remembering `{cables: [{device: 'eth0', profile:
  'netplan-eth0'}], wifi: 'Emanuel'}`; nothing connected with that memory gives `reconnect`
  with the same targets; nothing connected and `remembered: null` gives `openMenu`; Wi-Fi off
  when disconnecting remembers `wifi: null`, and reconnecting then names no Wi-Fi.
- [ ] **Step 3: Run `gjs -m extensions/panel-tidy/network.test.js`.** Expected: fails on the
  missing module.
- [ ] **Step 4: Implement the functions in `network.js`.** No shell, GTK or NM imports (like
  `order.js`), JSDoc in the style of `order.js` for the non-obvious ones.
- [ ] **Step 5: Run the test again.** Expected: every line `ok`, exit status 0.
- [ ] **Step 6: Commit** `feat(panel-tidy): add network tile logic`.

### Task 2: Spike on Shell 46 and `network-source.js`

**Files:**
- Create: `docs/superpowers/plans/2026-10-27-network-tile-spike.md` (findings)
- Create: `extensions/panel-tidy/network-source.js`
- Test: `extensions/panel-tidy/network-source.test.js` (smoke test against the running
  machine, like `system-monitor/sources.test.js`)

**Interfaces:**
- Consumes: `Cable`, `Wifi` and `profilesFor` from Task 1.
- Produces, `class NetworkSource` (no GObject needed):
  - `constructor()`; `destroy(): void`
  - `connect(callback: () => void): number` and `disconnect(id: number): void`, called when
    anything the tile shows changes (device added/removed, carrier, connection state, SSID)
  - `snapshot(): {cables: Cable[], wifi: Wifi}`
  - `setCable(device: string, on: boolean): void`
  - `activateProfile(device: string, profileId: string): void`
  - `setWifi(on: boolean): void`
  - `wifiNetworks(): {id: string, name: string, strength: number, secured: boolean,
    active: boolean}[]` and `activateNetwork(id: string): void`
  - `requestScan(): void`
  - `static available(): boolean`: false when `gi://NM` is missing or the daemon is down.
- Also produces the findings file, which Task 3 and Task 4 consume.

- [ ] **Step 1: Spike on a nested shell** (see "Nested shell" in `CLAUDE.md`; `--unsafe-mode`
  allows `org.gnome.Shell.Eval`). Write down in the findings file, with the Eval snippets that
  proved each one: (a) the class and title of the native Wired and Wi-Fi tiles and a
  reliable way to tell them apart from other tiles, found through
  `Main.panel.statusArea.quickSettings` and its grid children; (b) whether `gi://NM`
  imports inside an extension and which `NM.Client` signals cover the Interfaces above;
  (c) how a custom `QuickMenuToggle` goes into the grid at the slot of a native tile
  (`menu.addItem`, `set_child_at_index`) and that hiding the two natives reflows to 2×2.
  If (a) has no reliable answer, stop and report: the spec says the module then does nothing.
- [ ] **Step 2: Write the failing smoke test.** `NetworkSource.available()` is true;
  every `snapshot().cables[i].device` appears as type `ethernet` in
  `nmcli -t -f DEVICE,TYPE device` (run with `GLib.spawn_command_line_sync`), and no bridge
  or tunnel (`docker0`, `gpd0`) appears; a cable's `profiles` contains none whose interface is
  another device's.
- [ ] **Step 3: Run `gjs -m extensions/panel-tidy/network-source.test.js`.** Expected: fails
  on the missing module.
- [ ] **Step 4: Implement `NetworkSource`** on `NM.Client`, listing only `NM.DeviceEthernet`
  and the one `NM.DeviceWifi`, with profiles filtered by `profilesFor`. Wi-Fi radio on/off
  uses the client's wireless-enabled property.
- [ ] **Step 5: Run the test again.** Expected: all checks `ok`.
- [ ] **Step 6: Commit** `feat(panel-tidy): add NetworkManager source`.

### Task 3: Tile and menu in `network-tile.js`

**Files:**
- Create: `extensions/panel-tidy/network-tile.js`

**Interfaces:**
- Consumes: `NetworkSource` (Task 2); `summary`, `headerSummary`, `tileIcon`, `tileOn`,
  `cableRows`, `tileAction` (Task 1); the findings file for how a menu is built in Shell 46.
- Produces: `export const NetworkTile` (`GObject.registerClass`, extends `QuickMenuToggle`,
  title "Network") with `constructor(source: NetworkSource)` and `destroy()`, which
  disconnects from the source. The class name `NetworkTile` is not one of the generic bases in
  `order.js`, so `toggleId` builds the id from it and Panel Tidy lists the tile in the
  preferences with no extra code.

- [ ] **Step 1: Implement the tile.** Subtitle from `summary`, icon from `tileIcon`, checked
  from `tileOn`, refreshed on every source callback. Body click runs `tileAction`: on
  `disconnect` it switches off every connected cable and Wi-Fi and keeps `remember` in a
  field; on `reconnect` it activates the remembered profiles and network; on `openMenu` it
  opens the tile menu.
- [ ] **Step 2: Implement the menu** from the spec: header with `headerSummary`; "WIRED"
  section built from `cableRows` (switch per row, chevron listing profiles when there are
  several, "No cable connected" when empty); "WI-FI" row (SSID or "Off", chevron, switch that turns the radio on when off; list of
  `wifiNetworks()` closed by default, `requestScan()` when it opens; no row without a Wi-Fi
  device); "Network Settings" row opening GNOME Settings. Rebuild rows on each source callback
  and skip actors already destroyed.
- [ ] **Step 3: Verify on a nested shell** with the module temporarily enabled by hand (Task 4
  wires it properly): the subtitle matches `nmcli device` for `eth0` and Wi-Fi; the cable switch
  disconnects `eth0` (`nmcli -t -f DEVICE,STATE device` shows `disconnected`) and switching it
  on restores it; the profile chevron of `eth0` lists `netplan-eth0` and `Internet`; unplugging
  or `nmcli device disconnect` while the menu is open updates the rows with nothing in
  `journalctl --user -b | rg -i panel-tidy`.
- [ ] **Step 4: Commit** `feat(panel-tidy): add Network tile`.

### Task 4: Module, hiding and preferences

**Files:**
- Create: `extensions/panel-tidy/network-module.js`
- Modify: `extensions/panel-tidy/extension.js` (`enable`, `disable`, `_apply`, `_applyToggles`)
- Modify: `extensions/panel-tidy/schemas/org.gnome.shell.extensions.panel-tidy.gschema.xml`,
  `extensions/panel-tidy/prefs.js`, and the compiled schema if `git ls-files` tracks it

**Interfaces:**
- Consumes: `NetworkSource`, `NetworkTile`, and the identification of the native tiles from the
  findings file.
- Produces: `class NetworkModule` with `constructor({grid, menu, hide, show})` where
  `hide(actor)` and `show(actor)` are Panel Tidy's `_hideToggle` and `_showToggle`;
  `enable(): boolean` (false if it could not start, with the natives left visible);
  `disable(): void`; `isNative(actor): boolean`.
- Schema key `merge-network`, type `b`, default `true`.

- [ ] **Step 1: Add the `merge-network` key and a switch for it in `prefs.js`** in the
  toggles group, next to the list, with the summary "Replace Wired and Wi-Fi with one
  Network tile". Recompile with `glib-compile-schemas extensions/panel-tidy/schemas`.
- [ ] **Step 2: Implement `NetworkModule.enable()`.** Return false without touching anything
  when `NetworkSource.available()` is false or the native tiles cannot be identified; otherwise
  create the source and tile, place the tile at the index of the first native tile, and hide the
  natives with `hide`. Wrap the whole thing so an exception hides nothing and logs once with
  the `${uuid}: network:` prefix `extension.js` already uses. `disable()` removes the tile,
  destroys the source and calls `show` on the natives.
- [ ] **Step 3: Wire `extension.js`.** Create the module in `enable()` when `merge-network` is
  true and react to the key changing; in `_applyToggles` leave out toggles for which
  `isNative` is true, so their saved hidden choices are ignored while the module is on and
  apply again after `disable()`; call `module.disable()` first in `disable()`.
- [ ] **Step 4: Verify on a nested shell** after a restart: the grid is Network, Bluetooth,
  Power Mode and, with Away Mode enabled, Away Mode, in 2×2; turning `merge-network` off
  brings back Wired and Wi-Fi and removes Network without a restart (`gsettings set
  org.gnome.shell.extensions.panel-tidy merge-network false`); with `gi://NM` made to fail (an
  invalid import name in a scratch copy) the natives stay and ordering and hiding still work;
  disabling Panel Tidy leaves the stock grid.
- [ ] **Step 5: Run the tests that exist for the extension.**
  `gjs -m extensions/panel-tidy/order.test.js && gjs -m extensions/panel-tidy/network.test.js &&
  gjs -m extensions/panel-tidy/network-source.test.js`. Expected: all `ok`.
- [ ] **Step 6: Commit** `feat(panel-tidy): replace Wired and Wi-Fi tiles`.

### Task 5: Documentation

**Files:**
- Modify: `extensions/panel-tidy/README.md`, `README.md` (Panel Tidy section and its mockup),
  `docs/images/panel-tidy.svg` if the Quick Settings part is drawn in it, `CLAUDE.md`

- [ ] **Step 1: Describe the tile in the Panel Tidy README for users.** What it replaces, the
  subtitle, the click, the menu sections and the preferences switch. No source paths or tests,
  as `CLAUDE.md` requires.
- [ ] **Step 2: Mirror it in the root `README.md`** and update the mockup with made-up data
  (not this machine's device names).
- [ ] **Step 3: Add the two new tests to the test list in `CLAUDE.md`** and note that
  `network-source.test.js` is a smoke test against the running machine.
- [ ] **Step 4: Commit** `docs(panel-tidy): document the Network tile`. The spec and plan stay
  as committed; the branch history is cleaned up before any merge, as `CLAUDE.md` says.
