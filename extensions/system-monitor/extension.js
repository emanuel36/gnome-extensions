import GLib from 'gi://GLib';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';

import {SystemMonitorIndicator} from './panel.js';
import {
    findCpuTempInput, listPhysicalInterfaces, readBootId, readCpuTempC, readCpuTimes,
    readMaxCpuFreqKhz, readMeminfo, readNetCounters, scanProcesses,
} from './sources.js';
import {
    cpuPercent, interfaceLabels, memPercent, netRates, sampleCpuTop, topMemory,
} from './stats.js';
import {localDate, updateUsage} from './usage.js';

const REFRESH_SECONDS = 2;
const SAVE_SECONDS = 60;

export default class SystemMonitorExtension extends Extension {
    enable() {
        this._settings = this.getSettings();
        this._usage = this._loadUsage();
        this._lastSaveUs = GLib.get_monotonic_time();
        this._tempInput = findCpuTempInput();
        this._bootId = readBootId();
        this._prevCpu = null;
        this._prevNet = null;
        this._prevUs = 0;
        this._prevSample = null;
        this._last = null;

        this._indicator = new SystemMonitorIndicator(this.path);

        this._indicator.menu.connect('open-state-changed', (menu, open) => {
            // Process scans only run while the popup is open. Opening refreshes the popup
            // only: an extra tick would shorten the next bar measurement window
            this._prevSample = null;
            if (open)
                this._guarded(() => this._updatePopup());
        });

        this._guarded(() => this._tick());
        this._timerId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, REFRESH_SECONDS, () => {
            // An exception here would remove the source and freeze the bar
            this._guarded(() => this._tick());
            return GLib.SOURCE_CONTINUE;
        });

        // Left box, right after Activities. Added last and guarded: extensions that hook
        // into the panel (e.g. Top Bar Organizer) can throw after the indicator is placed,
        // which would otherwise abort enable() and leave it frozen on "…"
        try {
            Main.panel.addToStatusArea(this.uuid, this._indicator, 1, 'left');
        } catch (e) {
            console.error(`System Monitor: adding to the panel failed: ${e.message}`);
        }
    }

    disable() {
        if (this._timerId) {
            GLib.source_remove(this._timerId);
            this._timerId = null;
        }
        this._saveUsage();
        this._indicator?.destroy();
        this._indicator = null;
        this._settings = null;
        this._usage = null;
        this._prevCpu = null;
        this._prevNet = null;
        this._prevSample = null;
        this._last = null;
    }

    _guarded(fn) {
        try {
            fn();
        } catch (e) {
            console.error(`System Monitor: update failed: ${e.message}`);
        }
    }

    _loadUsage() {
        try {
            return JSON.parse(this._settings.get_string('net-usage'));
        } catch {
            return null;
        }
    }

    _saveUsage() {
        if (this._settings && this._usage)
            this._settings.set_string('net-usage', JSON.stringify(this._usage));
    }

    _tick() {
        const nowUs = GLib.get_monotonic_time();
        const cpuTimes = readCpuTimes();
        const mem = readMeminfo();
        const counters = readNetCounters();
        const ifaces = listPhysicalInterfaces();
        const shown = ifaces.filter(i => i.up && counters.has(i.name));

        const cpu = cpuTimes ? cpuPercent(this._prevCpu, cpuTimes) : null;
        const elapsedSec = this._prevUs ? (nowUs - this._prevUs) / 1e6 : 0;
        const rates = netRates(this._prevNet, counters, elapsedSec, shown.map(i => i.name));

        const physical = new Map(ifaces.filter(i => counters.has(i.name)).map(i =>
            [i.name, {...counters.get(i.name), id: `${this._bootId}:${i.ifindex}`}]));
        this._usage = updateUsage(this._usage, physical, localDate(new Date()));

        this._prevCpu = cpuTimes;
        this._prevNet = counters;
        this._prevUs = nowUs;
        this._last = {cpu, mem, shown, rates};

        this._indicator.setBar({cpu, ram: mem ? memPercent(mem) : null});
        if (this._indicator.menu.isOpen)
            this._updatePopup();

        if (nowUs - this._lastSaveUs >= SAVE_SECONDS * 1e6) {
            this._saveUsage();
            this._lastSaveUs = nowUs;
        }
    }

    // Uses the bar values of the last tick; the CPU list compares two scans, each with the
    // CPU total read at scan time
    _updatePopup() {
        if (!this._last)
            return;
        const {cpu, mem, shown, rates} = this._last;

        const sample = {procs: scanProcesses(), cpuTotal: readCpuTimes()?.total ?? 0};
        const cpuTop = sampleCpuTop(this._prevSample, sample);
        this._prevSample = sample;

        this._indicator.setCpu({
            percent: cpu,
            tempC: readCpuTempC(this._tempInput),
            freqKhz: readMaxCpuFreqKhz(),
            top: cpuTop,
        });
        if (mem) {
            this._indicator.setMemory({
                percent: memPercent(mem),
                usedKb: mem.totalKb - mem.availableKb,
                totalKb: mem.totalKb,
                top: topMemory(sample.procs),
            });
        }

        const labels = interfaceLabels(shown);
        this._indicator.setNetwork(shown.map(({name, kind}) => ({
            name,
            kind,
            label: labels.get(name),
            down: rates.get(name).down,
            up: rates.get(name).up,
            usedToday: this._usage.ifaces[name]?.used ?? 0,
        })));
    }
}
