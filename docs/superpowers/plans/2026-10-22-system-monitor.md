# System Monitor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One GNOME Shell 46 indicator (`system-monitor@emanuel36`) showing CPU %, RAM % and
network speed in the bar, with a popup listing the top 5 apps by CPU and by memory, CPU
temperature/frequency, and per-interface cable/Wi-Fi speed and data used today; then remove
Resource Monitor and Network Stats.

**Architecture:** Plain-JS ESM extension. Pure logic (parsing `/proc` text, deltas, top
lists, daily-usage accounting, formatting) lives in modules without shell imports and is
unit-checked with `gjs -m`. A thin I/O module reads `/proc` and `/sys` with small sync reads.
The panel button and popup are St/PopupMenu widgets created once and updated every 2 s; the
process scan runs only while the popup is open.

**Tech Stack:** GJS (ESM), GNOME Shell 46 (`St`, `Clutter`, `PanelMenu`, `PopupMenu`),
`GLib`/`Gio`, GSettings. No build step.

**Spec:** `docs/superpowers/specs/2026-10-22-system-monitor-design.md` (approved mockup:
`.superpowers/brainstorm/132464-1792669041/content/monitor-final.html`, local only).

## Global Constraints

- GNOME Shell 46, X11; `metadata.json` `"shell-version": ["46"]`, UUID
  `system-monitor@emanuel36`, no `_generated` key, settings schema
  `org.gnome.shell.extensions.system-monitor`.
- License GPL-3.0; CPU/RAM icons copied from Resource Monitor (© 2018-2026 Giuseppe
  Silvestro, GPL-3.0) with that notice kept.
- Style: 4-space indent, single quotes, `_private`
  methods, sparse comments, 100-char lines, sibling `./` imports only.
- Refresh every 2 s. Bar: `[cpu icon] 3%  [ram icon] 58%  ↓1.2M ↑80K`. Icons 16 px symbolic.
- Network units are decimal (1000); memory units are binary (KiB from `/proc`, shown as
  `MB`/`GB` with 1024 steps).
- All processes count (root included); memory per app = summed `RssAnon`; grouped by
  `comm`.
- Interfaces: hardware device present (`/sys/class/net/<if>/device`), Wi-Fi if
  `/sys/class/net/<if>/wireless` exists, else cable; shown only when `operstate` is `up`.
- Nothing outside `extensions/system-monitor/` changes except: Top Bar Organizer
  `left-box-order`, removal of the two old extensions (repo dirs, installs, README rows).
- Work on branch `feat/system-monitor`. The working tree may hold other uncommitted
  edits: never `git add -A`/`.`; add explicit paths.

## Review Focus

- Interface counters reset mid-day (reboot, dock unplugged and replugged): daily total
  must not go negative or count the whole counter twice → `usage.test.js`
  "counter reset adds bytes since reset".
- Midnight while running: total restarts from 0 and keeps counting after midnight →
  `usage.test.js` "new day resets".
- A process that exits or appears between two scans: no negative or inflated CPU →
  `stats.test.js` "topCpu ignores pids not in both scans".
- `comm` with spaces or parentheses (`(sd-pam)`, `Web Content`, `tmux: server`) →
  `stats.test.js` "parseProcStat handles parens and spaces".
- Uneven tick spacing (suspend/resume, a slow tick): rates use real elapsed time →
  `stats.test.js` "netRates divides by elapsed seconds" and "netRates clamps resets to 0".

---

### Task 1: Formatting helpers

**Files:**
- Create: `extensions/system-monitor/format.js`
- Test: `extensions/system-monitor/format.test.js`

**Interfaces:**
- Produces (all pure, exported from `./format.js`):
  - `formatRateCompact(bytesPerSec: number) -> string` (bar)
  - `formatRate(bytesPerSec: number) -> string` (popup)
  - `formatDataSize(bytes: number) -> string` (popup "today")
  - `formatMemKb(kb: number) -> string`
  - `formatMemTotals(usedKb: number, totalKb: number) -> string`
  - `formatPercent(p: number) -> string` (rounded integer)
  - `formatShare(p: number) -> string` (one decimal, app CPU)
  - `cpuSubline(tempC: number|null, freqKhz: number|null) -> string`

