// Run with: gjs -m extensions/window-layout/layout.test.js
import System from 'system';

import {planLayout, sideMonitorIndex} from './layout.js';

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

// The docked setup: portrait monitor on the left, primary on the right.
const PORTRAIT = {index: 1, x: 0, y: 0, width: 1080, height: 1920};
const MAIN = {index: 0, x: 1080, y: 32, width: 1920, height: 1048};
const LAPTOP = {index: 0, x: 0, y: 32, width: 1920, height: 1168};
const TOP = {x: 0, y: 0, width: 1080, height: 1152};
const BOTTOM = {x: 0, y: 1152, width: 1080, height: 768};

check('side monitor is the portrait one', sideMonitorIndex([MAIN, PORTRAIT], 0), 1);
check('single monitor has no side', sideMonitorIndex([LAPTOP], 0), -1);
check('falls back to any non-primary monitor',
    sideMonitorIndex([MAIN, {index: 1, x: 3000, y: 0, width: 1920, height: 1080}], 0), 1);

const windows = [
    {id: 'chrome', wmClass: 'Google-chrome', seq: 5},
    {id: 'slack', wmClass: 'slack', seq: 2},
    {id: 'discord', wmClass: 'discord', seq: 3},
    {id: 'huddle', wmClass: 'slack', seq: 9},
];

check('docked layout', planLayout([MAIN, PORTRAIT], 0, windows), [
    {id: 'chrome', action: 'maximize', monitor: 0},
    {id: 'slack', action: 'tile', monitor: 1, rect: TOP},
    {id: 'discord', action: 'tile', monitor: 1, rect: BOTTOM},
]);

check('laptop only maximizes everything', planLayout([LAPTOP], 0, windows), [
    {id: 'chrome', action: 'maximize', monitor: 0},
    {id: 'slack', action: 'maximize', monitor: 0},
    {id: 'discord', action: 'maximize', monitor: 0},
    {id: 'huddle', action: 'maximize', monitor: 0},
]);

check('zapzap alone takes the bottom slot',
    planLayout([MAIN, PORTRAIT], 0, [{id: 'zap', wmClass: 'ZapZap', seq: 1}]), [
        {id: 'zap', action: 'tile', monitor: 1, rect: BOTTOM},
    ]);

check('discord and zapzap share the slot, discord applied last', planLayout(
    [MAIN, PORTRAIT], 0,
    [{id: 'discord', wmClass: 'discord', seq: 1}, {id: 'zap', wmClass: 'zapzap', seq: 2}]), [
    {id: 'zap', action: 'tile', monitor: 1, rect: BOTTOM},
    {id: 'discord', action: 'tile', monitor: 1, rect: BOTTOM},
]);

System.exit(failures ? 1 : 0);
