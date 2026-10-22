import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

import {parseTasks, serializeTasks} from './tasks.js';

// A missing file is an empty list. A file that can't be read is moved to `<path>.bad`
// rather than overwritten by the next save, so no task is ever silently lost.
export function loadTasks(path) {
    const file = Gio.File.new_for_path(path);
    if (!file.query_exists(null))
        return [];
    try {
        const [, bytes] = file.load_contents(null);
        return parseTasks(new TextDecoder().decode(bytes));
    } catch (e) {
        const bad = freeBadPath(path);
        console.error(`todo: can't read ${path}, moving it to ${bad}: ${e.message}`);
        file.move(Gio.File.new_for_path(bad), Gio.FileCopyFlags.NONE, null, null);
        return [];
    }
}

// An older .bad file may hold the real tasks: never replace it
function freeBadPath(path) {
    let bad = `${path}.bad`;
    for (let n = 1; GLib.file_test(bad, GLib.FileTest.EXISTS); n++)
        bad = `${path}.bad.${n}`;
    return bad;
}

// replace_contents writes a temp file and renames it, so a crash never truncates the list.
export function saveTasks(path, tasks) {
    GLib.mkdir_with_parents(GLib.path_get_dirname(path), 0o700);
    const bytes = new TextEncoder().encode(serializeTasks(tasks));
    Gio.File.new_for_path(path).replace_contents(bytes, null, false,
        Gio.FileCreateFlags.REPLACE_DESTINATION, null);
}
