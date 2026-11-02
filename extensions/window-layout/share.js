// Pure Share Mode planning: no GNOME imports, so it can be tested with plain gjs.

import {sideMonitorIndex} from './layout.js';

/**
 * Places a rectangle on another area at the same offset from its top-left corner, shrunk
 * to fit and shifted back inside when it would overflow.
 *
 * @param {{x: number, y: number, width: number, height: number}} rect - Frame to move.
 * @param {{x: number, y: number}} from - Area the frame is on now.
 * @param {{x: number, y: number, width: number, height: number}} to - Destination area.
 * @returns {{x: number, y: number, width: number, height: number}} The new frame.
 */
export function placeOn(rect, from, to) {
    const width = Math.min(rect.width, to.width);
    const height = Math.min(rect.height, to.height);
    const fit = (offset, size, start, span) =>
        Math.max(start, Math.min(start + offset, start + span - size));
    return {
        x: fit(rect.x - from.x, width, to.x, to.width),
        y: fit(rect.y - from.y, height, to.y, to.height),
        width,
        height,
    };
}

/**
 * Computes the moves that leave only the shared window on the primary monitor.
 *
 * @param {Array<{index: number, x: number, y: number, width: number, height: number}>}
 *     monitors - Work area of each monitor.
 * @param {number} primaryIndex - Index of the primary monitor.
 * @param {Array<{id: any, monitor: number, rect: object}>} windows - Normal windows.
 * @param {any} sharedId - Id of the window to share.
 * @returns {Array<{id: any, monitor: number, rect: object}>} Windows to move, the shared
 *     one first; empty when there is no secondary monitor.
 */
export function planShare(monitors, primaryIndex, windows, sharedId) {
    const side = sideMonitorIndex(monitors, primaryIndex);
    if (side === -1)
        return [];

    const area = index => monitors.find(m => m.index === index);
    const moveTo = (w, index) =>
        ({id: w.id, monitor: index, rect: placeOn(w.rect, area(w.monitor), area(index))});

    const shared = windows.find(w => w.id === sharedId);
    const plan = shared && shared.monitor !== primaryIndex ? [moveTo(shared, primaryIndex)] : [];
    for (const w of windows) {
        if (w.id !== sharedId && w.monitor === primaryIndex)
            plan.push(moveTo(w, side));
    }
    return plan;
}

/**
 * Adds newly seen windows to the saved state without touching windows already saved, so
 * switching the shared window keeps the positions from before Share Mode.
 *
 * @param {Object} saved - Saved state by window id.
 * @param {Object} current - Current state by window id.
 * @returns {Object} The merged state.
 */
export function mergeSaved(saved, current) {
    const merged = {...saved};
    for (const [id, state] of Object.entries(current))
        merged[id] ??= state;
    return merged;
}

/**
 * @param {Object} saved - Saved state by window id.
 * @param {Set} openIds - Ids of the windows still open.
 * @returns {Array<[string, any]>} Saved entries of the windows still open.
 */
export function planRestore(saved, openIds) {
    return Object.entries(saved).filter(([id]) => openIds.has(id));
}

/**
 * Value of Ubuntu Dock's `preferred-monitor` that puts the dock on a given monitor. The
 * dock counts from the primary monitor: it uses `(primaryIndex + value) % count`.
 *
 * @param {number} primaryIndex - Index of the primary monitor.
 * @param {number} targetIndex - Index of the monitor that should get the dock.
 * @param {number} count - Number of monitors.
 * @returns {number} The setting value.
 */
export function dockOffset(primaryIndex, targetIndex, count) {
    return (targetIndex - primaryIndex + count) % count;
}
