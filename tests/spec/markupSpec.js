import GLib from 'gi://GLib';

import * as Markup from '../../libs/markup.js';


describe('markup', () => {
    beforeEach(function() {
        this.logger = jasmine.createSpyObj('logger', ['error']);
    });

    it('is initialized with sensible defaults', function() {
        const markup = new Markup.Markup(null, this.logger);

        expect(markup.bold).toBeFalsy();
        expect(markup.italic).toBeFalsy();
        expect(markup.changeColor).toBeFalsy();
        expect(markup.color).toBe('rgb(0,0,0)');
    });

    it('can be initialized with a variant', function() {
        const value = [GLib.Variant.new_boolean(true), GLib.Variant.new_string('rgb(100,200,100)'), GLib.Variant
            .new_boolean(
                false), GLib.Variant.new_boolean(true)
        ];
        const tuple = GLib.Variant.new_tuple(value);

        const markup = new Markup.Markup(tuple, this.logger);

        expect(markup.bold).toBeFalsy();
        expect(markup.italic).toBeTruthy();
        expect(markup.changeColor).toBeTruthy();
        expect(markup.color).toBe('rgb(100,200,100)');
    });

    it('falls back to default when initialized with something that is not a variant', function() {
        const markup = new Markup.Markup('bla', this.logger);

        expect(markup.bold).toBeFalsy();
        expect(markup.italic).toBeFalsy();
        expect(markup.changeColor).toBeFalsy();
        expect(markup.color).toBe('rgb(0,0,0)');
    });

    it('falls back to default when initaliazed with a wrong variant', function() {
        const value = [GLib.Variant.new_boolean(true), GLib.Variant.new_boolean(false)];
        const markup = new Markup.Markup(GLib.Variant.new_tuple(value), this.logger);

        expect(markup.bold).toBeFalsy();
        expect(markup.italic).toBeFalsy();
        expect(markup.changeColor).toBeFalsy();
        expect(markup.color).toBe('rgb(0,0,0)');
    });

    it('falls back to default color when initialized with invalid color string', function() {
        pending();
        const value = [GLib.Variant.new_boolean(true), GLib.Variant.new_string('some color'), GLib.Variant
            .new_boolean(false), GLib.Variant.new_boolean(true)
        ];
        const tuple = GLib.Variant.new_tuple(value);
        const markup = new Markup.Markup(tuple, this.logger);

        expect(markup.changeColor).toBeTruthy();
        expect(markup.color).toBe('rgb(0,0,0)');
        expect(markup.bold).toBeFalsy();
        expect(markup.italic).toBeTruthy();
    });

    it('can be modified', function() {
        const markup = new Markup.Markup(null, this.logger);

        expect(markup.bold).toBeFalsy();
        expect(markup.italic).toBeFalsy();
        expect(markup.changeColor).toBeFalsy();
        expect(markup.color).toBe('rgb(0,0,0)');

        markup.bold = true;
        markup.italic = true;
        markup.changeColor = true;

        markup.color = 'rgb(1,2,3)';

        expect(markup.bold).toBeTruthy();
        expect(markup.italic).toBeTruthy();
        expect(markup.changeColor).toBeTruthy();
        expect(markup.color).toBe('rgb(1,2,3)');
    });

    it('can have a color set from a string', function() {
        const markup = new Markup.Markup(null, this.logger);
        markup.color = 'rgb(100,150,200)';

        expect(markup.bold).toBeFalsy();
        expect(markup.italic).toBeFalsy();
        expect(markup.changeColor).toBeFalsy();
        expect(markup.color).toBe('rgb(100,150,200)');
    });

    it('keeps old value when the color is set from an invalid string', function() {
        const markup = new Markup.Markup(null, this.logger);
        markup.color = 'rgb(100,150,200)';

        expect(markup.color).toBe('rgb(100,150,200)');

        markup.colorFromString = 'blaargh';

        expect(markup.bold).toBeFalsy();
        expect(markup.italic).toBeFalsy();
        expect(markup.changeColor).toBeFalsy();
        expect(markup.color).toBe('rgb(100,150,200)');
    });

    it('keeps old value when the color is set from an invalid type', function() {
        pending();
        const markup = new Markup.Markup(null, this.logger);
        markup.color = 'rgb(100,150,200)';

        expect(markup.color).toBe('rgb(100,150,200)');

        markup.color = true;

        expect(markup.bold).toBeFalsy();
        expect(markup.italic).toBeFalsy();
        expect(markup.changeColor).toBeFalsy();
        expect(markup.color).toBe('rgb(100,150,200)');
    });

    it('can be converted to a variant', function() {
        const value = [GLib.Variant.new_boolean(true), GLib.Variant.new_string('rgb(100,200,100)'), GLib.Variant
            .new_boolean(
                false), GLib.Variant.new_boolean(true)
        ];
        const tuple = GLib.Variant.new_tuple(value);

        const markup = new Markup.Markup(tuple, this.logger);
        const variant = markup.toVariant();

        expect(variant.get_type_string()).toBe(tuple.get_type_string());

        const unpack = variant.deep_unpack();

        expect(unpack[0]).toBe(value[0].unpack());
        expect(unpack[1]).toBe(value[1].unpack());
        expect(unpack[2]).toBe(value[2].unpack());
        expect(unpack[3]).toBe(value[3].unpack());
    });
});

/* vi: set expandtab tabstop=4 shiftwidth=4: */
