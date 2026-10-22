// Data used per interface, kept per local day for the last 30 days plus one total for the
// days before. The state is plain JSON so it can be stored in GSettings and survive shell
// restarts and reboots.

// Days counted by each period, today included; "all" has no limit
const PERIOD_DAYS = {day: 1, week: 7, month: 30};
export const KEPT_DAYS = PERIOD_DAYS.month;

export function localDate(now) {
    const pad = n => String(n).padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

// Whole days from date `a` to date `b` ("YYYY-MM-DD"), in UTC so DST changes don't count
function daysBetween(a, b) {
    const utc = d => Date.UTC(...d.split('-').map((n, i) => Number(n) - (i === 1 ? 1 : 0)));
    return Math.round((utc(b) - utc(a)) / 86400000);
}

// One interface's saved entry in the current shape; the first version kept only today's
// total, as `used` next to a top-level `date`
function readEntry(entry, oldDate) {
    const days = typeof entry.days === 'object' && entry.days !== null
        ? {...entry.days}
        : {};
    if (typeof entry.used === 'number' && typeof oldDate === 'string')
        days[oldDate] = entry.used;
    const read = {rx: entry.rx, tx: entry.tx, days, older: entry.older ?? 0};
    return entry.id === undefined ? read : {...read, id: entry.id};
}

/**
 * Add the traffic since the last sample to each interface's total for today.
 *
 * Args:
 *     state: `{ifaces: {name: {rx, tx, id, days: {date: bytes}, older}}}` from the last
 *         call, or null.
 *     counters: Map of interface name to `{rx, tx, id}`: byte counters from /proc/net/dev
 *         and an optional identity (boot id + ifindex) that changes whenever the
 *         counters restart.
 *     today: Local date as "YYYY-MM-DD".
 *
 * Returns:
 *     A new state. After a reset (identity changed, or counters went backwards when no
 *     identity is known) the bytes since the reset are counted. Days older than KEPT_DAYS
 *     are added to `older`.
 */
export function updateUsage(state, counters, today) {
    const valid = typeof state?.ifaces === 'object' && state.ifaces !== null;
    const ifaces = {};

    for (const [name, entry] of Object.entries(valid ? state.ifaces : {}))
        ifaces[name] = readEntry(entry, state.date);

    for (const [name, {rx, tx, id}] of counters) {
        const prev = ifaces[name];
        let delta = 0;
        if (prev) {
            const reset = (id !== undefined && prev.id !== undefined && id !== prev.id) ||
                rx < prev.rx || tx < prev.tx;
            delta = reset ? rx + tx : rx - prev.rx + tx - prev.tx;
        }
        const days = prev?.days ?? {};
        days[today] = (days[today] ?? 0) + delta;
        const entry = {rx, tx, days, older: prev?.older ?? 0};
        ifaces[name] = id === undefined ? entry : {...entry, id};
    }

    for (const entry of Object.values(ifaces)) {
        for (const [date, bytes] of Object.entries(entry.days)) {
            if (daysBetween(date, today) >= KEPT_DAYS) {
                entry.older += bytes;
                delete entry.days[date];
            }
        }
    }

    return {ifaces};
}

/**
 * Data an interface used in a period.
 *
 * Args:
 *     entry: The interface's entry in the state from updateUsage(), or undefined.
 *     period: "day", "week" (last 7 days), "month" (last 30 days) or "all".
 *     today: Local date as "YYYY-MM-DD".
 *
 * Returns:
 *     Bytes received + sent.
 */
export function usageFor(entry, period, today) {
    if (!entry)
        return 0;
    let total = period === 'all' ? entry.older : 0;
    for (const [date, bytes] of Object.entries(entry.days)) {
        if (period === 'all' || daysBetween(date, today) < PERIOD_DAYS[period])
            total += bytes;
    }
    return total;
}
