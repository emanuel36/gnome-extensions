// Run with: gjs -m extensions/panel-tidy/order.test.js
import System from 'system';

import {
    addNewKeys, fallbackName, forgetKey, itemKey, mergeToggles, moveKey, toggleId,
} from './order.js';

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

const saved = {left: ['activities'], center: ['dateMenu', 'todoTxt'], right: ['quickSettings']};

check('nothing new',
    addNewKeys(saved, {left: ['activities'], center: ['todoTxt', 'dateMenu'], right: []}),
    {orders: saved, changed: false});
check('new key after its listed neighbour',
    addNewKeys(saved, {left: [], center: ['dateMenu', 'nextUp', 'todoTxt'], right: []}).orders
        .center,
    ['dateMenu', 'nextUp', 'todoTxt']);
check('new key first when nothing listed before it',
    addNewKeys(saved, {left: [], center: [], right: ['slack', 'quickSettings']}).orders.right,
    ['slack', 'quickSettings']);
check('neighbour listed in another box is skipped',
    addNewKeys(saved, {left: [], center: [], right: ['quickSettings', 'todoTxt', 'slack']})
        .orders.right,
    ['quickSettings', 'slack']);
check('several new keys keep their bar order',
    addNewKeys({left: [], center: [], right: []}, {left: [], center: [], right: ['a', 'b']})
        .orders.right,
    ['a', 'b']);

check('move within a box', moveKey(saved, 'todoTxt', 'center', 'dateMenu').center,
    ['todoTxt', 'dateMenu']);
check('move to the end of another box', moveKey(saved, 'todoTxt', 'right', null),
    {left: ['activities'], center: ['dateMenu'], right: ['quickSettings', 'todoTxt']});
check('move before itself keeps it in the box', moveKey(saved, 'todoTxt', 'center', 'todoTxt')
    .center, ['dateMenu', 'todoTxt']);

check('forget', forgetKey(saved, 'dateMenu').center, ['todoTxt']);

check('toggle id of a specific class', toggleId('NightLightToggle', 'Night Light'),
    'NightLightToggle');
check('toggle id of a generic class', toggleId('QuickToggle', 'Headset'), 'QuickToggle:Headset');

check('key of a system item', itemKey('dateMenu', null), 'dateMenu');
check('key of an app icon', itemKey('appindicator-:1.129@/org/ayatana/NotificationItem/livepatch',
    'livepatch'), 'appindicator-kstatusnotifieritem-livepatch');
check('key of an app icon without id yet', itemKey('appindicator-:1.129@/x', undefined), null);
check('key of a legacy tray icon', itemKey('appindicator-legacy:Slack:246928', null),
    'appindicator-legacy-Slack');

check('fallback name of a legacy tray icon', fallbackName('appindicator-legacy-Discord'),
    'Discord');
check('fallback name of a cryptic app id', fallbackName('appindicator-legacy-ZSTray6.Deb'),
    'Zscaler');
check('fallback name of an appindicator',
    fallbackName('appindicator-kstatusnotifieritem-Slack_status_icon_1'), 'Slack');
check('fallback name of an extension uuid', fallbackName('foo-bar@someone.org'), 'foo-bar');
check('fallback name of a plain role', fallbackName('todoTxt'), 'todoTxt');

check('merge toggles keeps order and appends new',
    mergeToggles([['A', 'a'], ['B', 'b']], [['C', 'c'], ['A', 'a2']]),
    [['A', 'a2'], ['B', 'b'], ['C', 'c']]);

if (failures)
    System.exit(1);
