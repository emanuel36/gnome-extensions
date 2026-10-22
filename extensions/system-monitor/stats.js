// Parsing of /proc text and the statistics derived from it. No I/O here.

export function parseCpuTimes(procStatText) {
    const line = procStatText.split('\n').find(l => l.startsWith('cpu '));
    // user nice system idle iowait irq softirq steal (guest time is already in user)
    const fields = line.trim().split(/\s+/).slice(1, 9).map(Number);
    return {
        total: fields.reduce((sum, v) => sum + v, 0),
        idle: fields[3] + fields[4],
    };
}

export function cpuPercent(prev, cur) {
    if (prev === null)
        return null;
    const total = cur.total - prev.total;
    if (total <= 0)
        return 0;
    return (total - (cur.idle - prev.idle)) * 100 / total;
}

export function parseMeminfo(text) {
    const value = key => Number(text.match(new RegExp(`^${key}:\\s+(\\d+)`, 'm'))[1]);
    return {totalKb: value('MemTotal'), availableKb: value('MemAvailable')};
}

export function memPercent(m) {
    return (m.totalKb - m.availableKb) * 100 / m.totalKb;
}

export function parseNetDev(text) {
    const counters = new Map();
    for (const line of text.split('\n').slice(2)) {
        const colon = line.indexOf(':');
        if (colon < 0)
            continue;
        const fields = line.slice(colon + 1).trim().split(/\s+/).map(Number);
        counters.set(line.slice(0, colon).trim(), {rx: fields[0], tx: fields[8]});
    }
    return counters;
}

/**
 * Bytes per second for the given interfaces between two samples.
 *
 * Args:
 *     prev: Counters from the previous sample, or null.
 *     cur: Counters from this sample.
 *     elapsedSec: Real time between the samples.
 *     names: Interfaces to report.
 *
 * Returns:
 *     Map of name to `{down, up}`; 0 when there is no usable previous value or the counter
 *     went backwards (interface reset).
 */
export function netRates(prev, cur, elapsedSec, names) {
    const rates = new Map();
    for (const name of names) {
        const before = prev?.get(name);
        const now = cur.get(name);
        if (!before || !now || elapsedSec <= 0) {
            rates.set(name, {down: 0, up: 0});
            continue;
        }
        const rate = delta => (delta > 0 ? delta / elapsedSec : 0);
        rates.set(name, {down: rate(now.rx - before.rx), up: rate(now.tx - before.tx)});
    }
    return rates;
}

export function parseProcStat(text) {
    const open = text.indexOf('(');
    const close = text.lastIndexOf(')');
    if (open < 0 || close < open)
        return null;
    // Fields after the command start at field 3 (state); utime and stime are 14 and 15
    const fields = text.slice(close + 2).split(' ');
    return {comm: text.slice(open + 1, close), ticks: Number(fields[11]) + Number(fields[12])};
}

export function parseRssAnonKb(statusText) {
    const match = statusText.match(/^RssAnon:\s+(\d+)/m);
    return match ? Number(match[1]) : 0;
}

function top(totals, n) {
    return [...totals.entries()]
        .map(([name, value]) => ({name, value}))
        .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name))
        .slice(0, n);
}

/**
 * Apps using the most CPU between two process scans.
 *
 * Args:
 *     prevScan: Map of pid to `{comm, ticks, rssAnonKb}` from the previous tick.
 *     curScan: Same, from this tick.
 *     totalDelta: Growth of the total CPU time in /proc/stat between the scans.
 *     n: How many apps to return.
 *
 * Returns:
 *     `[{name, value}]` with value as a percentage of all CPUs, highest first. Only pids
 *     present in both scans count.
 */
export function topCpu(prevScan, curScan, totalDelta, n = 5) {
    const totals = new Map();
    if (totalDelta <= 0)
        return [];
    for (const [pid, cur] of curScan) {
        const prev = prevScan.get(pid);
        if (!prev || prev.comm !== cur.comm)
            continue;
        const delta = cur.ticks - prev.ticks;
        if (delta > 0)
            totals.set(cur.comm, (totals.get(cur.comm) ?? 0) + delta / totalDelta * 100);
    }
    return top(totals, n);
}

/**
 * CPU top list between two popup samples.
 *
 * Args:
 *     prev: `{procs, cpuTotal}` taken at the previous scan, or null right after opening.
 *     cur: `{procs, cpuTotal}` for this scan; `cpuTotal` is read at scan time so the
 *         per-process and total deltas cover the same window.
 *
 * Returns:
 *     `topCpu()` output, or null when there is no previous sample yet.
 */
export function sampleCpuTop(prev, cur) {
    return prev ? topCpu(prev.procs, cur.procs, cur.cpuTotal - prev.cpuTotal) : null;
}

export function topMemory(curScan, n = 5) {
    const totals = new Map();
    for (const {comm, rssAnonKb} of curScan.values())
        totals.set(comm, (totals.get(comm) ?? 0) + rssAnonKb);
    return top(totals, n);
}

export function interfaceLabels(ifaces) {
    const kindName = {cable: 'Ethernet', wifi: 'Wi-Fi'};
    const count = kind => ifaces.filter(i => i.kind === kind).length;
    return new Map(ifaces.map(({name, kind}) =>
        [name, count(kind) > 1 ? `${kindName[kind]} ${name}` : kindName[kind]]));
}
