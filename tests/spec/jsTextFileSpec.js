import * as Helper from './lib/utest_helpers.js';
import * as JsTextFile from '../../libs/jsTextFile.js';
import * as Utils from '../../libs/utils.js';

/* eslint-disable no-magic-numbers */
describe('jsTextFile initialization', () => {
    beforeEach(function() {
        this.logger = jasmine.createSpyObj('logger', ['error', 'debug']);
    });

    it('without a path throws an error', function() {
        expect(() => {
            new JsTextFile.JsTextFile(null, this.logger);
        }).toThrowError(/JsTextFile: no path specified/);

        expect(() => {
            new JsTextFile.JsTextFile(undefined, this.logger);
        }).toThrowError(/JsTextFile: no path specified/);
    });

    it('with an invalid path throws an error when loaded', async function() {
        await expectAsync(JsTextFile.JsTextFile.load('/foo/bar/this/does/not/exist/I/hope', this.logger))
            .toBeRejectedWithError(
                /JsTextFile: trying to load non-existing file \/foo\/bar\/this\/does\/not\/exist\/I\/hope/
            );
    });
});

describe('a normal jsTextFile', () => {
    beforeEach(async function() {
        this.logger = jasmine.createSpyObj('logger', ['error', 'debug']);
        this._tempFile = Helper.makeTemporaryFile('test1\ntest2\ntest3\n');
        this.textFile = await JsTextFile.JsTextFile.load(this._tempFile.get_path(), this.logger);
    });

    afterEach(function() {
        Helper.deleteFile(this._tempFile);
    });

    it('returns the line number for matching lines', function() {
        expect(this.textFile._getLineNum('test2')).toBe(1);
        expect(this.textFile._getLineNum('test1')).toBe(0);
        expect(this.textFile._getLineNum('test3')).toBe(2);
        expect(this.textFile._getLineNum('test4')).toBe(-1);
    });

    it('can have lines deleted', function() {
        expect(this.textFile.removeLine('test2')).toBeTruthy();
        expect(this.textFile.lines).toEqual(['test1', 'test3']);
        expect(this.textFile.removeLine('test1')).toBeTruthy();
        expect(this.textFile.lines).toEqual(['test3']);
    });

    it('returns false if a non-existing line is deleted', function() {
        expect(this.textFile.removeLine('test5')).toBeFalsy();
        expect(this.textFile.removeLine('')).toBeFalsy();
    });

    it('can have lines added', function() {
        expect(this.textFile.addLine('test4')).toBeTruthy();
        expect(this.textFile.lines).toEqual(['test1', 'test2', 'test3', 'test4']);
        expect(this.textFile.addLine('test5')).toBeTruthy();
        expect(this.textFile.lines).toEqual(['test1', 'test2', 'test3', 'test4', 'test5']);
    });

    it('can have lines added to the front', function() {
        expect(this.textFile.addLine('test4', true)).toBeTruthy();
        expect(this.textFile.lines).toEqual(['test4', 'test1', 'test2', 'test3']);
        expect(this.textFile.addLine('test5', true)).toBeTruthy();
        expect(this.textFile.lines).toEqual(['test5', 'test4', 'test1', 'test2', 'test3']);
    });

    it('can have its lines modified', function() {
        expect(this.textFile.modifyLine('test2', 'test4')).toBeTruthy();
        expect(this.textFile.lines).toEqual(['test1', 'test4', 'test3']);
        expect(this.textFile.modifyLine('test3', 'test2')).toBeTruthy();
        expect(this.textFile.lines).toEqual(['test1', 'test4', 'test2']);
    });

    it('returns false if non-existing lines are modified', function() {
        expect(this.textFile.modifyLine('test5', 'test6')).toBeFalsy();
        expect(this.textFile.modifyLine('', 'test6')).toBeFalsy();
    });

    it('allows overwriting all lines', function() {
        const expected = ['test4', 'test5', 'test6'];
        this.textFile.lines = expected;

        expect(this.textFile.lines).toEqual(expected);
    });
});

describe('a jsTextFile with empty lines', () => {
    beforeEach(async function() {
        this.logger = jasmine.createSpyObj('logger', ['error', 'debug']);
        this.tempFile = Helper.makeTemporaryFile('test1\n\n\ntest2\n\ntest3\n\n\n');
        this.textFile = await JsTextFile.JsTextFile.load(this.tempFile.get_path(), this.logger);
    });

    afterEach(function() {
        Helper.deleteFile(this.tempFile);
    });

    it('can be trimmed', function() {
        this.textFile._removeEmptyLines();

        expect(this.textFile.lines.join()).toBe('test1,test2,test3');
    });

    it('can be saved with empty lines intact', async function() {
        expect(await this.textFile.saveFile(false)).toBeTruthy();
        const [ok, content] = this.tempFile.load_contents(null);

        expect(ok).toBeTruthy();
        expect(Utils.arrayToString(content)).toEqual('test1\n\n\ntest2\n\ntest3\n\n\n');
    });

    it('can be saved with empty lines removed', async function() {
        expect(await this.textFile.saveFile(true)).toBeTruthy();
        const [ok, content] = this.tempFile.load_contents(null);

        expect(ok).toBeTruthy();
        expect(Utils.arrayToString(content)).toEqual('test1\ntest2\ntest3\n');
    });

    it('reads empty lines correctly', function() {
        expect(this.textFile.lines).toEqual(['test1', '', '', 'test2', '', 'test3', '', '']);
    });
});
/* eslint-enable no-magic-numbers */

/* vi: set expandtab tabstop=4 shiftwidth=4: */
