// Puts the Network tile where the native Wired and Wi-Fi tiles are and hides those. Any failure,
// or a disable(), puts everything back.
import {NATIVE_TOGGLE_CLASSES} from './network.js';
import {NetworkSource} from './network-source.js';
import {NetworkTile} from './network-tile.js';

export class NetworkModule {
    /**
     * @param {object} options
     * @param {object} options.menu - the Quick Settings menu (insertItemBefore)
     * @param {object} options.grid - the Quick Settings grid
     * @param {function(object): void} options.hide - keeps a toggle hidden
     * @param {function(object): void} options.show - gives a hidden toggle back
     */
    constructor({menu, grid, hide, show}) {
        this._menu = menu;
        this._grid = grid;
        this._hide = hide;
        this._show = show;
        this._token = null; // set while starting or running
        this._source = null;
        this._tile = null;
        this._natives = [];
    }

    get active() {
        return this._token !== null;
    }

    isNative(actor) {
        return NATIVE_TOGGLE_CLASSES.includes(actor.constructor.name);
    }

    _findNatives() {
        return this._grid.get_children().filter(c => this.isNative(c));
    }

    hasNatives() {
        return this._findNatives().length > 0;
    }

    /**
     * @returns {Promise<boolean>} false when it could not start; the native tiles are then
     *     left as they were
     */
    async enable() {
        const natives = this._findNatives();
        if (!natives.length)
            return false;
        const token = this._token = {};
        try {
            const source = await NetworkSource.create();
            if (this._token !== token) { // disabled while connecting
                source?.destroy();
                return false;
            }
            if (!source) {
                this._token = null;
                return false;
            }
            this._source = source;
            this._tile = new NetworkTile(source);
            this._menu.insertItemBefore(this._tile, natives[0], 1);
            this._natives = natives;
            natives.forEach(n => this._hide(n));
            return true;
        } catch (e) {
            console.warn(`panel-tidy: network: ${e.message}`);
            if (this._token === token)
                this.disable();
            return false;
        }
    }

    disable() {
        this._token = null;
        this._tile?.destroy();
        this._source?.destroy();
        // Each native tile decides its own visibility in _sync(); the value remembered while it
        // was hidden goes stale when a cable is unplugged and plugged back in.
        this._natives.forEach(n => {
            this._show(n);
            n._sync?.();
        });
        this._tile = this._source = null;
        this._natives = [];
    }
}
