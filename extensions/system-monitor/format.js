// Text formatting for the bar and the popup. Network values use decimal units (1000),
// memory values come from /proc in KiB and use binary steps.

const DECIMAL_UNITS = ['B', 'K', 'M', 'G', 'T'];

// One decimal below 10 (except plain bytes), integers above
function scaleDecimal(value) {
    let unit = 0;
    while (value >= 1000 && unit < DECIMAL_UNITS.length - 1) {
        value /= 1000;
        unit++;
    }
    const text = unit > 0 && value < 10 ? value.toFixed(1) : String(Math.round(value));
    return [text, DECIMAL_UNITS[unit]];
}

export function formatRateCompact(bytesPerSec) {
    const [text, unit] = scaleDecimal(bytesPerSec);
    return `${text}${unit}`;
}

export function formatRate(bytesPerSec) {
    const [text, unit] = scaleDecimal(bytesPerSec);
    return `${text} ${unit === 'B' ? '' : unit}B/s`;
}

export function formatDataSize(bytes) {
    const [text, unit] = scaleDecimal(bytes);
    return `${text} ${unit === 'B' ? '' : unit}B`;
}

export function formatMemKb(kb) {
    if (kb < 1024)
        return `${Math.round(kb)} KB`;
    if (kb < 1024 * 1024)
        return `${Math.round(kb / 1024)} MB`;
    return `${(kb / 1048576).toFixed(1)} GB`;
}

export function formatMemTotals(usedKb, totalKb) {
    return `${(usedKb / 1048576).toFixed(1)} / ${(totalKb / 1048576).toFixed(1)} GB`;
}

export function formatPercent(p) {
    return `${Math.round(p)}%`;
}

export function formatShare(p) {
    return `${p.toFixed(1)}%`;
}

/**
 * Faded line under the CPU title.
 *
 * Args:
 *     tempC: CPU package temperature, or null when there is no sensor.
 *     freqKhz: Highest current core frequency, or null without cpufreq.
 *
 * Returns:
 *     "68 °C · 3.7 GHz", either part alone, or "" when both are missing.
 */
export function cpuSubline(tempC, freqKhz) {
    const parts = [];
    if (tempC !== null)
        parts.push(`${Math.round(tempC)} °C`);
    if (freqKhz !== null)
        parts.push(`${(freqKhz / 1e6).toFixed(1)} GHz`);
    return parts.join(' · ');
}