Number rule shared by the decimal formatters: pick the largest unit (1000 steps) where the
value is ≥ 1; show one decimal when the value is < 10 and the unit isn't bytes, else round
to an integer.

- [ ] **Step 1: Write the failing test** (`format.test.js`, a small `check()`
  harness)

```js
check('compact zero', formatRateCompact(0), '0B');
check('compact bytes', formatRateCompact(950), '950B');
check('compact kilo', formatRateCompact(80000), '80K');
check('compact one decimal', formatRateCompact(1234567), '1.2M');
check('compact large', formatRateCompact(12345678), '12M');
check('compact giga', formatRateCompact(2.5e9), '2.5G');
check('rate zero', formatRate(0), '0 B/s');
check('rate kilo', formatRate(80000), '80 KB/s');
check('rate mega', formatRate(1234567), '1.2 MB/s');
check('size mega', formatDataSize(550e6), '550 MB');
check('size giga', formatDataSize(4.04e9), '4.0 GB');
check('mem mega', formatMemKb(965 * 1024), '965 MB');
check('mem giga', formatMemKb(3549 * 1024), '3.5 GB');
check('mem kilo', formatMemKb(512), '512 KB');
check('mem totals', formatMemTotals(17.9 * 1048576, 31.0 * 1048576), '17.9 / 31.0 GB');
check('percent', formatPercent(57.6), '58%');
check('share', formatShare(0.66), '0.7%');
check('subline both', cpuSubline(68.4, 3708894), '68 °C · 3.7 GHz');
check('subline temp only', cpuSubline(68, null), '68 °C');
check('subline freq only', cpuSubline(null, 3708894), '3.7 GHz');
check('subline none', cpuSubline(null, null), '');
```

- [ ] **Step 2: Run it, expect failure** — `gjs -m extensions/system-monitor/format.test.js`
  → import error (module missing).
- [ ] **Step 3: Implement the functions in `format.js`** with the signatures above.
- [ ] **Step 4: Run it, expect `all passed`.**
- [ ] **Step 5: Commit** — `git add extensions/system-monitor/format.js
  extensions/system-monitor/format.test.js docs/superpowers/specs/2026-10-22-system-monitor-design.md
  docs/superpowers/plans/2026-10-22-system-monitor.md` and commit
  `feat(system-monitor): add formatting helpers`.

### Task 2: Parsing and statistics

**Files:**
- Create: `extensions/system-monitor/stats.js`
- Test: `extensions/system-monitor/stats.test.js`

**Interfaces:**
- Produces (pure, from `./stats.js`):
  - `parseCpuTimes(procStatText: string) -> {total: number, idle: number}` — first
    `cpu ` line; `total` = sum of the first 8 fields (user..steal), `idle` = idle + iowait.
  - `cpuPercent(prev: {total, idle}|null, cur: {total, idle}) -> number|null` — null when
    `prev` is null; 0 when the total delta is 0.
  - `parseMeminfo(text: string) -> {totalKb: number, availableKb: number}`
  - `memPercent(m: {totalKb, availableKb}) -> number` — `(total - available) / total * 100`.
  - `parseNetDev(text: string) -> Map<string, {rx: number, tx: number}>` (bytes).
  - `netRates(prev: Map|null, cur: Map, elapsedSec: number, names: string[])
    -> Map<string, {down: number, up: number}>` — bytes/s; a negative delta (counter reset)
    gives 0; missing `prev` or `elapsedSec <= 0` gives 0s.
  - `parseProcStat(text: string) -> {comm: string, ticks: number}|null` — `comm` between
    the first `(` and the **last** `)`; `ticks` = utime + stime (fields 14 and 15).
  - `parseRssAnonKb(statusText: string) -> number` — 0 when the line is absent.
  - `topCpu(prevScan: Map, curScan: Map, totalDelta: number, n = 5) -> Array<{name, value}>`
    — scans are `Map<number, {comm, ticks, rssAnonKb}>`; only pids present in both scans
    count; per-pid delta < 0 is ignored; value = summed delta / `totalDelta` * 100; sorted
    descending; ties by name.
  - `topMemory(curScan: Map, n = 5) -> Array<{name, value}>` — value = summed `rssAnonKb`.
  - `interfaceLabels(ifaces: Array<{name, kind}>) -> Map<string, string>` — `'Cable'` /
    `'Wi-Fi'`; when two shown interfaces share a kind, `'Cable eth0'`, `'Cable enp0s31f6'`.

