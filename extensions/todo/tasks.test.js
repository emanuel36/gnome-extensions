// Run with: gjs -m extensions/todo/tasks.test.js
import System from 'system';

import {
    addTask, deleteTask, moveTask, parseTasks, pendingCount, serializeTasks, toggleTask,
} from './tasks.js';

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

function throws(fn) {
    try {
        fn();
        return false;
    } catch {
        return true;
    }
}

const ids = ts => ts.map(x => x.id);
const byId = (ts, id) => ts.find(x => x.id === id);

const t = [
    {id: 'a', text: 'A', done: false},
    {id: 'b', text: 'B', done: false},
    {id: 'c', text: 'C', done: true},
];
const original = JSON.stringify(t);

check('addTask puts new task on top', ids(addTask(t, 'N', 'n')), ['n', 'a', 'b', 'c']);
check('addTask stores a pending task', addTask([], 'N', 'n'), [{id: 'n', text: 'N', done: false}]);
check('addTask collapses whitespace', addTask([], '  buy\n milk\t ', 'n')[0].text, 'buy milk');
check('addTask ignores blank', addTask(t, ' \n ', 'n') === t, true);

check('toggle pending goes first in done', ids(toggleTask(t, 'a')), ['b', 'a', 'c']);
check('toggle pending marks done', byId(toggleTask(t, 'a'), 'a').done, true);
check('toggle done goes last in pending', ids(toggleTask(t, 'c')), ['a', 'b', 'c']);
check('toggle done marks pending', byId(toggleTask(t, 'c'), 'c').done, false);
const t2 = [
    {id: 'a', text: 'A', done: false},
    {id: 'c', text: 'C', done: true},
    {id: 'd', text: 'D', done: true},
];
check('toggle done skips other done tasks', ids(toggleTask(t2, 'd')), ['a', 'd', 'c']);

check('deleteTask removes pending', ids(deleteTask(t, 'a')), ['b', 'c']);
check('deleteTask removes done', ids(deleteTask(t, 'c')), ['a', 'b']);

check('moveTask reorders pending', ids(moveTask(t, 'b', 0)), ['b', 'a', 'c']);
check('moveTask clamps high', ids(moveTask(t, 'a', 99)), ['b', 'a', 'c']);
check('moveTask clamps low', ids(moveTask(t, 'a', -3)), ['a', 'b', 'c']);
check('moveTask ignores done', moveTask(t, 'c', 0) === t, true);

check('unknown id toggle is a no-op', toggleTask(t, 'zz') === t, true);
check('unknown id delete is a no-op', deleteTask(t, 'zz') === t, true);
check('unknown id move is a no-op', moveTask(t, 'zz', 0) === t, true);

check('pendingCount', pendingCount(t), 2);
check('pendingCount empty', pendingCount([]), 0);

check('parse round-trips', parseTasks(serializeTasks(t)), t);
check('serialize ends with newline', serializeTasks([]).endsWith('\n'), true);
check('parse normalizes order',
    ids(parseTasks(JSON.stringify([t[2], t[0]]))), ['a', 'c']);
check('parse rejects bad json', throws(() => parseTasks('{')), true);
check('parse rejects non-array', throws(() => parseTasks('{}')), true);
check('parse rejects item without text',
    throws(() => parseTasks('[{"id":"a","done":false}]')), true);

check('inputs are not mutated', JSON.stringify(t), original);

if (failures)
    System.exit(1);
