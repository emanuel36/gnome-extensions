// Run with: gjs -m extensions/system-monitor/format.test.js
import System from 'system';

import {
    cpuSubline, formatDataSize, formatMemKb, formatMemTotals, formatPercent, formatRate,
    formatRateCompact, formatShare,
} from './format.js';

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

check('compact zero', formatRateCompact(0), '0B');
check('compact bytes', formatRateCompact(950), '950B');
check('compact kilo', formatRateCompact(80000), '80K');
check('compact one decimal', formatRateCompact(1234567), '1.2M');
check('compact large', formatRateCompact(12345678), '12M');
check('compact giga', formatRateCompact(2.5e9), '2.5G');
check('rate zero', formatRate(0), '0 B/s');
check('rate kilo', formatRate(80000), '80 KB/s');
check('rate mega', formatRate(1234567), '1.2 MB/s');
check('size zero', formatDataSize(0), '0 B');
check('size mega', formatDataSize(550e6), '550 MB');
check('size giga', formatDataSize(4.04e9), '4.0 GB');
check('mem kilo', formatMemKb(512), '512 KB');
check('mem mega', formatMemKb(965 * 1024), '965 MB');
check('mem giga', formatMemKb(3549 * 1024), '3.5 GB');
check('mem totals', formatMemTotals(17.9 * 1048576, 31.0 * 1048576), '17.9 / 31.0 GB');
check('percent', formatPercent(57.6), '58%');
check('share', formatShare(0.66), '0.7%');
check('subline both', cpuSubline(68.4, 3708894), '68 °C · 3.7 GHz');
check('subline temp only', cpuSubline(68, null), '68 °C');
check('subline freq only', cpuSubline(null, 3708894), '3.7 GHz');
check('subline none', cpuSubline(null, null), '');

if (failures > 0) {
    print(`\n${failures} failed`);
    System.exit(1);
}
print('\nall passed');
