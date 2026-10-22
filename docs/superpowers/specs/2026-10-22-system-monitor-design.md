# System Monitor: one indicator for CPU, memory and network

New extension `extensions/system-monitor/` replacing Resource Monitor
(`Resource_Monitor@Ory0n`, GPL-3.0) and Network Stats
(`network-stats@gnome.noroadsleft.xyz`, MIT) on this machine. Target: GNOME Shell 46, X11.

## Why

The two extensions show what the user reads every day (CPU %, RAM %, network speed), but:

- They look different from each other, and their icons don't follow one style.
- Resource Monitor has no details popup; its settings carry eight tabs of features the
  user doesn't use (swap, disk, GPU, thermal, per-item colours...).
- Network Stats lists every interface on the machine (`docker0`, `veth*`, `br-*`,
  `vcan0`, `gpd0`, the Zscaler tunnel...) with IPs, reset buttons and schedules. The user
  wants only cable and Wi-Fi, and only their usage.

The user wants one compact, consistent indicator whose popup answers "what is eating my
CPU / memory right now?" and "how much is each connection moving?".

## Goals

- One panel button with the same bar content as today: CPU %, RAM %, network speed.
- A popup with the top 5 apps by CPU and the top 5 by memory, side by side, plus one row
  per connected cable / Wi-Fi interface.
- CPU temperature in the popup.
- Nothing else: no preferences window, no per-item colours, no reset schedules.

## Non-goals

- Changing any other extension (the icon style chosen here is for this extension only).
- Memory frequency: the speed in use is only readable as root (DMI); SPD only gives the
  removable module's rated speed (DDR4-3200 here), which never changes.
- Memory temperature: this machine has no RAM sensor (`ee1004` only reads SPD; the Dell
  `dell_ddv` "Memory" readings equal the ambient and skin sensors).
- Swap, disk, GPU, load average, CPU frequency, IP addresses, history graphs.
- Keeping the old extensions' settings or their data-used history.

## Anti-goals

- Making the shell stutter: process scanning must stay cheap (see "Cost").
- Showing virtual interfaces in any form.

## Bar

Approved mockup: `.superpowers/brainstorm/132464-1792669041/content/monitor-design.html`
(local, gitignored), Part 1 option A for CPU/RAM, option B for network.

`[cpu icon] 12%  [ram icon] 41%  ↓1.2M ↑80K`

- CPU and RAM: monochrome symbolic icons, 16 px, right before the value. Use
  `cpu-symbolic.svg` and `ram-symbolic.svg` from Resource Monitor
  (`extensions/resource-monitor/Resource_Monitor@Ory0n/icons/`), copied into the new
  extension.
- Network: text arrows, no icon. Value = download / upload of all shown interfaces
  combined, in bytes per second with compact units (`B`, `K`, `M`, `G`, no "/s").
- CPU % = all cores, like Resource Monitor today; RAM % = used / total, where used =
  `MemTotal - MemAvailable` from `/proc/meminfo`.
- Refresh every 2 s (Resource Monitor's current setting).
- Position: left box, right after Activities, where both old indicators sit today. Its
  role name replaces `Resource_Monitor@Ory0n-primary-0` and `NetworkStatsStatusView` in
  Top Bar Organizer's `left-box-order` (the one change outside the extension, needed to
  keep the place).

## Popup

Mockup Part 4 option B, Part 5 option A, Part 6 option B.

- Two columns:
  - **CPU**: icon, title, total % on the right; usage bar; faded line with the CPU
    temperature and frequency (`68 °C · 3.7 GHz`); top 5 apps with their CPU %.
  - **Memory**: icon, title, total % on the right; usage bar; faded line `6.4 / 15.6 GB`;
    top 5 apps with their memory.
- Below, one row per shown network interface:
  `[wired/wireless icon] Ethernet · 3.0 GB today    ↓ 1.2 MB/s   ↑ 80 KB/s`
  (the "today" part faded). Icons: `network-wired-symbolic`,
  `network-wireless-signal-excellent-symbolic`.
