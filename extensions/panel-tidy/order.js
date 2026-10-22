// Pure logic for Panel Tidy: no shell or GTK imports, so it runs under plain `gjs -m`.

export const BOXES = ['left', 'center', 'right'];

// Readable names for the items GNOME Shell itself puts in the top bar.
export const SYSTEM_NAMES = {
    activities: 'Activities',
    appMenu: 'App Menu',
    quickSettings: 'System Menu',
    dateMenu: 'Clock',
    a11y: 'Accessibility',
    keyboard: 'Keyboard Layout',
    dwellClick: 'Dwell Click',
    screenRecording: 'Screen Recording',
    screenSharing: 'Screen Sharing',
};

// App icons whose app id or window class doesn't say which app they are.
const APP_NAMES = {
    'ZSTray6.Deb': 'Zscaler',
};

// Base classes extensions build their toggles from: their class name says nothing about the
// toggle, so the title is added to the id.
const GENERIC_TOGGLE_CLASSES = new Set(['QuickToggle', 'QuickMenuToggle']);

/**
 * Adds item keys that are on the bar but in no saved order, where they currently sit.
 *
 * A new key goes right after the closest key before it on the bar that is already listed
 * in the same box, or first in the box if there is none.
 *
 * @param {Object<string, string[]>} orders - saved keys per box
 * @param {Object<string, string[]>} bar - keys per box, in the order they are on the bar
 * @returns {{orders: Object<string, string[]>, changed: boolean}} the updated orders
 */
export function addNewKeys(orders, bar) {
    const known = new Set(BOXES.flatMap(box => orders[box]));
    const result = {};
    let changed = false;
    for (const box of BOXES) {
        const list = [...orders[box]];
        bar[box].forEach((key, i) => {
            if (known.has(key))
                return;
            let at = 0;
            for (let j = i - 1; j >= 0; j--) {
                const k = list.indexOf(bar[box][j]);
                if (k >= 0) {
                    at = k + 1;
                    break;
                }
            }
            list.splice(at, 0, key);
            known.add(key);
            changed = true;
        });
        result[box] = list;
    }
    return {orders: result, changed};
}

/**
 * Moves a key to another place, in the same box or another one.
 *
 * @param {Object<string, string[]>} orders - saved keys per box
 * @param {string} key - the key to move
 * @param {string} box - the box it goes to
 * @param {?string} before - the key it goes right before; null for the end of the box
 * @returns {Object<string, string[]>} the updated orders
 */
export function moveKey(orders, key, box, before) {
    const result = {};
    for (const b of BOXES)
        result[b] = orders[b].filter(k => k !== key);
    const at = before === null ? -1 : result[box].indexOf(before);
    result[box].splice(at < 0 ? result[box].length : at, 0, key);
    return result;
}

/**
 * Removes a key from every saved order.
 *
 * @param {Object<string, string[]>} orders - saved keys per box
 * @param {string} key - the key to forget
 * @returns {Object<string, string[]>} the updated orders
 */
export function forgetKey(orders, key) {
    const result = {};
    for (const box of BOXES)
        result[box] = orders[box].filter(k => k !== key);
    return result;
}

/**
 * Stable id of a Quick Settings toggle.
 *
 * @param {string} className - the toggle's class name
 * @param {string} title - the toggle's title
 * @returns {string} the class name, plus the title when the class is a generic base class
 */
export function toggleId(className, title) {
    return GENERIC_TOGGLE_CLASSES.has(className) ? `${className}:${title}` : className;
}

/**
 * Key an item is saved under: its role, except for appindicators, whose roles carry a
 * process id or a D-Bus address that change every time the app starts.
 *
 * App icons get `appindicator-kstatusnotifieritem-<app id>` (the key Top Bar Organizer
 * used); legacy tray icons, whose role is `appindicator-legacy:<wm class>:<pid>`, get
 * `appindicator-legacy-<wm class>`.
 *
 * @param {string} role - a `Main.panel.statusArea` key
 * @param {?string} appId - the app indicator's id, when the item is an app icon
 * @returns {?string} the key, or null while an app icon has no id yet
 */
export function itemKey(role, appId) {
    if (!role.startsWith('appindicator-'))
        return role;
    const legacy = role.match(/^appindicator-legacy:(.*):\d+$/);
    if (legacy)
        return `appindicator-legacy-${legacy[1]}`;
    return appId ? `appindicator-kstatusnotifieritem-${appId}` : null;
}

/**
 * Readable name derived from the key alone, for items that offer nothing better.
 *
 * @param {string} key - an item key (see itemKey)
 * @returns {string} the name
 */
export function fallbackName(key) {
    const name = key
        .replace(/^appindicator-(legacy-|kstatusnotifieritem-)?/, '')
        .replace(/_status_icon_\d+$/, '')
        .replace(/@.*$/, '');
    return APP_NAMES[name] ?? name;
}

/**
 * Merges toggles seen now into the known list, keeping the known order and adding new ones
 * at the end. Names are refreshed from what is seen now.
 *
 * @param {Array<[string, string]>} known - [id, name] pairs saved before
 * @param {Array<[string, string]>} seen - [id, name] pairs present now, in menu order
 * @returns {Array<[string, string]>} the updated list
 */
export function mergeToggles(known, seen) {
    const names = new Map(seen);
    const result = known.map(([id, name]) => [id, names.get(id) ?? name]);
    const ids = new Set(known.map(([id]) => id));
    for (const [id, name] of seen) {
        if (!ids.has(id)) {
            result.push([id, name]);
            ids.add(id);
        }
    }
    return result;
}
