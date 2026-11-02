// Run with: gjs -m extensions/window-layout/share.test.js
import System from 'system';

import {dockOffset, mergeSaved, placeOn, planRestore, planShare} from './share.js';

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
const MAIN = {index: 0, x: 1080, y: 32, width: 1920, height: 1048};
const PORTRAIT = {index: 1, x: 0, y: 0, width: 1080, height: 1920};

check('placeOn keeps the offset',
    placeOn({x: 1180, y: 132, width: 800, height: 600}, MAIN, PORTRAIT),
    {x: 100, y: 100, width: 800, height: 600});
check('placeOn shrinks a window wider than the target',
    placeOn({x: 1080, y: 32, width: 1920, height: 1048}, MAIN, PORTRAIT),
    {x: 0, y: 0, width: 1080, height: 1048});
check('placeOn shifts a window back inside',
    placeOn({x: 2500, y: 32, width: 400, height: 300}, MAIN, PORTRAIT),
    {x: 680, y: 0, width: 400, height: 300});

const wins = [
    {id: 'chrome', monitor: 0, rect: {x: 1180, y: 132, width: 800, height: 600}},
    {id: 'term', monitor: 0, rect: {x: 1080, y: 32, width: 1920, height: 1048}},
    {id: 'slack', monitor: 1, rect: {x: 0, y: 0, width: 1080, height: 1152}},
];
check('share a window already on the primary', planShare([MAIN, PORTRAIT], 0, wins, 'chrome'),
    [{id: 'term', monitor: 1, rect: {x: 0, y: 0, width: 1080, height: 1048}}]);
check('share a window from the secondary', planShare([MAIN, PORTRAIT], 0, wins, 'slack'), [
    {id: 'slack', monitor: 0, rect: {x: 1080, y: 32, width: 1080, height: 1048}},
    {id: 'chrome', monitor: 1, rect: {x: 100, y: 100, width: 800, height: 600}},
    {id: 'term', monitor: 1, rect: {x: 0, y: 0, width: 1080, height: 1048}},
]);
check('no secondary monitor, no plan', planShare([MAIN], 0, wins, 'chrome'), []);

check('saved positions survive a switch',
    mergeSaved({a: 1, b: 2}, {a: 9, c: 3}), {a: 1, b: 2, c: 3});
check('restore skips closed windows',
    planRestore({a: 1, b: 2}, new Set(['b'])), [['b', 2]]);

check('dock offset, primary first', dockOffset(0, 1, 2), 1);
check('dock offset, primary second', dockOffset(1, 0, 2), 1);
check('dock offset, three monitors', dockOffset(2, 1, 3), 2);

System.exit(failures ? 1 : 0);
