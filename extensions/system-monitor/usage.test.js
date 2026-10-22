// Run with: gjs -m extensions/system-monitor/usage.test.js
import System from 'system';

import {KEPT_DAYS, localDate, updateUsage, usageFor} from './usage.js';

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
check('fresh state counts nothing', s1.ifaces.eth0,
    {rx: 1000, tx: 100, days: {'2026-10-22': 0}, older: 0});
const s2 = updateUsage(s1, c(1500, 150), '2026-10-22');
check('normal delta', s2.ifaces.eth0.days['2026-10-22'], 550);
check('input not mutated', s1.ifaces.eth0.days['2026-10-22'], 0);
check('counter reset adds bytes since reset',
    updateUsage(s2, c(200, 20), '2026-10-22').ifaces.eth0.days['2026-10-22'], 770);
check('new day starts its own total', updateUsage(s2, c(1600, 160), '2026-10-23').ifaces.eth0,
    {rx: 1600, tx: 160, days: {'2026-10-22': 550, '2026-10-23': 110}, older: 0});
check('absent interface kept',
    updateUsage(s2, new Map(), '2026-10-22').ifaces.eth0, s2.ifaces.eth0);
check('new interface baselined',
    updateUsage(s2, new Map([['wlan0', {rx: 9, tx: 1}]]), '2026-10-22').ifaces.wlan0,
    {rx: 9, tx: 1, days: {'2026-10-22': 0}, older: 0});
check('broken state starts fresh', updateUsage({junk: true}, c(5, 5), '2026-10-22'),
    {ifaces: {eth0: {rx: 5, tx: 5, days: {'2026-10-22': 0}, older: 0}}});
check('null ifaces starts fresh',
    updateUsage({ifaces: null}, c(5, 5), '2026-10-22').ifaces.eth0.days,
    {'2026-10-22': 0});

const withId = (rx, tx, id) => new Map([['eth0', {rx, tx, id}]]);
const b1 = updateUsage(null, withId(1000, 100, 'boot1:2'), '2026-10-22');
const b2 = updateUsage(b1, withId(1500, 150, 'boot1:2'), '2026-10-22');
check('same id counts the delta', b2.ifaces.eth0.days['2026-10-22'], 550);
check('new boot counts all bytes since reset even when counters grew past the old ones',
    updateUsage(b2, withId(9000, 900, 'boot2:2'), '2026-10-22').ifaces.eth0.days['2026-10-22'],
    10450);
check('replugged interface (new ifindex) counts all bytes',
    updateUsage(b2, withId(2000, 200, 'boot1:7'), '2026-10-22').ifaces.eth0.days['2026-10-22'],
    2750);
check('id is stored', b2.ifaces.eth0.id, 'boot1:2');

check('old daily state is migrated',
    updateUsage({date: '2026-10-22', ifaces: {eth0: {used: 300, rx: 1000, tx: 100}}},
        c(1100, 100), '2026-10-22').ifaces.eth0,
    {rx: 1100, tx: 100, days: {'2026-10-22': 400}, older: 0});

check('days past the window fold into older',
    updateUsage({ifaces: {eth0: {rx: 0, tx: 0, older: 5,
        days: {'2026-09-01': 100, '2026-09-23': 20, '2026-09-24': 30}}}},
    c(0, 0), '2026-10-22').ifaces.eth0,
    {rx: 0, tx: 0, days: {'2026-09-23': 20, '2026-09-24': 30, '2026-10-22': 0}, older: 105});
check('kept days cover the 30-day window', KEPT_DAYS, 30);

const history = {
    rx: 0, tx: 0, older: 1000,
    days: {'2026-09-23': 1, '2026-10-15': 10, '2026-10-16': 100, '2026-10-22': 10000},
};
check('day', usageFor(history, 'day', '2026-10-22'), 10000);
check('week is today and the 6 days before', usageFor(history, 'week', '2026-10-22'), 10100);
check('month is today and the 29 days before',
    usageFor(history, 'month', '2026-10-22'), 10111);
check('all time includes folded days', usageFor(history, 'all', '2026-10-22'), 11111);
check('nothing today', usageFor(history, 'day', '2026-10-23'), 0);
check('unknown interface', usageFor(undefined, 'all', '2026-10-22'), 0);
check('window across a DST change',
    usageFor({older: 0, days: {'2026-10-26': 7}}, 'week', '2026-11-01'), 7);

check('local date', localDate(new Date(2026, 9, 2, 23, 59)), '2026-10-02');

if (failures > 0) {
    print(`\n${failures} failed`);
    System.exit(1);
}
print('\nall passed');
