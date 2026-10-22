import * as ExtensionUtils from './jsOverride/misc/extensionUtils.js'
import * as FileUtils from './lib/fileUtils.js'
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import * as Helper from './lib/utest_helpers.js';
import { Settings } from '../../libs/settings.js';

/* eslint-disable no-magic-numbers */
describe('settings', () => {
    beforeEach(async function() {
        const extension = ExtensionUtils.getCurrentExtension();
        this.logger = jasmine.createSpyObj('logger', ['error', 'debug', 'info']);
        this._settingsJSON = GLib.build_filenamev([extension.path, 'tests', 'spec', 'resources', 'test.json']);
        this._xmlpath = GLib.build_filenamev([extension.path, 'tests', 'spec', 'resources', 'schemas']);
        GLib.spawn_command_line_sync(`glib-compile-schemas ${this._xmlpath}`);
        const parameters = {
            settingsFile: this._settingsJSON,
            schema: 'org.gnome.shell.extensions.TodoTxt.unit',
            schemaDir: this._xmlpath,
            logger: this.logger,
            settings: ExtensionUtils.getSettings('org.gnome.shell.extensions.TodoTxt.unit')
        };
        this.settings = await Settings.create(parameters);
    });

    afterEach(function() {
        for (let key in this.settings.getGioSettings().list_keys()) {
            if (Object.prototype.hasOwnProperty.call(this.settings.getGioSettings().list_keys(),key)) {
                this.settings.getGioSettings().reset(this.settings.getGioSettings().list_keys()[
                    key]);
            }
        }
        const compiled = Gio.file_new_for_path(GLib.build_filenamev([this._xmlpath,
            'gschemas.compiled'
        ]));
        FileUtils.deleteGFile(compiled);
        this.settings = null;
    });

    it('throws an error when initialized with a non-existing settings file', async function() {
        const params = {
            settingsFile: '/bla/this/bla/path/bla/does/bla/not/bla/exist/bla/bla',
            logger: this.logger
        };

        await expectAsync(Settings.create(params)).toBeRejectedWithError(
            'JsTextFile: trying to load non-existing file /bla/this/bla/path/bla/does/bla/not/bla/exist/bla/bla'
        );
    });

    it('throws an error when initialized with an invalid json file', async function() {
        const invalidSettingsJSON = Helper.makeTemporaryFile('[{foo:bar},{"foo":"bar"}]');
        const params = {
            settingsFile: invalidSettingsJSON.get_path(),
            logger: this.logger
        };

        await expectAsync(Settings.create(params)).toBeRejectedWithError(
            `${invalidSettingsJSON.get_path()} is not a valid JSON file`);
        FileUtils.deleteGFile(invalidSettingsJSON);
    });

    it('loads settings from a json file correctly', function() {
        expect(this.settings._loadedSettings.category1.sub1.angua.type).toBe('boolean');
        expect(this.settings._loadedSettings.category1.sub2.carrot.type).toBe('string');
        expect(this.settings._loadedSettings.category1.nobby.type).toBe('path');
        expect(this.settings._loadedSettings.category2.sub1.cheery.type).toBe('integer');
        expect(this.settings._loadedSettings.category2.sub1.detritus.type).toBe('dictionary');
        expect(this.settings._loadedSettings.category2.sub1.detritus.signature).toBe('a{s(bsbb)}');
        expect(this.settings._loadedSettings.category2.sub2.dorfl.type).toBe('dictionary');
        expect(this.settings._loadedSettings.category2.sub2.dorfl.signature).toBe('a{s(bsbb)}');
        expect(this.settings._loadedSettings.category3.sub1.plinge.type).toBe('boolean');
        expect(this.settings._loadedSettings.category3.sub1.walter.type).toBe('integer');
        expect(this.settings._loadedSettings.category3.sub3.mazda.type).toBe('shortcut');
    });

    it('can retrieve the type of a setting', function() {
        expect(this.settings.getType('angua')).toBe('boolean');
        expect(this.settings.getType('carrot')).toBe('string');
        expect(this.settings.getType('nobby')).toBe('path');
        expect(this.settings.getType('cheery')).toBe('integer');
        expect(this.settings.getType('detritus')).toBe('dictionary');
        expect(this.settings.getType('dorfl')).toBe('dictionary');
        expect(this.settings.getType('plinge')).toBe('boolean');
        expect(this.settings.getType('walter')).toBe('integer');
        expect(this.settings.getType('mazda')).toBe('shortcut');
        expect(this.settings.getType('vimes')).toBeNull();
    });

    it('can retrieve the type of a category', function() {
        expect(this.settings.getType('category4')).toBe('category');
        expect(this.settings.getType('category4', 'category4')).toBe('subsection');
    });

    it('can check if a setting exists', function() {
        expect(this.settings.exists('angua')).toBeTruthy();
        expect(this.settings.exists('carrot')).toBeTruthy();
        expect(this.settings.exists('nobby')).toBeTruthy();
        expect(this.settings.exists('cheery')).toBeTruthy();
        expect(this.settings.exists('detritus')).toBeTruthy();
        expect(this.settings.exists('dorfl')).toBeTruthy();
        expect(this.settings.exists('plinge')).toBeTruthy();
        expect(this.settings.exists('walter')).toBeTruthy();
        expect(this.settings.exists('mazda')).toBeTruthy();
        expect(this.settings.exists('vimes')).toBeFalsy();
    });

    it('can retrieve booleans', function() {
        expect(this.settings.get('angua')).toBeFalsy();
    });

    it('can set booleans', function() {
        this.settings.set('angua', true);

        expect(this.settings.get('angua')).toBeTruthy();

        this.settings.set('angua', false);

        expect(this.settings.get('angua')).toBeFalsy();
    });

    it('can get strings', function() {
        expect(this.settings.get('carrot')).toBe('dwarf');
    });

    it('can set strings', function() {
        this.settings.set('carrot', 'huge dwarf');

        expect(this.settings.get('carrot')).toBe('huge dwarf');

        this.settings.set('carrot', 'not a vegetable');

        expect(this.settings.get('carrot')).toBe('not a vegetable');
    });

    it('throws an error when setting a string with the wrong type', function() {
        expect(() => this.settings.set('carrot', true)).toThrowError(
            'Expected value of type string, but got boolean while setting carrot.');

        expect(this.settings.get('carrot')).toBe('dwarf');
    });

    it('can get paths', function() {
        expect(this.settings.get('nobby')).toBe(`${GLib.get_home_dir()}/undefined/creature.txt`);
    });

    it('can set paths', function() {
        this.settings.set('nobby', `${GLib.get_home_dir()}/front/desk.txt`);

        expect(this.settings.get('nobby')).toBe(`${GLib.get_home_dir()}/front/desk.txt`);
    });

    it('throws an error when setting a path with a wrong type', function() {
        expect(() => this.settings.set('nobby', true)).toThrowError(
            'Expected value of type string, but got boolean while setting nobby.');

        expect(this.settings.get('nobby')).toBe(`${GLib.get_home_dir()}/undefined/creature.txt`);
    });

    it('can get integers', function() {
        expect(this.settings.get('cheery')).toBe(1);
    });

    it('can set integers', function() {
        this.settings.set('cheery', 2);

        expect(this.settings.get('cheery')).toBe(2);

        this.settings.set('cheery', 7);

        expect(this.settings.get('cheery')).toBe(7);
    });

    it('throws an error when setting an integer with a wrong type', function() {
        expect(() => this.settings.set('cheery', 'one')).toThrowError(
            'Expected value of type integer, but got string while setting cheery.');

        expect(this.settings.get('cheery')).toBe(1);
    });

    it('can get dictionaries', function() {
        expect(this.settings.get('detritus').rock[0]).toBeFalsy();
        expect(this.settings.get('detritus').rock[1]).toBe('hard');
        expect(this.settings.get('detritus').rock[2]).toBeTruthy();
        expect(this.settings.get('detritus').rock[3]).toBeFalsy();
        expect(this.settings.get('detritus').pebble[0]).toBeTruthy();
        expect(this.settings.get('detritus').pebble[1]).toBe('small');
        expect(this.settings.get('detritus').pebble[2]).toBeFalsy();
        expect(this.settings.get('detritus').pebble[3]).toBeTruthy();
    });

    it('can set dictionaries', function() {
        const dict = {};
        dict.rock = [true, 'soft', false, true];
        dict.pebble = [false, 'large', true, false];
        this.settings.set('detritus', dict);

        expect(this.settings.get('detritus').rock[0]).toBeTruthy();
        expect(this.settings.get('detritus').rock[1]).toBe('soft');
        expect(this.settings.get('detritus').rock[2]).toBeFalsy();
        expect(this.settings.get('detritus').rock[3]).toBeTruthy();
        expect(this.settings.get('detritus').pebble[0]).toBeFalsy();
        expect(this.settings.get('detritus').pebble[1]).toBe('large');
        expect(this.settings.get('detritus').pebble[2]).toBeTruthy();
        expect(this.settings.get('detritus').pebble[3]).toBeFalsy();
    });

    it('returns null when asking for a non-existing setting', function() {
        expect(this.settings.get('vimes')).toBeNull();
    });

    it('can get dictionaries with a value object', function() {
        const dorfl = this.settings.get('dorfl');

        expect(dorfl.golem.changeColor).toBeTruthy();
        expect(dorfl.golem.bold).toBeTruthy();
        expect(dorfl.golem.italic).toBeFalsy();
        expect(dorfl.golem.color).toBe('rgb(12,12,12)');

        expect(dorfl.feet.changeColor).toBeFalsy();
        expect(dorfl.feet.bold).toBeTruthy();
        expect(dorfl.feet.italic).toBeFalsy();
        expect(dorfl.feet.color).toBe('rgb(65,14,0)');
    });

    it('can get shortcuts', function() {
        expect(this.settings.get('mazda')).toBe('<Super>f');
    });

    it('can set shortcuts', function() {
        this.settings.set('mazda', '<Super>t');

        expect(this.settings.get('mazda')).toBe('<Super>t');
    });

    it('returns a type-based default value for elements that are only in the json file that have no defaults',
        function() {
            expect(this.settings.get('plinge')).toBeFalsy();
        });

    it('returns the default value from the json file for elements that are only in the json file', function() {
        expect(this.settings.get('walter')).toBe(42);
    });

    it('can notify subscribers of changed settings', function() {
        let dummyCalls = 0;
        let dummyCalls2 = 0;
        const dummyCallback = function() {
            dummyCalls++;
        };
        const dummyCallback2 = function() {
            dummyCalls2++;
        };
        this.settings.registerForChange('angua', dummyCallback);
        this.settings.set('angua', false);

        expect(dummyCalls).toBe(1);
        this.settings.set('angua', false);
        this.settings.registerForChange('angua', dummyCallback2);

        expect(dummyCalls).toBe(1);
        expect(dummyCalls2).toBe(0);

        this.settings.set('angua', true);

        expect(dummyCalls).toBe(2);
        expect(dummyCalls2).toBe(1);
        this.settings.unregisterCallbacks();
    });

    it('stops notifying subscribers of changes when they have unsubsribed', function() {
        let dummyCalls = 0;
        let dummyCalls2 = 0;
        const dummyCallback = function() {
            dummyCalls++;
        };
        const dummyCallback2 = function() {
            dummyCalls2++;
        };
        this.settings.registerForChange('angua', dummyCallback);
        this.settings.registerForChange('angua', dummyCallback2);
        this.settings.set('angua', false);

        expect(dummyCalls).toBe(1);
        expect(dummyCalls2).toBe(1);

        this.settings.unregisterCallbacks();
        this.settings.set('angua', true);
        this.settings.set('angua', false);

        expect(dummyCalls).toBe(1);
        expect(dummyCalls2).toBe(1);

        this.settings.registerForChange('angua', dummyCallback);
        this.settings.registerForChange('angua', dummyCallback2);
        this.settings.set('angua', true);

        expect(dummyCalls).toBe(2);
        expect(dummyCalls2).toBe(2);
        this.settings.unregisterCallbacks();
    });

    it('can get the category of a setting', function() {
        expect(this.settings.getCategory('angua')).toBe('category1');
        expect(this.settings.getCategory('carrot')).toBe('category1');
        expect(this.settings.getCategory('nobby')).toBe('category1');
        expect(this.settings.getCategory('cheery')).toBe('category2');
        expect(this.settings.getCategory('detritus')).toBe('category2');
        expect(this.settings.getCategory('dorfl')).toBe('category2');
        expect(this.settings.getCategory('plinge')).toBe('category3');
        expect(this.settings.getCategory('walter')).toBe('category3');
        expect(this.settings.getCategory('mazda')).toBe('category3');
        expect(this.settings.getCategory('vimes')).toBeNull();
    });

    it('can get the subcontainer of a setting', function() {
        expect(this.settings.getSubContainer('angua')).toBe('sub1');
        expect(this.settings.getSubContainer('carrot')).toBe('sub2');
        expect(this.settings.getSubContainer('nobby')).toBeNull();
        expect(this.settings.getSubContainer('cheery')).toBe('sub1');
        expect(this.settings.getSubContainer('detritus')).toBe('sub1');
        expect(this.settings.getSubContainer('dorfl')).toBe('sub2');
        expect(this.settings.getSubContainer('plinge')).toBe('sub1');
        expect(this.settings.getSubContainer('walter')).toBe('sub1');
        expect(this.settings.getSubContainer('mazda')).toBe('sub3');
        expect(this.settings.getCategory('vimes')).toBeNull();
    });

    it('can get all elements in a category', function() {
        const all1 = this.settings.getAllInCategory('category1');

        expect(all1.length).toBe(3);
        expect(all1).toContain(jasmine.objectContaining(['angua', jasmine.any(Object)]));
        expect(all1).toContain(jasmine.objectContaining(['carrot', jasmine.any(Object)]));
        expect(all1).toContain(jasmine.objectContaining(['nobby', jasmine.any(Object)]));
        const all2 = this.settings.getAllInCategory('category2');

        expect(all2.length).toBe(3);
        expect(all2).toContain(jasmine.objectContaining(['cheery', jasmine.any(Object)]));
        expect(all2).toContain(jasmine.objectContaining(['detritus', jasmine.any(Object)]));
        expect(all2).toContain(jasmine.objectContaining(['dorfl', jasmine.any(Object)]));

        const all3 = this.settings.getAllInCategory('category3');

        expect(all3.length).toBe(3);
        expect(all3).toContain(jasmine.objectContaining(['plinge', jasmine.any(Object)]));
        expect(all3).toContain(jasmine.objectContaining(['walter', jasmine.any(Object)]));
        expect(all3).toContain(jasmine.objectContaining(['mazda', jasmine.any(Object)]));
    });

    it('can get all elements in subcontainer', function() {
        const all11 = this.settings.getAllInSubcontainer('category1', 'sub1');

        expect(all11.length).toBe(1);
        expect(all11).toContain(jasmine.objectContaining(['angua', jasmine.any(Object)]));

        const all12 = this.settings.getAllInSubcontainer('category1', 'sub2');

        expect(all12.length).toBe(1);
        expect(all12).toContain(jasmine.objectContaining(['carrot', jasmine.any(Object)]));

        const all21 = this.settings.getAllInSubcontainer('category2', 'sub1');

        expect(all21.length).toBe(2);
        expect(all21).toContain(jasmine.objectContaining(['cheery', jasmine.any(Object)]));
        expect(all21).toContain(jasmine.objectContaining(['detritus', jasmine.any(Object)]));

        const all22 = this.settings.getAllInSubcontainer('category2', 'sub2');

        expect(all22.length).toBe(1);
        expect(all22).toContain(jasmine.objectContaining(['dorfl', jasmine.any(Object)]));

        const all31 = this.settings.getAllInSubcontainer('category3', 'sub1');

        expect(all31.length).toBe(2);
        expect(all31).toContain(jasmine.objectContaining(['plinge', jasmine.any(Object)]));
        expect(all31).toContain(jasmine.objectContaining(['walter', jasmine.any(Object)]));

        const all33 = this.settings.getAllInSubcontainer('category3', 'sub3');

        expect(all33.length).toBe(1);
        expect(all33).toContain(jasmine.objectContaining(['mazda', jasmine.any(Object)]));
    });

    it('can get all elements of a type', function() {
        const allBools = this.settings.getAll('boolean');

        expect(allBools.length).toBe(2);
        expect(allBools).toContain(jasmine.objectContaining(['angua', jasmine.any(Object)]));
        expect(allBools).toContain(jasmine.objectContaining(['plinge', jasmine.any(Object)]));

        const allStrings = this.settings.getAll('string');

        expect(allStrings.length).toBe(1);
        expect(allStrings).toContain(jasmine.objectContaining(['carrot', jasmine.any(Object)]));

        const allPaths = this.settings.getAll('path');

        expect(allPaths.length).toBe(1);
        expect(allPaths).toContain(jasmine.objectContaining(['nobby', jasmine.any(Object)]));

        const allIntegers = this.settings.getAll('integer');

        expect(allIntegers.length).toBe(2);
        expect(allIntegers).toContain(jasmine.objectContaining(['cheery', jasmine.any(Object)]));
        expect(allIntegers).toContain(jasmine.objectContaining(['walter', jasmine.any(Object)]));

        const allDictionaries = this.settings.getAll('dictionary');

        expect(allDictionaries.length).toBe(2);
        expect(allDictionaries).toContain(jasmine.objectContaining(['detritus', jasmine.any(Object)]));
        expect(allDictionaries).toContain(jasmine.objectContaining(['dorfl', jasmine.any(Object)]));
        const allShortcuts = this.settings.getAll('shortcut');

        expect(allShortcuts.length).toBe(1);
        expect(allShortcuts).toContain(jasmine.objectContaining(['mazda', jasmine.any(Object)]));
    });

    it('can get all categories', function() {
        expect(this.settings.getAllCategories()).toEqual(['category1', 'category2', 'category3', 'category4']);
    });

    it('can get all subcontainers of a cateogry', function() {
        expect(this.settings.getAllSubContainers('category1')).toEqual(['sub1', 'sub2']);
        expect(this.settings.getAllSubContainers('category2')).toEqual(['sub1', 'sub2']);
        expect(this.settings.getAllSubContainers('category3')).toEqual(['sub1', 'sub3']);
    });

    it('can get the summary of a setting', function() {
        expect(this.settings.getSummary('angua')).toBe('Werewolf');
        expect(this.settings.getSummary('carrot')).toBe('Dwarf');
        expect(this.settings.getSummary('nobby')).toBe('Undefined path');
        expect(this.settings.getSummary('cheery')).toBe('Littlebottom');
        expect(this.settings.getSummary('detritus')).toBe('Hard Rock');
        expect(this.settings.getSummary('dorfl')).toBe('Clay');
        expect(this.settings.getSummary('plinge')).toBe('');
        expect(this.settings.getSummary('walter')).toBe('');
        expect(this.settings.getSummary('mazda')).toBe('fingers');
    });

    it('can get the human name of a setting', function() {
        expect(this.settings.getHumanName('angua')).toBe('Angua');
        expect(this.settings.getHumanName('carrot')).toBe('Carrot');
        expect(this.settings.getHumanName('nobby')).toBe('Nobby');
        expect(this.settings.getHumanName('cheery')).toBe('Cheery');
        expect(this.settings.getHumanName('detritus')).toBe('Detritus');
        expect(this.settings.getHumanName('dorfl')).toBe('Dorfl');
        expect(this.settings.getHumanName('plinge')).toBe('Plinge');
        expect(this.settings.getHumanName('walter')).toBe('Walter');
        expect(this.settings.getHumanName('mazda')).toBe('mazda');
    });

    it('can get the help of a setting', function() {
        expect(this.settings.getHelp('angua')).toBe('');
        expect(this.settings.getHelp('carrot')).toBe('');
        expect(this.settings.getHelp('nobby')).toBe('No help available');
        expect(this.settings.getHelp('cheery')).toBe('');
        expect(this.settings.getHelp('detritus')).toBe('');
        expect(this.settings.getHelp('dorfl')).toBe('');
        expect(this.settings.getHelp('plinge')).toBe('I need somebody');
        expect(this.settings.getHelp('walter')).toBe('Heeeeeeelp');
        expect(this.settings.getHelp('mazda')).toBe('');
    });

    it('can get the extra parameters for a setting', function() {
        expect(this.settings.getExtraParams('angua')).not.toBeNull();
        const params = Object.assign({
            changing: 'Yes please',
            loving: 'Maybe'
        }, this.settings.getExtraParams('angua'));

        expect(params.changing).toBe('not currently');
        expect(params.loving).toBe('Maybe');
        expect(this.settings.getExtraParams('carrot')).toBeNull();
        expect(this.settings.getExtraParams('nobby')).toBeNull();
        expect(this.settings.getExtraParams('cheery')).toBeNull();
        expect(this.settings.getExtraParams('detritus')).toBeNull();
        expect(this.settings.getExtraParams('dorfl')).toBeNull();
        expect(this.settings.getExtraParams('plinge')).toBeNull();
        expect(this.settings.getExtraParams('walter')).toBeNull();
        expect(this.settings.getExtraParams('mazda')).toBeNull();
    });

    it('can get the widget for a setting', function() {
        expect(this.settings.getWidget('angua')).toBe('default');
        expect(this.settings.getWidget('carrot')).toBe('default');
        expect(this.settings.getWidget('nobby')).toBe('default');
        expect(this.settings.getWidget('cheery')).toBe('default');
        expect(this.settings.getWidget('detritus')).toBe('default');
        expect(this.settings.getWidget('dorfl')).toBe('default');
        expect(this.settings.getWidget('plinge')).toBe('none');
        expect(this.settings.getWidget('walter')).toBe('default');
        expect(this.settings.getWidget('mazda')).toBe('default');
    });

    it('can check if a category has subcategories', function() {
        expect(this.settings.hasSubcategories('category1')).toBeTruthy();
        expect(this.settings.hasSubcategories('category2')).toBeTruthy();
        expect(this.settings.hasSubcategories('category3')).toBeFalsy();
    });

    // it('get level', function() {
    //     expect(this.settings.getLevel('angua')).toBe('0');
    //     expect(this.settings.getLevel('carrot')).toBe('100');
    //     expect(this.settings.getLevel('nobby')).toBe('250');
    //     expect(this.settings.getLevel('cheery')).toBe('0');
    //     expect(this.settings.getLevel('detritus')).toBe('100');
    //     expect(this.settings.getLevel('dorfl')).toBe('0');
    //     expect(this.settings.getLevel('plinge')).toBe('100');
    //     expect(this.settings.getLevel('walter')).toBe('250');
    //     expect(this.settings.getLevel('mazda')).toBe('100');
    // });
});

/* vi: set expandtab tabstop=4 shiftwidth=4: */
