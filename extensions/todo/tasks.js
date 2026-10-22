// Pure list operations. A task list is always in display order: every pending task (in
// priority order), then every done task (most recently done first). Functions never mutate
// their input and return it unchanged when there is nothing to do.

function split(tasks) {
    return [tasks.filter(t => !t.done), tasks.filter(t => t.done)];
}

export function pendingCount(tasks) {
    return tasks.filter(t => !t.done).length;
}

export function addTask(tasks, text, id) {
    const clean = text.replace(/\s+/g, ' ').trim();
    if (!clean)
        return tasks;
    return [{id, text: clean, done: false}, ...tasks];
}

export function toggleTask(tasks, id) {
    const task = tasks.find(t => t.id === id);
    if (!task)
        return tasks;
    // Last among pending and first among done are the same slot.
    const [pending, done] = split(tasks.filter(t => t !== task));
    return [...pending, {...task, done: !task.done}, ...done];
}

export function deleteTask(tasks, id) {
    return tasks.some(t => t.id === id) ? tasks.filter(t => t.id !== id) : tasks;
}

// toIndex is a position among the pending tasks once the moved one is taken out.
export function moveTask(tasks, id, toIndex) {
    const task = tasks.find(t => t.id === id);
    if (!task || task.done)
        return tasks;
    const [pending, done] = split(tasks.filter(t => t !== task));
    const index = Math.max(0, Math.min(toIndex, pending.length));
    pending.splice(index, 0, task);
    return [...pending, ...done];
}

export function parseTasks(text) {
    const data = JSON.parse(text);
    if (!Array.isArray(data))
        throw new Error('tasks file is not a list');
    for (const t of data) {
        if (typeof t?.id !== 'string' || typeof t.text !== 'string' ||
            typeof t.done !== 'boolean')
            throw new Error(`bad task: ${JSON.stringify(t)}`);
    }
    const [pending, done] = split(data.map(({id, text: taskText, done: isDone}) =>
        ({id, text: taskText, done: isDone})));
    return [...pending, ...done];
}

export function serializeTasks(tasks) {
    return `${JSON.stringify(tasks, null, 2)}\n`;
}