- [ ] **Step 1: Write the failing tests** (`stats.test.js`). Fixtures are literal strings;
  key assertions:

```js
const stat1 = 'cpu  100 0 50 800 50 0 0 0 0 0\ncpu0 1 2 3 4 5 6 7 8 0 0\n';
const stat2 = 'cpu  130 0 60 850 60 0 0 0 0 0\n';
check('cpu times', parseCpuTimes(stat1), {total: 1000, idle: 850});
check('cpu percent', cpuPercent(parseCpuTimes(stat1), parseCpuTimes(stat2)), 40);
check('cpu percent first sample', cpuPercent(null, parseCpuTimes(stat1)), null);
check('meminfo', parseMeminfo('MemTotal: 1000 kB\nMemFree: 1 kB\nMemAvailable: 420 kB\n'),
    {totalKb: 1000, availableKb: 420});
check('mem percent', memPercent({totalKb: 1000, availableKb: 420}), 58);
// /proc/net/dev: two header lines, then "iface: rx_bytes ... (8 rx fields) tx_bytes ..."
check('net dev', [...parseNetDev(NETDEV).entries()],
    [['lo', {rx: 10, tx: 10}], ['eth0', {rx: 5000, tx: 300}], ['wlp0s20f3', {rx: 0, tx: 0}]]);
check('netRates divides by elapsed seconds',
    [...netRates(map({eth0: [1000, 100]}), map({eth0: [5000, 300]}), 4, ['eth0'])],
    [['eth0', {down: 1000, up: 50}]]);
check('netRates clamps resets to 0',
    [...netRates(map({eth0: [9000, 900]}), map({eth0: [100, 10]}), 2, ['eth0'])],
    [['eth0', {down: 0, up: 0}]]);
check('parseProcStat handles parens and spaces',
    parseProcStat('42 (tmux: server (x)) S 1 2 3 4 5 6 7 8 9 10 70 30 0 0'),
    {comm: 'tmux: server (x)', ticks: 100});
check('rss anon', parseRssAnonKb('Name:\tjava\nRssAnon:\t  3634176 kB\n'), 3634176);
check('rss anon missing', parseRssAnonKb('Name:\tkthreadd\n'), 0);
check('topCpu groups by name',
    topCpu(scan({1: ['chrome', 100], 2: ['chrome', 50], 3: ['code', 10]}),
        scan({1: ['chrome', 130], 2: ['chrome', 60], 3: ['code', 30]}), 200),
    [{name: 'chrome', value: 20}, {name: 'code', value: 10}]);
check('topCpu ignores pids not in both scans',
    topCpu(scan({1: ['a', 10], 2: ['gone', 10]}), scan({1: ['a', 20], 3: ['new', 999]}), 100),
    [{name: 'a', value: 10}]);
check('topMemory sums and limits to n', topMemory(memScan(SIX_APPS)).length, 5);
check('labels single', [...interfaceLabels([{name: 'eth0', kind: 'cable'},
    {name: 'wlp0s20f3', kind: 'wifi'}])], [['eth0', 'Cable'], ['wlp0s20f3', 'Wi-Fi']]);
check('labels two cables', [...interfaceLabels([{name: 'eth0', kind: 'cable'},
    {name: 'enp0s31f6', kind: 'cable'}])],
    [['eth0', 'Cable eth0'], ['enp0s31f6', 'Cable enp0s31f6']]);
```

  `NETDEV`, `SIX_APPS`, `map()`, `scan()` and `memScan()` are small fixture helpers in the
  test file.
