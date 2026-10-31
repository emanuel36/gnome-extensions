// Run with: gjs -m extensions/panel-tidy/network.test.js
import System from 'system';

import {
    cableNames, cableRows, headerSummary, profilesFor, signalIcon, summary, tileAction, tileIcon,
    tileOn, wifiIcon, wifiOnly,
} from './network.js';

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

const usb = {
    device: 'eth0', name: 'USB Ethernet', speed: '1 Gb/s', present: true, connected: true,
    profiles: [{id: 'netplan-eth0', name: 'netplan-eth0'}, {id: 'Internet', name: 'Internet'}],
    active: 'netplan-eth0',
};
const builtin = {
    device: 'enp0s31f6', name: 'Built-in Ethernet', speed: '1 Gb/s', present: true,
    connected: true, profiles: [{id: 'Internet', name: 'Internet'}], active: 'Internet',
};
const wifiOn = {present: true, connected: true, ssid: 'Emanuel'};
const wifiOff = {present: true, connected: false, ssid: null};

check('summary 2 cables + wifi', summary(2, true), '2 Wired · Wi-Fi');
check('summary 3 cables', summary(3, false), '3 Wired');
check('summary 1 cable + wifi', summary(1, true), 'Wired · Wi-Fi');
check('summary 1 cable', summary(1, false), 'Wired');
check('summary wifi only', summary(0, true), 'Wi-Fi');
check('summary nothing', summary(0, false), 'Disconnected');

check('icon with a cable', tileIcon(1), 'network-wired-symbolic');
check('icon without a cable', tileIcon(0), 'network-wireless-signal-excellent-symbolic');

check('signal icon levels',
    [100, 80, 79, 55, 54, 30, 29, 5, 4, 0].map(signalIcon),
    ['excellent', 'excellent', 'good', 'good', 'ok', 'ok', 'weak', 'weak', 'none', 'none']
        .map(l => `network-wireless-signal-${l}-symbolic`));

check('on with a cable only', tileOn([usb], wifiOff), true);
check('on with wifi only', tileOn([], wifiOn), true);
check('off when nothing is up', tileOn([{...usb, connected: false}], wifiOff), false);

check('header two cables + ssid', headerSummary([usb, builtin], wifiOn), '2 Wired · Emanuel');
check('header one cable', headerSummary([usb], wifiOff), 'USB Ethernet');
check('header wifi only', headerSummary([], wifiOn), 'Emanuel');
check('header nothing', headerSummary([], wifiOff), 'Disconnected');

check('rows skip unplugged cables',
    cableRows([usb, {...builtin, present: false}]).map(r => r.device), ['eth0']);
check('row of a connected cable',
    cableRows([builtin])[0],
    {device: 'enp0s31f6', title: 'Built-in Ethernet', subtitle: 'Internet · 1 Gb/s', on: true,
        profiles: []});
check('subtitle shows the profile name when the id is a uuid',
    cableRows([{...builtin, profiles: [{id: 'u-1', name: 'Internet'}], active: 'u-1'}])[0]
        .subtitle,
    'Internet · 1 Gb/s');
check('row of a switched-off cable keeps the link speed',
    cableRows([{...builtin, connected: false, active: null}])[0].subtitle,
    'Disconnected · 1 Gb/s');
check('row with no link speed',
    cableRows([{...builtin, connected: false, active: null, speed: ''}])[0].subtitle,
    'Disconnected');
check('profiles listed only with several, active flagged',
    cableRows([usb])[0].profiles,
    [{id: 'netplan-eth0', name: 'netplan-eth0', active: true},
        {id: 'Internet', name: 'Internet', active: false}]);

const eth0 = {iface: 'eth0', mac: 'AA:AA'};
const profiles = [
    {id: 'a', name: 'a', iface: 'enp0s31f6', mac: null},
    {id: 'b', name: 'b', iface: null, mac: 'BB:BB'},
    {id: 'c', name: 'c', iface: null, mac: null},
    {id: 'd', name: 'd', iface: 'eth0', mac: null},
];
check('profile bound to another interface is dropped',
    profilesFor(profiles, eth0).map(p => p.id), ['c', 'd']);
check('profile bound to another mac is dropped',
    profilesFor(profiles, {iface: 'enp0s31f6', mac: 'BB:BB'}).map(p => p.id), ['a', 'b', 'c']);
check('unbound profile is kept for both devices',
    [eth0, {iface: 'enp0s31f6', mac: 'CC:CC'}]
        .map(d => profilesFor(profiles, d).some(p => p.id === 'c')), [true, true]);
check('profilesFor returns only id and name',
    profilesFor(profiles, eth0)[0], {id: 'c', name: 'c'});

const memory = {cables: [{device: 'eth0', profile: 'netplan-eth0'}], wifi: 'Emanuel'};
const down = {...usb, connected: false, active: null};
check('click while connected disconnects and remembers',
    tileAction([usb], wifiOn, null), {kind: 'disconnect', remember: memory});
check('click with nothing up reconnects what was remembered',
    tileAction([down], wifiOff, memory), {kind: 'reconnect', targets: memory});
check('click with nothing up and nothing remembered opens the menu',
    tileAction([down], wifiOff, null), {kind: 'openMenu'});
check('wifi that was off is not remembered',
    tileAction([usb], wifiOff, null).remember,
    {cables: [{device: 'eth0', profile: 'netplan-eth0'}], wifi: null});
check('reconnect names no wifi when none was remembered',
    tileAction([down], wifiOff, {cables: memory.cables, wifi: null}).targets.wifi, null);
check('unplugged cables are not remembered',
    tileAction([usb, {...builtin, present: false}], wifiOff, null).remember.cables
        .map(c => c.device), ['eth0']);

const PCI = '/sys/devices/pci0000:00/0000:00:1f.6/net/enp0s31f6';
const USB = '/sys/devices/pci0000:00/0000:00:14.0/usb2/2-3/2-3:1.0/net/eth0';
check('names a USB adapter Dock and a built-in port Ethernet',
    cableNames([USB, PCI]), ['Dock', 'Ethernet']);
check('numbers names that would repeat',
    cableNames([USB, PCI, USB.replace('2-3', '2-4')]), ['Dock 1', 'Ethernet', 'Dock 2']);

check('wifi only without plugged cables',
    wifiOnly([{...usb, present: false}], wifiOn), true);
check('not wifi only with a plugged cable', wifiOnly([down], wifiOn), false);
check('not wifi only without a wifi device', wifiOnly([], {...wifiOff, present: false}), false);
check('wifi icon when off', wifiIcon({...wifiOff, enabled: false}),
    'network-wireless-disabled-symbolic');
check('wifi icon when on but not connected', wifiIcon({...wifiOff, enabled: true}),
    'network-wireless-offline-symbolic');
check('wifi icon when connected', wifiIcon({...wifiOn, enabled: true}),
    'network-wireless-signal-excellent-symbolic');
check('click as a wifi tile switches the radio',
    tileAction([{...usb, present: false}], wifiOn, memory), {kind: 'toggleWifi'});

if (failures)
    System.exit(1);
