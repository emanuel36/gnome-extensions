// Run with: gjs -m extensions/system-monitor/stats.test.js
import System from 'system';

import {
    cpuPercent, interfaceLabels, memPercent, netRates, parseCpuTimes, parseMeminfo,
    parseNetDev, parseProcStat, parseRssAnonKb, sampleCpuTop, topCpu, topMemory,
} from './stats.js';

let failures = 0;

function check(name, actual, expected) {
    const a = JSON.stringify(actual);
    const e = JSON.stringify(expected);
    if (a === e) {
        print(`ok   ${name}`);
    } else {
        failures++;
        print(`FAIL ${name}\n     expected ${e}\n     got      ${a}`);
    }
}

// Same layout as /proc/net/dev (two header lines, 8 receive then 8 transmit fields),
// with the column padding squeezed
const NETDEV = `Inter-|   Receive |  Transmit
 face |bytes packets errs drop fifo frame compressed multicast|bytes packets ...
    lo: 10 1 0 0 0 0 0 0 10 1 0 0 0 0 0 0
  eth0:    5000 40 0 0 0 0 0 0 300 5 0 0 0 0 0 0
wlp0s20f3:0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0
`;

// {name: [rx, tx]} -> Map
const map = obj => new Map(Object.entries(obj).map(([k, [rx, tx]]) => [k, {rx, tx}]));
// {pid: [comm, ticks]} -> scan Map
const scan = obj => new Map(Object.entries(obj)
    .map(([pid, [comm, ticks]]) => [Number(pid), {comm, ticks, rssAnonKb: 0}]));
// [[comm, kb], ...] -> scan Map
const memScan = list =>
    new Map(list.map(([comm, kb], i) => [i + 1, {comm, ticks: 0, rssAnonKb: kb}]));
const SIX_APPS = [['a', 6], ['b', 5], ['c', 4], ['d', 3], ['e', 2], ['f', 1]];

const stat1 = 'cpu  100 0 50 800 50 0 0 0 0 0\ncpu0 1 2 3 4 5 6 7 8 0 0\n';
const stat2 = 'cpu  130 0 60 850 60 0 0 0 0 0\n';
check('cpu times', parseCpuTimes(stat1), {total: 1000, idle: 850});
check('cpu percent', cpuPercent(parseCpuTimes(stat1), parseCpuTimes(stat2)), 40);
check('cpu percent first sample', cpuPercent(null, parseCpuTimes(stat1)), null);
check('cpu percent no time passed', cpuPercent(parseCpuTimes(stat1), parseCpuTimes(stat1)), 0);

check('meminfo', parseMeminfo('MemTotal: 1000 kB\nMemFree: 1 kB\nMemAvailable: 420 kB\n'),
    {totalKb: 1000, availableKb: 420});
check('mem percent', memPercent({totalKb: 1000, availableKb: 420}), 58);

check('net dev', [...parseNetDev(NETDEV).entries()],
    [['lo', {rx: 10, tx: 10}], ['eth0', {rx: 5000, tx: 300}], ['wlp0s20f3', {rx: 0, tx: 0}]]);
check('netRates divides by elapsed seconds',
    [...netRates(map({eth0: [1000, 100]}), map({eth0: [5000, 300]}), 4, ['eth0'])],
    [['eth0', {down: 1000, up: 50}]]);
check('netRates clamps resets to 0',
    [...netRates(map({eth0: [9000, 900]}), map({eth0: [100, 10]}), 2, ['eth0'])],
    [['eth0', {down: 0, up: 0}]]);
check('netRates without previous sample',
    [...netRates(null, map({eth0: [5000, 300]}), 2, ['eth0'])],
    [['eth0', {down: 0, up: 0}]]);

check('parseProcStat handles parens and spaces',
    parseProcStat('42 (tmux: server (x)) S 1 2 3 4 5 6 7 8 9 10 70 30 0 0'),
    {comm: 'tmux: server (x)', ticks: 100});
check('parseProcStat garbage', parseProcStat(''), null);
check('rss anon', parseRssAnonKb('Name:\tjava\nRssAnon:\t  3634176 kB\n'), 3634176);
check('rss anon missing', parseRssAnonKb('Name:\tkthreadd\n'), 0);

check('topCpu groups by name',
    topCpu(scan({1: ['chrome', 100], 2: ['chrome', 50], 3: ['code', 10]}),
        scan({1: ['chrome', 130], 2: ['chrome', 60], 3: ['code', 30]}), 200),
    [{name: 'chrome', value: 20}, {name: 'code', value: 10}]);
check('topCpu ignores pids not in both scans',
    topCpu(scan({1: ['a', 10], 2: ['gone', 10]}), scan({1: ['a', 20], 3: ['new', 999]}), 100),
    [{name: 'a', value: 10}]);
check('sampleCpuTop needs a previous sample',
    sampleCpuTop(null, {procs: scan({1: ['a', 10]}), cpuTotal: 100}), null);
check('sampleCpuTop uses each sample\'s own CPU total',
    sampleCpuTop({procs: scan({1: ['a', 10]}), cpuTotal: 1000},
        {procs: scan({1: ['a', 30]}), cpuTotal: 1200}),
    [{name: 'a', value: 10}]);
check('topMemory sums and limits to n', topMemory(memScan(SIX_APPS)).map(e => e.name),
    ['a', 'b', 'c', 'd', 'e']);
check('topMemory groups by name', topMemory(memScan([['x', 1], ['y', 3], ['x', 5]])),
    [{name: 'x', value: 6}, {name: 'y', value: 3}]);

check('labels single', [...interfaceLabels([{name: 'eth0', kind: 'cable'},
    {name: 'wlp0s20f3', kind: 'wifi'}])], [['eth0', 'Ethernet'], ['wlp0s20f3', 'Wi-Fi']]);
check('labels two cables', [...interfaceLabels([{name: 'eth0', kind: 'cable'},
    {name: 'enp0s31f6', kind: 'cable'}])],
    [['eth0', 'Ethernet eth0'], ['enp0s31f6', 'Ethernet enp0s31f6']]);

if (failures > 0) {
    print(`\n${failures} failed`);
    System.exit(1);
}
print('\nall passed');
