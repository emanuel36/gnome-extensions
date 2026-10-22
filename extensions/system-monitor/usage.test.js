// Run with: gjs -m extensions/system-monitor/usage.test.js
import System from 'system';

import {localDate, updateUsage} from './usage.js';

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
check('new interface baselined',
    updateUsage(s2, new Map([['wlan0', {rx: 9, tx: 1}]]), '2026-10-22').ifaces.wlan0,
    {used: 0, rx: 9, tx: 1});
check('broken state starts fresh', updateUsage({junk: true}, c(5, 5), '2026-10-22'),
    {date: '2026-10-22', ifaces: {eth0: {used: 0, rx: 5, tx: 5}}});
check('null ifaces starts fresh',
    updateUsage({date: '2026-10-22', ifaces: null}, c(5, 5), '2026-10-22').ifaces.eth0,
    {used: 0, rx: 5, tx: 5});
const withId = (rx, tx, id) => new Map([['eth0', {rx, tx, id}]]);
const b1 = updateUsage(null, withId(1000, 100, 'boot1:2'), '2026-10-22');
const b2 = updateUsage(b1, withId(1500, 150, 'boot1:2'), '2026-10-22');
check('same id counts the delta', b2.ifaces.eth0.used, 550);
check('new boot counts all bytes since reset even when counters grew past the old ones',
    updateUsage(b2, withId(9000, 900, 'boot2:2'), '2026-10-22').ifaces.eth0.used, 10450);
check('replugged interface (new ifindex) counts all bytes',
    updateUsage(b2, withId(2000, 200, 'boot1:7'), '2026-10-22').ifaces.eth0.used, 2750);
check('id is stored', b2.ifaces.eth0.id, 'boot1:2');
check('local date', localDate(new Date(2026, 9, 2, 23, 59)), '2026-10-02');

if (failures > 0) {
    print(`\n${failures} failed`);
    System.exit(1);
}
print('\nall passed');