- If no interface is shown, the network part shows a single faded "Offline" line.

## Data

- **Apps**: processes from `/proc/<pid>/`, grouped by name (`comm`), so all `chrome`
  processes become one line. Top 5 by summed value.
  - CPU per app: sum of `utime + stime` deltas between two samples, as a share of the total
    CPU time delta (same scale as the bar's CPU %).
  - Memory per app: sum of `RssAnon` (private memory) from `/proc/<pid>/status`. Plain
    RSS double-counts shared pages and makes multi-process apps look several times bigger;
    `Pss` would be more precise but `smaps_rollup` is unreadable for other users'
    processes.
  - **All processes count, root and system users included** (user's decision): JumpCloud
    osquery, Zscaler, docker etc. are often the heavy ones. `stat` and `status` are
    world-readable. A process that vanishes mid-scan is skipped.
- **CPU temperature**: the `coretemp` hwmon, label `Package id 0`. If it doesn't exist,
  that part of the line is hidden.
- **CPU frequency**: the highest current frequency among the cores (user's choice, not
  the average), from `/sys/devices/system/cpu/cpu*/cpufreq/scaling_cur_freq`, in GHz with
  one decimal. Hidden if cpufreq isn't available.
- **Interfaces shown**: those with a hardware device (`/sys/class/net/<if>/device` exists)
  and `operstate` `up`. Wi-Fi = has `/sys/class/net/<if>/wireless`; the rest are cable.
  Labels "Ethernet" / "Wi-Fi"; if two of the same kind are shown, add the interface name.
  On this machine: `eth0` (USB dock, up), `enp0s31f6` (onboard, down), `wlp0s20f3`.
- **Speeds**: byte-counter deltas from `/proc/net/dev`.
- **Data used today**: per interface, received + sent since local midnight. Persisted in
  the extension's GSettings (one JSON key) so it survives shell restarts and reboots; the
  counters from `/proc/net/dev` reset on reboot and when an interface reappears, and that
  must not lose or double-count what was already counted. Resets at local midnight.

## Cost

- Bar values (CPU, RAM, network, temperature): cheap files, every 2 s, always.
- Process scan (`/proc/<pid>/stat`, `/proc/<pid>/status`): **only while the popup is
  open**, on the same 2 s tick (~470 processes here). The first sample after opening needs
  a previous one for CPU deltas; show the memory list at once and the CPU list from the
  second tick (empty rows or "…" until then).
- File reads must not block the shell: use Gio async APIs or keep sync reads to small
  `/proc` / `/sys` files only.

## Constraints

- GNOME Shell 46, ESM extension API. Plain JavaScript, no build step (Next Up and Claude
  Code Usage have none either).
- UUID `system-monitor@emanuel36`; no `_generated` key.
- License GPL-3.0 (icons come from Resource Monitor, GPL-3.0). Keep its copyright notice
  for the icons; credit Network Stats (MIT) in the extension README if any of its code is
  reused.
- Repo rules: 100-char lines, absolute imports only (sibling `./` imports are fine), pure
  logic in modules without shell imports, unit-checked with `gjs -m`.

## Rollout

- Install as a link from the repo into `~/.local/share/gnome-shell/extensions/`, like
  Next Up.
- Disable and uninstall `Resource_Monitor@Ory0n` and `network-stats@gnome.noroadsleft.xyz`
  (backup first), and update Top Bar Organizer's `left-box-order`.
- **Delete `extensions/resource-monitor/` and `extensions/network-stats/` from the repo**
  (user's decision: replace, don't deprecate), after copying the two icons and Resource
  Monitor's copyright notice into the new extension. Remove their rows from the root
  README's upstream table and add `extensions/system-monitor` (GPL-3.0, GNOME 46, no
  build) to its "written here from scratch" table, noting what it derives from.

## Left to the builder

- Number formatting details (decimals, `KB/s` vs `K` in the popup), within the mockups.
- Column widths, spacing, CSS.
- How processes are grouped when `comm` is truncated (15 chars) or generic
  (e.g. `python3`), as long as the result reads naturally.
- Module split and tests.
