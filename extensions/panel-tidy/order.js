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

// App icons whose app id or window class doesn't say which app they are, by key suffix.
const APP_NAMES = {
    'zstray6.deb': 'Zscaler',
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
 * Order of a box's children once its listed items follow the saved order: listed items take
 * the slots that listed items hold now, and every other child keeps its slot. An app icon
 * that has no id yet stays where its extension put it instead of being pushed to the end of
 * the box, where addNewKeys would then save it.
 *
 * @param {Array<?string>} keys - key of each child of the box, in order; null if it has none
 * @param {string[]} order - saved keys of the box
 * @returns {number[]} indices into `keys`, in the order the children should end up
 */
export function arrange(keys, order) {
    const rank = new Map(order.map((key, i) => [key, i]));
    const listed = keys.map((_key, i) => i).filter(i => rank.has(keys[i]))
        .sort((a, b) => rank.get(keys[a]) - rank.get(keys[b]));
    let next = 0;
    return keys.map((key, i) => (rank.has(key) ? listed[next++] : i));
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
 * An app shows either an app icon (its id, e.g. `Slack_status_icon_1`) or a legacy tray
 * icon (role `appindicator-legacy:<wm class>:<pid>`), depending on how the login race
 * goes. Both get `appindicator-<app>`, the id or window class lowercased, with no
 * `_status_icon_<n>` suffix and dashes for spaces, so the app is one item either way.
 *
 * @param {string} role - a `Main.panel.statusArea` key
 * @param {?string} appId - the app indicator's id, when the item is an app icon
 * @returns {?string} the key, or null while an app icon has no id yet
 */
export function itemKey(role, appId) {
    if (!role.startsWith('appindicator-'))
        return role;
    const id = appIdOf(role, appId);
    return id ? `appindicator-${appSlug(id)}` : null;
}

/**
 * Raw id of the app behind an appindicator: the window class of a legacy tray icon,
 * otherwise the app indicator's id.
 *
 * @param {string} role - a `Main.panel.statusArea` key starting with `appindicator-`
 * @param {?string} appId - the app indicator's id, when the item is an app icon
 * @returns {?string} the id, or null while an app icon has none yet
 */
export function appIdOf(role, appId) {
    return role.match(/^appindicator-legacy:(.*):\d+$/)?.[1] ?? appId ?? null;
}

/**
 * Readable name of an app icon.
 *
 * @param {string} id - the app id or window class
 * @returns {string} the name
 */
export function appName(id) {
    return APP_NAMES[appSlug(id)] ?? stripIconSuffix(id);
}

/**
 * Readable name derived from the key alone, for items that offer nothing better.
 *
 * @param {string} key - an item key (see itemKey)
 * @returns {string} the name
 */
export function fallbackName(key) {
    const name = key.replace(/^appindicator-/, '').replace(/@.*$/, '');
    return APP_NAMES[name] ?? name;
}

function stripIconSuffix(id) {
    return id.replace(/_status_icon_\d+$/, '');
}

function appSlug(id) {
    return stripIconSuffix(id).toLowerCase().replace(/[\s_]+/g, '-');
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
