// Run with: gjs -m extensions/todo/store.test.js
import GLib from 'gi://GLib';
import System from 'system';

import {loadTasks, saveTasks} from './store.js';

let failures = 0;

function check(name, actual, expected) {
    const a = JSON.stringify(actual);
    const e = JSON.stringify(expected);
    if (a === e) {
        print(`ok   ${name}`);
    } else {
        failures++;
        print(`FAIL ${name}\n     expected ${e}\n     got      ${a}`);
    }
}

const freshPath = () => `${GLib.dir_make_tmp('todo-test-XXXXXX')}/x/tasks.json`;
const t = [{id: 'a', text: 'A', done: false}, {id: 'c', text: 'C', done: true}];

check('missing file loads empty', loadTasks(freshPath()), []);

let p = freshPath();
saveTasks(p, t);
check('save creates directory', loadTasks(p), t);

p = freshPath();
saveTasks(p, t);
saveTasks(p, []);
check('save overwrites', loadTasks(p), []);

p = freshPath();
GLib.mkdir_with_parents(GLib.path_get_dirname(p), 0o700);
GLib.file_set_contents(p, 'not json');
check('malformed file loads empty', loadTasks(p), []);
check('malformed file is moved aside', GLib.file_test(p, GLib.FileTest.EXISTS), false);
check('malformed file is kept as .bad',
    new TextDecoder().decode(GLib.file_get_contents(`${p}.bad`)[1]), 'not json');

const read = path => new TextDecoder().decode(GLib.file_get_contents(path)[1]);
p = freshPath();
GLib.mkdir_with_parents(GLib.path_get_dirname(p), 0o700);
GLib.file_set_contents(p, 'first');
loadTasks(p);
GLib.file_set_contents(p, 'second');
loadTasks(p);
check('an older .bad file is not overwritten', read(`${p}.bad`), 'first');
check('a second bad file is kept too', read(`${p}.bad.1`), 'second');

if (failures)
    System.exit(1);
