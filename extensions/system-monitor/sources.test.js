// Smoke test against this machine. Run with: gjs -m extensions/system-monitor/sources.test.js
import GLib from 'gi://GLib';
import System from 'system';

import {
    findCpuTempInput, listPhysicalInterfaces, readBootId, readCpuTempC, readCpuTimes,
    readMaxCpuFreqKhz,
    readMeminfo, readNetCounters, scanProcesses,
} from './sources.js';

let failures = 0;

function ok(name, condition, detail = '') {
    if (condition) {
        print(`ok   ${name}`);
    } else {
        failures++;
        print(`FAIL ${name} ${detail}`);
    }
}

ok('cpu times', readCpuTimes()?.total > 0);
ok('meminfo', readMeminfo()?.totalKb > 0);
ok('net counters', readNetCounters().has('lo'));

const ifaces = listPhysicalInterfaces();
const names = ifaces.map(i => i.name);
ok('wifi found', ifaces.some(i => i.name === 'wlp0s20f3' && i.kind === 'wifi'),
    JSON.stringify(ifaces));
const virtual = ['docker0', 'lo', 'gpd0', 'zcctun0'];
ok('virtual interfaces left out', !virtual.some(n => names.includes(n)),
    JSON.stringify(names));
ok('cable before wifi', ifaces.findIndex(i => i.kind === 'wifi') >
    ifaces.findLastIndex(i => i.kind === 'cable'), JSON.stringify(ifaces));

ok('ifindex', ifaces.every(i => Number.isInteger(i.ifindex) && i.ifindex > 0),
    JSON.stringify(ifaces));
ok('boot id', /^[0-9a-f-]{36}$/.test(readBootId()), String(readBootId()));

const tempInput = findCpuTempInput();
ok('temp input', tempInput?.endsWith('_input'), String(tempInput));
const temp = readCpuTempC(tempInput);
ok('temp range', temp > 10 && temp < 110, String(temp));
ok('temp without sensor', readCpuTempC(null) === null);
ok('max freq', readMaxCpuFreqKhz() > 100000, String(readMaxCpuFreqKhz()));

const start = GLib.get_monotonic_time();
const procs = scanProcesses();
const ms = (GLib.get_monotonic_time() - start) / 1000;
print(`     scanProcesses: ${procs.size} processes in ${ms.toFixed(1)} ms`);
ok('process count', procs.size > 100, String(procs.size));
ok('init process', procs.get(1)?.comm.length > 0, JSON.stringify(procs.get(1)));
ok('scan under 200 ms', ms < 200, `${ms} ms`);
ok('root process memory readable', [...procs.values()].some(p => p.rssAnonKb > 0));

if (failures > 0) {
    print(`\n${failures} failed`);
    System.exit(1);
}
print('\nall passed');
