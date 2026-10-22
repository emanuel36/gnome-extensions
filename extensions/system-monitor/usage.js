// Data used per interface since local midnight. The state is plain JSON so it can be
// stored in GSettings and survive shell restarts and reboots.

export function localDate(now) {
    const pad = n => String(n).padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/**
 * Add the traffic since the last sample to each interface's daily total.
 *
 * Args:
 *     state: `{date, ifaces: {name: {used, rx, tx}}}` from the last call, or null.
 *     counters: Map of interface name to `{rx, tx, id}`: byte counters from /proc/net/dev
 *         and an optional identity (boot id + ifindex) that changes whenever the
 *         counters restart.
 *     today: Local date as "YYYY-MM-DD".
 *
 * Returns:
 *     A new state. After a reset (identity changed, or counters went backwards when no
 *     identity is known) the bytes since the reset are counted; a new day starts every
 *     total from 0 before counting.
 */
export function updateUsage(state, counters, today) {
    const valid = typeof state?.date === 'string' &&
        typeof state.ifaces === 'object' && state.ifaces !== null;
    const sameDay = valid && state.date === today;
    const ifaces = {};

    for (const [name, entry] of Object.entries(valid ? state.ifaces : {}))
        ifaces[name] = {...entry, used: sameDay ? entry.used : 0};

    for (const [name, {rx, tx, id}] of counters) {
        const prev = ifaces[name];
        let used = 0;
        if (prev) {
            const reset = (id !== undefined && prev.id !== undefined && id !== prev.id) ||
                rx < prev.rx || tx < prev.tx;
            used = prev.used + (reset ? rx + tx : rx - prev.rx + tx - prev.tx);
        }
        ifaces[name] = id === undefined ? {used, rx, tx} : {used, rx, tx, id};
    }

    return {date: today, ifaces};
}
