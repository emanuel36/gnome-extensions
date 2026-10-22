// Reads from /proc and /sys. These are small in-memory files, so plain sync reads are fine.

import GLib from 'gi://GLib';

import {parseCpuTimes, parseMeminfo, parseNetDev, parseProcStat, parseRssAnonKb} from './stats.js';

const decoder = new TextDecoder('utf-8');

export function readText(path) {
    try {
        const [, contents] = GLib.file_get_contents(path);
        return decoder.decode(contents);
    } catch {
        return null;
    }
}

function listDir(path) {
    const names = [];
    try {
        const dir = GLib.Dir.open(path, 0);
        for (let name = dir.read_name(); name !== null; name = dir.read_name())
            names.push(name);
        dir.close();
    } catch {
        // Missing directory: nothing to list
    }
    return names;
}

const exists = path => GLib.file_test(path, GLib.FileTest.EXISTS);

export function readCpuTimes() {
    const text = readText('/proc/stat');
    return text ? parseCpuTimes(text) : null;
}

export function readMeminfo() {
    const text = readText('/proc/meminfo');
    return text ? parseMeminfo(text) : null;
}

export function readNetCounters() {
    const text = readText('/proc/net/dev');
    return text ? parseNetDev(text) : new Map();
}

/**
 * Network interfaces backed by hardware (cable and Wi-Fi), leaving out virtual ones such
 * as docker bridges, veth pairs and VPN tunnels.
 *
 * Returns:
 *     `[{name, kind: 'cable'|'wifi', up, ifindex}]`, cables first, then by name.
 */
export function listPhysicalInterfaces() {
    const ifaces = [];
    for (const name of listDir('/sys/class/net')) {
        const base = `/sys/class/net/${name}`;
        if (!exists(`${base}/device`))
            continue;
        ifaces.push({
            name,
            kind: exists(`${base}/wireless`) ? 'wifi' : 'cable',
            up: readText(`${base}/operstate`)?.trim() === 'up',
            ifindex: Number(readText(`${base}/ifindex`)),
        });
    }
    const order = {cable: 0, wifi: 1};
    return ifaces.sort((a, b) => order[a.kind] - order[b.kind] || a.name.localeCompare(b.name));
}

// Changes on every boot; with the ifindex it tells when interface counters restarted
export function readBootId() {
    return readText('/proc/sys/kernel/random/boot_id')?.trim() ?? null;
}

export function findCpuTempInput() {
    for (const hwmon of listDir('/sys/class/hwmon')) {
        const base = `/sys/class/hwmon/${hwmon}`;
        if (readText(`${base}/name`)?.trim() !== 'coretemp')
            continue;
        for (const file of listDir(base)) {
            const match = file.match(/^(temp\d+)_label$/);
            if (match && readText(`${base}/${file}`)?.trim() === 'Package id 0')
                return `${base}/${match[1]}_input`;
        }
    }
    return null;
}

export function readCpuTempC(path) {
    if (path === null)
        return null;
    const text = readText(path);
    return text ? Number(text) / 1000 : null;
}

export function readMaxCpuFreqKhz() {
    let max = null;
    for (const cpu of listDir('/sys/devices/system/cpu')) {
        if (!/^cpu\d+$/.test(cpu))
            continue;
        const text = readText(`/sys/devices/system/cpu/${cpu}/cpufreq/scaling_cur_freq`);
        if (text)
            max = Math.max(max ?? 0, Number(text));
    }
    return max;
}

/**
 * One pass over every process.
 *
 * Returns:
 *     Map of pid to `{comm, ticks, rssAnonKb}`; processes that exit mid-scan are skipped.
 */
export function scanProcesses() {
    const procs = new Map();
    for (const entry of listDir('/proc')) {
        if (!/^\d+$/.test(entry))
            continue;
        const stat = readText(`/proc/${entry}/stat`);
        const parsed = stat ? parseProcStat(stat) : null;
        if (!parsed)
            continue;
        const status = readText(`/proc/${entry}/status`) ?? '';
        procs.set(Number(entry), {...parsed, rssAnonKb: parseRssAnonKb(status)});
    }
    return procs;
}