- [ ] **Step 2: Run, expect failure** — `gjs -m extensions/system-monitor/stats.test.js`.
- [ ] **Step 3: Implement `stats.js`** with the signatures above.
- [ ] **Step 4: Run, expect `all passed`.**
- [ ] **Step 5: Commit** `feat(system-monitor): add /proc parsing and statistics`
  (explicit paths).

### Task 3: Data used today

**Files:**
- Create: `extensions/system-monitor/usage.js`
- Test: `extensions/system-monitor/usage.test.js`

**Interfaces:**
- Produces (pure, from `./usage.js`):
  - `localDate(now: Date) -> string` — local `YYYY-MM-DD`.
  - `updateUsage(state: object|null, counters: Map<string, {rx, tx}>, today: string)
    -> object` — returns a new state; never mutates the input.
  - State shape (JSON-serialisable, stored as a string in GSettings key `net-usage`):
    `{date: 'YYYY-MM-DD', ifaces: {<name>: {used: number, rx: number, tx: number}}}`.

Rules for `updateUsage`:
- `state` null or unparseable → start fresh with `date = today`, every interface in
  `counters` baselined (`used: 0`, current `rx`/`tx`), nothing counted.
- `state.date !== today` → every `used` becomes 0 and `date = today` **before** counting the
  current delta (bytes since the last sample count for the new day).
- Interface seen for the first time → baseline, `used: 0`.
- Normal: `used += (rx - prev.rx) + (tx - prev.tx)`.
- Counter reset (`rx < prev.rx` or `tx < prev.tx`) → `used += rx + tx` (bytes since reset).
- Interfaces absent from `counters` keep their entry unchanged.

- [ ] **Step 1: Write the failing tests** (`usage.test.js`):

```js
const c = (rx, tx) => new Map([['eth0', {rx, tx}]]);
const s1 = updateUsage(null, c(1000, 100), '2026-10-22');
check('fresh state counts nothing', s1.ifaces.eth0, {used: 0, rx: 1000, tx: 100});
const s2 = updateUsage(s1, c(1500, 150), '2026-10-22');
check('normal delta', s2.ifaces.eth0.used, 550);
check('input not mutated', s1.ifaces.eth0.used, 0);
check('counter reset adds bytes since reset',
    updateUsage(s2, c(200, 20), '2026-10-22').ifaces.eth0.used, 770);
check('new day resets', updateUsage(s2, c(1600, 160), '2026-10-23'),
    {date: '2026-10-23', ifaces: {eth0: {used: 110, rx: 1600, tx: 160}}});
check('absent interface kept',
    updateUsage(s2, new Map(), '2026-10-22').ifaces.eth0, s2.ifaces.eth0);
check('local date', localDate(new Date(2026, 9, 2, 23, 59)), '2026-10-02');
```

- [ ] **Step 2: Run, expect failure** — `gjs -m extensions/system-monitor/usage.test.js`.
- [ ] **Step 3: Implement `usage.js`.**
- [ ] **Step 4: Run, expect `all passed`.**
- [ ] **Step 5: Commit** `feat(system-monitor): track data used per day` (explicit paths).

### Task 4: Reading `/proc` and `/sys`

**Files:**
- Create: `extensions/system-monitor/sources.js`
- Test: `extensions/system-monitor/sources.test.js` (smoke test against this machine)

**Interfaces:**
- Consumes: `parseCpuTimes`, `parseMeminfo`, `parseNetDev`, `parseProcStat`,
  `parseRssAnonKb` from Task 2.
- Produces (from `./sources.js`, uses `GLib` only, no shell imports):
  - `readText(path: string) -> string|null` — `GLib.file_get_contents`, decoded; null on
    any error.
  - `readCpuTimes() -> {total, idle}|null`, `readMeminfo() -> {totalKb, availableKb}|null`,
    `readNetCounters() -> Map<string, {rx, tx}>`.
  - `listPhysicalInterfaces() -> Array<{name: string, kind: 'cable'|'wifi', up: boolean}>`
    — cable before Wi-Fi, then by name.
  - `findCpuTempInput() -> string|null` — path of the `coretemp` hwmon `temp*_input` whose
    `temp*_label` is `Package id 0`.
  - `readCpuTempC(path: string|null) -> number|null` — millidegrees / 1000.
  - `readMaxCpuFreqKhz() -> number|null` — max of `cpu*/cpufreq/scaling_cur_freq`.
  - `scanProcesses() -> Map<number, {comm, ticks, rssAnonKb}>` — every numeric `/proc`
    entry; a pid whose `stat` can't be read (exited) is skipped.

