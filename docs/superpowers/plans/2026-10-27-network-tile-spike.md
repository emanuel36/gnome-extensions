# Network tile: Shell 46 findings

Read from the Shell 46.0 sources (`gresource extract /usr/lib/gnome-shell/libshell-14.so
/org/gnome/shell/ui/status/network.js`, also `ui/quickSettings.js` and `ui/panel.js`). The
behaviours marked *to confirm* are checked on a nested shell while verifying Tasks 3 and 4.

## Native tiles

- `Main.panel.statusArea.quickSettings._network` is the `Indicator` of `status/network.js`.
  Its `_wiredToggle` is an `NMWiredToggle` and its `_wirelessToggle` an `NMWirelessToggle`;
  both extend `NMDeviceToggle` → `NMToggle` → `QuickMenuToggle`. They are also in
  `quickSettingsItems` and in the grid.
- Reliable identification: `actor.constructor.name` is `NMWiredToggle` or `NMWirelessToggle`
  (the same name Panel Tidy's `toggleId` uses as the id, since it is not a generic base).
  The module reads them from `_network._wiredToggle`/`_wirelessToggle` first and falls back to
  the class name when scanning the grid. Other tiles of the same indicator (`NMVpnToggle`,
  `NMModemToggle`, `NMBluetoothToggle`) are left alone.
- The native toggles manage their own `visible` (hidden without a device), which is the case
  `_hideToggle` in `extension.js` already handles with `notify::visible`.

## Grid and menu

- `Main.panel.statusArea.quickSettings.menu.addItem(item, colSpan = 1)` adds a tile to the
  grid and wires its menu; `QuickSettingsMenu._grid` children are laid out in child order, so
  `grid.set_child_below_sibling(tile, native)` puts the tile where a native one was. Invisible
  children are skipped (Panel Tidy already hides Airplane Mode and Night Light this way).
- `QuickMenuToggle.menu` offers `setHeader(icon, title, subtitle)`, `addHeaderSuffix(actor)`,
  `addMenuItem(item)` and `addSettingsAction(title, desktopFile)`; the native Wi-Fi tile
  opens `gnome-wifi-panel.desktop`, wired opens `gnome-network-panel.desktop`.

## NetworkManager

- `gi://NM` is imported by the shell itself, so it is available to extensions. The shell
  creates its client with `NM.Client.new_async(null)`.
- Signals used: client `device-added`, `device-removed`, `connection-added`,
  `connection-removed`, `notify::wireless-enabled`, `notify::nm-running`; device
  `notify::state`, `notify::active-connection`; `NM.DeviceEthernet` `notify::carrier`,
  `notify::speed`; `NM.DeviceWifi` `notify::active-access-point`, `access-point-added`,
  `access-point-removed`.
- Physical Ethernet: `device.get_device_type() === NM.DeviceType.ETHERNET` (bridges, veth and
  tunnels have their own types). On this machine `eth0` is connected and `enp0s31f6` is
  `unavailable` (no cable).
