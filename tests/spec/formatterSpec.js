import {Formatter} from '../../libs/formatter.js'

/* eslint-disable no-magic-numbers */
const TestReplacementProvider = class {
    constructor() {
        this._numberOfTasks = 1;
    }
    get numberOfTasks() {
        return this._numberOfTasks;
    }
    set numberOfTasks(numberOfTasks) {
        this._numberOfTasks = numberOfTasks;
    }
};

describe('a formatter', () => {
    beforeEach(function() {
        this.formatter = new Formatter();
        const logger = jasmine.createSpyObj('logger', ['error']);
        this.formatter.logger = logger;
    });

    afterEach(function() {
        this.formatter = null;
    });

    it('is initialized with some sensible defaults', function() {
        expect(this.formatter.formatString).toBeNull();
        expect(this.formatter.leftDelimiter).toBe('%');
        expect(this.formatter.rightDelimiter).toBe('');
        expect(this.formatter.tokenLength).toBe(1);
        expect(this.formatter.externalParserLeftDelimiter).toBe('|');
        expect(this.formatter.externalParserRightDelimiter).toBe('|');
        expect(this.formatter.externalParser).toBeNull();
    });

    it('can be initialized with a format in the constructor', () => {
        const formatterInit = new Formatter('{tasks}');

        expect(formatterInit.formatString).toBe('{tasks}');
    });

    it('has configurable delimiters', function() {
        this.formatter.leftDelimiter = '{';
        this.formatter.rightDelimiter = '}';

        expect(this.formatter.leftDelimiter).toBe('{');
        expect(this.formatter.rightDelimiter).toBe('}');

        this.formatter.leftDelimiter = null;
        this.formatter.rightDelimiter = undefined;

        expect(this.formatter.leftDelimiter).toBe('%');
        expect(this.formatter.rightDelimiter).toBe('');
    });

    it('has a configurable token length', function() {
        this.formatter.tokenLength = 20;

        expect(this.formatter.tokenLength).toBe(20);

        this.formatter.tokenLength = 0;

        expect(this.formatter.tokenLength).toBe(0);
    });

    it('has a configurable format string', function() {
        this.formatter.formatString = '%s %d';

        expect(this.formatter._format).toBe('%s %d');

        this.formatter.formatString = '{format}';

        expect(this.formatter._format).toBe('{format}');

        this.formatter.formatString = null;

        expect(this.formatter._format).toBeNull();
    });

    it('throws an error if no replacements are defined', function() {
        this.formatter.formatString = '%s %d';

        expect(() => {
            this.formatter.getString();
        }).toThrowError(/No replacement defined for token s/);
    });

    it('allows configuring replacements', function() {
        expect(this.formatter.setReplacement('s', 'string')).toBeTruthy();
        expect(this.formatter.setReplacement('d', 10)).toBeTruthy();
        expect(this.formatter.getReplacement('s')).toBe('string');
        expect(this.formatter.getReplacement('d')).toBe(10);
        expect(this.formatter.setReplacement()).toBeTruthy();
        expect(this.formatter.getReplacement('s')).toBe('string');
        expect(this.formatter.setReplacement('s')).toBeTruthy();
        expect(this.formatter.getReplacement('s')).toBeNull();
    });

    it('rejects invalid replacements', function() {
        expect(this.formatter.setReplacement('^', 'string')).toBeFalsy();
        expect(this.formatter.setReplacement('d10', 10)).toBeFalsy();
        expect(this.formatter.setReplacement('%', 10)).toBeFalsy();
    });

    it('rejects invalid combinations of settings', function() {
        this.formatter.tokenLength = 0;
        this.formatter.rightDelimiter = '';

        expect(() => {
            this.formatter.getString();
        }).toThrowError(/No end delimiter and no token length specified/);

        this.formatter.rightDelimiter = '}';
        this.formatter.externalParserLeftDelimiter = '';
        this.formatter.externalParserRightDelimiter = '|';

        expect(() => {
            this.formatter.getString();
        }).toThrowError(
            /Either both or none of the delimiters for the external parser should be defined/);
    });

    it('provides printf style replacements', function() {
        this.formatter.setReplacement('s', 'string');
        this.formatter.setReplacement('d', 10);
        this.formatter.formatString = '%s %d';

        expect(this.formatter.getString()).toBe('string 10');

        this.formatter.formatString = 'the string is %s and %d is the decimal';

        expect(this.formatter.getString()).toBe('the string is string and 10 is the decimal');
    });

    it('provides bracket replacements', function() {
        this.formatter.leftDelimiter = '{';
        this.formatter.rightDelimiter = '}';
        this.formatter.tokenLength = 0;
        this.formatter.formatString = '{somestring} {somenumber} {somestring}';
        this.formatter.setReplacement('somestring', 'this is a string');
        this.formatter.setReplacement('somenumber', 43);

        expect(this.formatter.getString()).toBe('this is a string 43 this is a string');
    });


    it('provides bracket replacements from a function', function() {
        this.formatter.leftDelimiter = '{';
        this.formatter.rightDelimiter = '}';
        this.formatter.tokenLength = 0;
        this.formatter.formatString = 'number of tasks: {numberoftasks}';
        const replacer = new TestReplacementProvider();
        this.formatter.setReplacement('numberoftasks', () => {
            return replacer.numberOfTasks;
        });

        replacer.numberOfTasks = 3;

        expect(this.formatter.getString()).toBe('number of tasks: 3');

        replacer.numberOfTasks = 4;

        expect(this.formatter.getString()).toBe('number of tasks: 4');
    });

    it('provides printf style replacements with left padding', function() {
        this.formatter.setReplacement('s', 'string');
        this.formatter.setReplacement('d', 10);
        this.formatter.formatString = '%8ls %4l0d %3ls';

        expect(this.formatter.getString()).toBe('  string 0010 string');

        this.formatter.formatString = 'the string is %6ls and %1l0d is the decimal';

        expect(this.formatter.getString()).toBe('the string is string and 10 is the decimal');
    });

    it('provides bracket replacements with left padding', function() {
        this.formatter.leftDelimiter = '{';
        this.formatter.rightDelimiter = '}';
        this.formatter.tokenLength = 0;
        this.formatter.formatString = '{20l:somestring} {3lx:somenumber} {5l0:somestring}';
        this.formatter.setReplacement('somestring', 'this is a string');
        this.formatter.setReplacement('somenumber', 43);

        expect(this.formatter.getString()).toBe('    this is a string x43 this is a string');
    });

    it('provides bracket replacements from a function with left padding', function() {
        this.formatter.leftDelimiter = '{';
        this.formatter.rightDelimiter = '}';
        this.formatter.tokenLength = 0;
        this.formatter.formatString = 'number of tasks: {4ly:numberoftasks}';
        const replacer = new TestReplacementProvider();
        this.formatter.setReplacement('numberoftasks', () => {
            return replacer.numberOfTasks;
        });

        replacer.numberOfTasks = 3;

        expect(this.formatter.getString()).toBe('number of tasks: yyy3');

        replacer.numberOfTasks = 4;

        expect(this.formatter.getString()).toBe('number of tasks: yyy4');
    });

    it('provides printf style replacements with right padding', function() {
        this.formatter.setReplacement('s', 'string');
        this.formatter.setReplacement('d', 10);
        this.formatter.formatString = '%8rs %4r0d %3rs';

        expect(this.formatter.getString()).toBe('string   1000 string');

        this.formatter.formatString = 'the string is %6rs and %1r0d is the decimal';

        expect(this.formatter.getString()).toBe('the string is string and 10 is the decimal');
    });

    it('provides bracket replacements with right padding', function() {
        this.formatter.leftDelimiter = '{';
        this.formatter.rightDelimiter = '}';
        this.formatter.tokenLength = 0;
        this.formatter.formatString = '{20r:somestring} {3rx:somenumber} {5r0:somestring}';
        this.formatter.setReplacement('somestring', 'this is a string');
        this.formatter.setReplacement('somenumber', 43);

        expect(this.formatter.getString()).toBe('this is a string     43x this is a string');
    });

    it('provides bracket replacements from a function with right padding', function() {
        this.formatter.leftDelimiter = '{';
        this.formatter.rightDelimiter = '}';
        this.formatter.tokenLength = 0;
        this.formatter.formatString = 'number of tasks: {4ry:numberoftasks}';
        const replacer = new TestReplacementProvider();
        this.formatter.setReplacement('numberoftasks', () => {
            return replacer.numberOfTasks;
        });
        replacer.numberOfTasks = 3;

        expect(this.formatter.getString()).toBe('number of tasks: 3yyy');

        replacer.numberOfTasks = 4;

        expect(this.formatter.getString()).toBe('number of tasks: 4yyy');
    });

    it('provides printf style replacements with both sides padding with right emphasis', function() {
        this.formatter.setReplacement('s', 'string');
        this.formatter.setReplacement('d', 10);
        this.formatter.formatString = '%8Rs %5R0d %3Rs';

        expect(this.formatter.getString()).toBe(' string  01000 string');

        this.formatter.formatString = 'the string is %6Rs and %1R0d is the decimal';

        expect(this.formatter.getString()).toBe('the string is string and 10 is the decimal');
    });

    it('provides bracket replacements with both sides padding with right emphasis', function() {
        this.formatter.leftDelimiter = '{';
        this.formatter.rightDelimiter = '}';
        this.formatter.tokenLength = 0;
        this.formatter.formatString = '{20R:somestring} {3Rx:somenumber} {5R0:somestring}';
        this.formatter.setReplacement('somestring', 'this is a string');
        this.formatter.setReplacement('somenumber', 43);

        expect(this.formatter.getString()).toBe('  this is a string   43x this is a string');
    });

    it('provides bracket replacements from function with both sides padding with right emphasis', function() {
        this.formatter.leftDelimiter = '{';
        this.formatter.rightDelimiter = '}';
        this.formatter.tokenLength = 0;
        this.formatter.formatString = 'number of tasks: {4Ry:numberoftasks}';
        const replacer = new TestReplacementProvider();
        this.formatter.setReplacement('numberoftasks', () => {
            return replacer.numberOfTasks;
        });
        replacer.numberOfTasks = 3;

        expect(this.formatter.getString()).toBe('number of tasks: y3yy');

        replacer.numberOfTasks = 4;

        expect(this.formatter.getString()).toBe('number of tasks: y4yy');
    });

    it('provides printf style replacements with both sides padding with left emphasis', function() {
        this.formatter.setReplacement('s', 'string');
        this.formatter.setReplacement('d', 10);
        this.formatter.formatString = '%8Ls %5L0d %3Ls';

        expect(this.formatter.getString()).toBe(' string  00100 string');

        this.formatter.formatString = 'the string is %6Ls and %1L0d is the decimal';

        expect(this.formatter.getString()).toBe('the string is string and 10 is the decimal');
    });

    it('provides bracket replacements with both sides padding with left emphasis', function() {
        this.formatter.leftDelimiter = '{';
        this.formatter.rightDelimiter = '}';
        this.formatter.tokenLength = 0;
        this.formatter.formatString = '{20L:somestring} {3Lx:somenumber} {5L0:somestring}';
        this.formatter.setReplacement('somestring', 'this is a string');
        this.formatter.setReplacement('somenumber', 43);

        expect(this.formatter.getString()).toBe('  this is a string   x43 this is a string');
    });

    it('provides bracket replacements from function with both sides padding with left emphasis', function() {
        this.formatter.leftDelimiter = '{';
        this.formatter.rightDelimiter = '}';
        this.formatter.tokenLength = 0;
        this.formatter.formatString = 'number of tasks: {4Ly:numberoftasks}';
        const replacer = new TestReplacementProvider();
        this.formatter.setReplacement('numberoftasks', () => {
            return replacer.numberOfTasks;
        });
        replacer.numberOfTasks = 3;

        expect(this.formatter.getString()).toBe('number of tasks: yy3y');

        replacer.numberOfTasks = 4;

        expect(this.formatter.getString()).toBe('number of tasks: yy4y');
    });

    it('provides printf style replacements with the possibility to pass a formatstring', function() {
        this.formatter.setReplacement('s', 'string');
        this.formatter.setReplacement('d', 10);
        this.formatter.formatString = '%s %d';

        expect(this.formatter.getString()).toBe('string 10');
        expect(this.formatter.getString({
            formatString: '%d %s'
        })).toBe('10 string');

        expect(this.formatter.getString()).toBe('string 10');
    });

    it('provides bracket replacements with the possibility to pass a formatstring', function() {
        this.formatter.leftDelimiter = '{';
        this.formatter.rightDelimiter = '}';
        this.formatter.tokenLength = 0;
        this.formatter.formatString = '{somestring} {somenumber} {somestring}';
        this.formatter.setReplacement('somestring', 'this is a string');
        this.formatter.setReplacement('somenumber', 43);

        expect(this.formatter.getString()).toBe('this is a string 43 this is a string');
        expect(this.formatter.getString({
            formatString: '{somenumber} {somestring}'
        })).toBe('43 this is a string');

        expect(this.formatter.getString()).toBe('this is a string 43 this is a string');
    });

    it('provides bracket replacements from a function with the possibility to pass a formatstring', function() {
        this.formatter.leftDelimiter = '{';
        this.formatter.rightDelimiter = '}';
        this.formatter.tokenLength = 0;
        this.formatter.formatString = 'number of tasks: {numberoftasks}';
        const replacer = new TestReplacementProvider();
        this.formatter.setReplacement('numberoftasks', () => {
            return replacer.numberOfTasks;
        });
        replacer.numberOfTasks = 3;

        expect(this.formatter.getString()).toBe('number of tasks: 3');
        expect(this.formatter.getString({
            formatString: '{numberoftasks} is the number of tasks'
        })).toBe('3 is the number of tasks');

        replacer.numberOfTasks = 4;

        expect(this.formatter.getString()).toBe('number of tasks: 4');
        expect(this.formatter.getString({
            formatString: '{numberoftasks} is the number of tasks'
        })).toBe('4 is the number of tasks');
    });

    it('provides bracket replacement with overrides', function() {
        this.formatter.leftDelimiter = '{';
        this.formatter.rightDelimiter = '}';
        this.formatter.tokenLength = 0;
        this.formatter.formatString = 'a number: {anumber}, a string: {astring}';
        this.formatter.setReplacement('anumber', 3);
        this.formatter.setReplacement('astring', 'three');

        expect(this.formatter.getString()).toBe('a number: 3, a string: three');
        expect(this.formatter.getString({
            formatString: 'is {astring} actually {anumber}?'
        })).toBe('is three actually 3?');

        expect(this.formatter.getString({
            overrideReplacements: {
                'astring': 'four',
                'anumber': 4
            }
        })).toBe('a number: 4, a string: four');

        expect(this.formatter.getString({
            formatString: 'is {astring} actually {anumber}?',
            overrideReplacements: {
                'astring': 'four',
                'anumber': 4
            }
        })).toBe('is four actually 4?');

        expect(this.formatter.getString()).toBe('a number: 3, a string: three');
    });

    it('has configurable external parser delimiters', function() {
        this.formatter.externalParserLeftDelimiter = '[';
        this.formatter.externalParserRightDelimiter = ']';

        expect(this.formatter.externalParserLeftDelimiter).toBe('[');
        expect(this.formatter.externalParserRightDelimiter).toBe(']');

        this.formatter.externalParserLeftDelimiter = null;
        this.formatter.externalParserRightDelimiter = null;

        expect(this.formatter.externalParserLeftDelimiter).toBe('|');
        expect(this.formatter.externalParserRightDelimiter).toBe('|');
    });

    it('allows setting an external parser', function() {
        this.formatter.externalParser = 3;

        expect(this.formatter.externalParser).toBeNull();

        const parser = function(string) {
            return string;
        };
        this.formatter.externalParser = parser;

        expect(this.formatter.externalParser).toBe(parser);

        this.formatter.externalParser = null;

        expect(this.formatter.externalParser).toBeNull();
    });

    it('provides replacements using an external parsing function', function() {
        this.formatter.externalParser = function(string) {
            return string.toUpperCase();
        };
        this.formatter.formatString = 'a number: %d, a string: |%s|';
        this.formatter.setReplacement('d', 5);
        this.formatter.setReplacement('s', 'lowercase');

        expect(this.formatter.getString()).toBe('a number: 5, a string: LOWERCASE');
        expect(this.formatter.getString({
            formatString: 'is uppercase really |%s|?',
            overrideReplacements: {
                's': 'uppercase'
            }
        })).toBe('is uppercase really UPPERCASE?');
    });

    it('provides replacements using an external parsing function with multiple replacements', function() {
        this.formatter.externalParser = function(string) {
            return string.toUpperCase();
        };
        this.formatter.leftDelimiter = '{';
        this.formatter.rightDelimiter = '}';
        this.formatter.tokenLength = 0;
        this.formatter.formatString = '{stringone} |{stringtwo}||{stringthree}| {number} |{stringfour}';
        this.formatter.setReplacement('stringone', 'first');
        this.formatter.setReplacement('stringtwo', 'second');
        this.formatter.setReplacement('stringthree', 'third');
        this.formatter.setReplacement('stringfour', 'fourth');
        this.formatter.setReplacement('number', 41);

        expect(this.formatter.getString()).toBe('first SECONDTHIRD 41 |fourth');
    });
});