- [ ] **Step 1: Write the smoke test** (`sources.test.js`): on this machine assert
  `readCpuTimes().total > 0`; `readMeminfo().totalKb > 0`; `readNetCounters().has('lo')`;
  `listPhysicalInterfaces()` contains `{name: 'wlp0s20f3', kind: 'wifi'}` and no `docker0`,
  `lo`, `gpd0`; `findCpuTempInput()` ends with `_input`; `readCpuTempC(...)` between 10 and
  110; `readMaxCpuFreqKhz() > 100000`; `scanProcesses().size > 100` and contains pid 1 with a
  non-empty `comm`; timing: `scanProcesses()` under 200 ms (print the time).
- [ ] **Step 2: Run, expect failure** — `gjs -m extensions/system-monitor/sources.test.js`.
- [ ] **Step 3: Implement `sources.js`.** Directory listing with
  `Gio.File.enumerate_children` or `GLib.Dir.open`; sync reads are fine for these small
  `/proc`/`/sys` files (spec "Cost").
- [ ] **Step 4: Run, expect `all passed` and the printed scan time.**
- [ ] **Step 5: Commit** `feat(system-monitor): read system data from /proc and /sys`.

### Task 5: The extension (bar and popup)

**Files:**
- Create: `extensions/system-monitor/metadata.json`, `extension.js`, `panel.js`,
  `stylesheet.css`,
  `schemas/org.gnome.shell.extensions.system-monitor.gschema.xml` (key `net-usage`, type
  `s`, default `''`), `icons/cpu-symbolic.svg`, `icons/ram-symbolic.svg` (copied from
  `extensions/resource-monitor/Resource_Monitor@Ory0n/icons/`), `LICENSE` (copy of
  `extensions/resource-monitor/LICENSE`), `README.md` (what it shows, credits: icons ©
  2018-2026 Giuseppe Silvestro / Resource Monitor GPL-3.0; inspired by Network Stats, MIT).
- Add `schemas/gschemas.compiled` to an `extensions/system-monitor/.gitignore`.

**Interfaces:**
- Consumes: Tasks 1–4.
- Produces: `export default class SystemMonitorExtension extends Extension` (`enable`,
  `disable`); `panel.js` exports `SystemMonitorIndicator` (GObject-registered
  `PanelMenu.Button`) with:
  - `constructor(extensionPath: string)`
  - `setBar({cpu: number|null, ram: number|null, down: number, up: number})`
  - `setCpu({percent, tempC, freqKhz, top: Array<{name, value}>|null})` — `top` null shows a
    single faded `…` row (first tick after opening).
  - `setMemory({percent, usedKb, totalKb, top: Array<{name, value}>})`
  - `setNetwork(rows: Array<{name, label, kind, down, up, usedToday}>)` — empty array shows
    one faded `Offline` row.
  - signal or callback for menu open/close (e.g. `this.menu.connect('open-state-changed')`
    in `extension.js`).

Behaviour (`extension.js`):
- `enable()`: create the indicator, `Main.panel.addToStatusArea(this.uuid, indicator, 1,
  'left')` (role name = UUID, right after Activities); load `net-usage` JSON (null on parse
  error); find the temp input once; start a 2 s `GLib.timeout_add_seconds` tick and run one
  tick immediately.
- Tick: read CPU times, meminfo, net counters, physical interfaces; compute CPU % (keep
  previous times), RAM %, rates with real elapsed seconds (`GLib.get_monotonic_time()`)
  for the shown (up) interfaces; bar `down`/`up` = sum over shown interfaces; update usage
  state with counters of all physical interfaces and `localDate(new Date())`.
  If the popup is open: also temp, max freq, `scanProcesses()`; memory top from the current
  scan; CPU top from the previous scan when there is one (else `top: null`); keep the scan
  and its CPU total for the next tick. On close, drop the stored scan.
