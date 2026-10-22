// Pure layout planning: no GNOME imports, so it can be tested with plain gjs.

/**
 * Slots stacked on the side monitor, top to bottom, with their share of its height.
 * A slot lists the window classes it hosts, preferred first: when several are open they
 * share the slot and the preferred one ends up on top.
 */
export const SIDE_SLOTS = [
    {wmClasses: ['slack'], fraction: 0.6},
    {wmClasses: ['discord', 'zapzap'], fraction: 0.4},
];

/**
 * Picks the monitor that hosts the side slots: the first non-primary portrait monitor,
 * or the first non-primary one when none is portrait.
 *
 * @param {Array<{index: number, width: number, height: number}>} monitors - Work areas.
 * @param {number} primaryIndex - Index of the primary monitor.
 * @returns {number} The side monitor index, or -1 when there is a single monitor.
 */
export function sideMonitorIndex(monitors, primaryIndex) {
    const others = monitors.filter(m => m.index !== primaryIndex);
    const portrait = others.find(m => m.height > m.width);
    return (portrait ?? others[0])?.index ?? -1;
}

function slotRects(area) {
    let top = area.y;
    return SIDE_SLOTS.map((slot, i) => {
        const height = i === SIDE_SLOTS.length - 1
            ? area.y + area.height - top
            : Math.round(area.height * slot.fraction);
        const rect = {x: area.x, y: top, width: area.width, height};
        top += height;
        return rect;
    });
}

/**
 * Computes where every window goes.
 *
 * With two or more monitors, the oldest window of each side app is tiled in its slot on
 * the side monitor; any other window of a side app is left alone; everything else is
 * maximized on the primary monitor. With one monitor, everything is maximized on it.
 *
 * @param {Array<{index: number, x: number, y: number, width: number, height: number}>}
 *     monitors - Work area of each monitor.
 * @param {number} primaryIndex - Index of the primary monitor.
 * @param {Array<{id: any, wmClass: string, seq: number}>} windows - Normal windows;
 *     `seq` grows with window age (lower is older).
 * @returns {Array<{id: any, action: 'tile'|'maximize', monitor: number,
 *     rect?: {x: number, y: number, width: number, height: number}}>} One entry per
 *     window to change, in the order to apply them: tiles come last, preferred app of a
 *     slot after the others, so raising each tile in turn leaves the preferred one on top.
 */
export function planLayout(monitors, primaryIndex, windows) {
    const side = sideMonitorIndex(monitors, primaryIndex);
    if (side === -1)
        return windows.map(w => ({id: w.id, action: 'maximize', monitor: primaryIndex}));

    const sideClasses = new Set(SIDE_SLOTS.flatMap(s => s.wmClasses));
    const oldest = new Map();
    for (const w of windows) {
        const cls = w.wmClass.toLowerCase();
        if (sideClasses.has(cls) && (!oldest.has(cls) || w.seq < oldest.get(cls).seq))
            oldest.set(cls, w);
    }

    const plan = windows
        .filter(w => !sideClasses.has(w.wmClass.toLowerCase()))
        .map(w => ({id: w.id, action: 'maximize', monitor: primaryIndex}));

    const rects = slotRects(monitors.find(m => m.index === side));
    SIDE_SLOTS.forEach((slot, i) => {
        for (const cls of [...slot.wmClasses].reverse()) {
            if (oldest.has(cls))
                plan.push({id: oldest.get(cls).id, action: 'tile', monitor: side, rect: rects[i]});
        }
    });
    return plan;
}
