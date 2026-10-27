// Smoke test against the running machine: compares NetworkSource with nmcli.
// Run with: gjs -m extensions/panel-tidy/network-source.test.js
import GLib from 'gi://GLib';
import System from 'system';

import {NetworkSource} from './network-source.js';

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

function nmcli(args) {
    const [, out] = GLib.spawn_command_line_sync(`nmcli ${args}`);
    return new TextDecoder().decode(out).trim();
}

const devices = nmcli('-t -f DEVICE,TYPE,STATE device').split('\n')
    .map(line => line.split(':'))
    .map(([device, type, state]) => ({device, type, state}));

const source = await NetworkSource.create();
check('NetworkSource.create() finds a running NetworkManager', source !== null, true);
const {cables, wifi} = source.snapshot();

// nmcli calls a container veth "ethernet" too; a physical device has /sys/class/net/<dev>/device.
const physical = d => GLib.file_test(`/sys/class/net/${d.device}/device`, GLib.FileTest.EXISTS);
check('cables are exactly the physical ethernet devices',
    cables.map(c => c.device).sort(),
    devices.filter(d => d.type === 'ethernet' && physical(d)).map(d => d.device).sort());
check('no bridge, tunnel or loopback is listed',
    cables.filter(c => ['docker0', 'gpd0', 'lo'].includes(c.device)).length, 0);

for (const cable of cables) {
    const state = devices.find(d => d.device === cable.device).state;
    check(`${cable.device} connected matches nmcli`, cable.connected, state === 'connected');
    check(`${cable.device} present matches nmcli`, cable.present, state !== 'unavailable');
    for (const p of cable.profiles) {
        const bound = nmcli(`-g connection.interface-name connection show uuid ${p.id}`);
        check(`${cable.device}: profile ${p.name} is not bound to another device`,
            bound === '' || bound === cable.device, true);
    }
    if (cable.connected) {
        check(`${cable.device} active profile is one of its profiles`,
            cable.profiles.some(p => p.id === cable.active), true);
    }
}

const wifiDevice = devices.find(d => d.type === 'wifi');
check('wifi presence matches nmcli', wifi.present, wifiDevice !== undefined);
if (wifiDevice) {
    check('wifi connected matches nmcli', wifi.connected, wifiDevice.state === 'connected');
    check('wifi radio matches nmcli', wifi.enabled, nmcli('radio wifi') === 'enabled');
    const networks = source.wifiNetworks();
    check('exactly one active network when connected',
        networks.filter(n => n.active).length, wifi.connected ? 1 : 0);
    check('strengths are percentages',
        networks.every(n => n.strength >= 0 && n.strength <= 100), true);
    if (wifi.connected)
        check('active network is the connected ssid', networks.find(n => n.active).id, wifi.ssid);
}

let calls = 0;
const id = source.connect(() => calls++);
source.disconnect(id);
source.destroy();
check('destroy() after disconnect() does not throw', calls, 0);

if (failures)
    System.exit(1);