- Persist `net-usage` (JSON string) at most once every 60 s and in `disable()`.
- `disable()`: remove the timeout, save usage, destroy the indicator, null every field.
- Popup layout per the mockup: two columns (CPU | Memory), each: icon + title + bold total
  on the right, 4 px usage bar, faded sub-line (`cpuSubline(...)` / `formatMemTotals(...)`,
  hidden when empty), 5 rows `name … value` (`formatShare` / `formatMemKb`); separator;
  network rows `[network-wired-symbolic | network-wireless-signal-excellent-symbolic] label
  · <formatDataSize(used)> today` (the "· … today" part faded) `↓ formatRate` `↑
  formatRate`. Bar values: `formatPercent`, `↓${formatRateCompact(down)}
  ↑${formatRateCompact(up)}`. Faded = actor `opacity` ~150 (St CSS has no opacity).
- Build row actors once; update text on each tick (rebuild network rows only when the set
  of shown interfaces changes).

- [ ] **Step 1: Write the files above.** Run all unit tests again (`gjs -m` on the four
  test files) and `node --input-type=module --check < <file>` for `extension.js` and
  `panel.js`; `glib-compile-schemas extensions/system-monitor/schemas`; check 100-char
  lines with `rg -n '.{101,}' extensions/system-monitor`.
- [ ] **Step 2: Install for a manual run** —
  `ln -s "$PWD/extensions/system-monitor" ~/.local/share/gnome-shell/extensions/system-monitor@emanuel36`
  and add `system-monitor@emanuel36` to `org.gnome.shell enabled-extensions` (same Python
  snippet approach used for Next Up). Ask the user to restart the shell (Alt+F2, `r`).
- [ ] **Step 3: Verify in the shell with the user** — bar shows CPU/RAM/↓↑ right after
  Activities; popup matches the mockup; CPU list fills in after ~2 s; `journalctl --user
  -b | rg -i system-monitor` has no errors; unplugging the dock cable removes its row.
- [ ] **Step 4: Commit** `feat(system-monitor): add panel indicator and popup` (explicit
  paths, including the compiled-schema `.gitignore`).

### Task 6: Replace the old extensions

**Files:**
- Delete: `extensions/resource-monitor/`, `extensions/network-stats/`
- Modify: `README.md` (remove their two rows from the upstream table; add
  `| \`extensions/system-monitor\` | GPL-3.0 | 46 | none |` to the "written here from
  scratch" table with a note that it replaces both and borrows Resource Monitor's icons),
  `docs/superpowers/2026-10-22-contexto-inicial.md` (installed table rows and a Decisões
  entry).

- [ ] **Step 1: Back up and uninstall the old copies** — tarballs of
  `~/.local/share/gnome-shell/extensions/Resource_Monitor@Ory0n` and
  `network-stats@gnome.noroadsleft.xyz` into the session scratchpad;
  `gnome-extensions disable` + `uninstall` both; remove them from `enabled-extensions`.
- [ ] **Step 2: Top Bar Organizer** — in `/org/gnome/shell/extensions/top-bar-organizer/left-box-order`,
  replace `'Resource_Monitor@Ory0n-primary-0'` and `'NetworkStatsStatusView'` with a single
  `'system-monitor@emanuel36'` (keep it right after `'activities'`).
- [ ] **Step 3: Delete the two directories and update the docs** (`git rm -r`).
- [ ] **Step 4: Verify** — after a shell restart only the new indicator is in the left box;
  `rg -n "resource-monitor|network-stats" README.md` returns nothing.
- [ ] **Step 5: Commit** `chore: replace Resource Monitor and Network Stats` (explicit
  paths).

### Task 7: Finish the branch

- [ ] **Step 1:** Squash the branch's feature commits (Tasks 1–5, plus any fixups) into one
  `feat(system-monitor): add CPU, memory and network monitor` commit (bullet body per
  CLAUDE.md), keeping Task 6 as its own commit.
- [ ] **Step 2:** `git switch main && git merge --no-ff feat/system-monitor` and delete the
  branch. Don't push.
