const STORAGE_KEY = "torn.tasks.v1";

function load() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function save(tasks) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

const RECUR_MS = {
  daily: 24 * 60 * 60 * 1000,
  weekly: 7 * 24 * 60 * 60 * 1000,
};

export class Store {
  constructor() {
    this.tasks = load();
    this.listeners = new Set();
  }

  onChange(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  _emit() {
    save(this.tasks);
    for (const fn of this.listeners) fn(this.tasks);
  }

  add({ title, due, project = null, recur = null }) {
    this.tasks.push({
      id: uid(),
      title,
      due,
      project,
      recur,
      done: false,
      createdAt: Date.now(),
    });
    this._emit();
  }

  complete(id) {
    const task = this.tasks.find((t) => t.id === id);
    if (!task || task.done) return;
    task.done = true;
    task.completedAt = Date.now();

    if (task.recur && RECUR_MS[task.recur] && task.due) {
      const nextDue = task.due + RECUR_MS[task.recur];
      this.tasks.push({
        ...task,
        id: uid(),
        due: nextDue,
        done: false,
        completedAt: undefined,
        createdAt: Date.now(),
      });
    }

    this._emit();
  }

  remove(id) {
    this.tasks = this.tasks.filter((t) => t.id !== id);
    this._emit();
  }

  /** Tasks due today or overdue and not done. */
  today() {
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);
    return this.tasks
      .filter((t) => !t.done && (!t.due || t.due <= endOfToday.getTime()))
      .sort((a, b) => (a.due ?? Infinity) - (b.due ?? Infinity));
  }

  /** Undone tasks due after today, grouped by date string. */
  upcoming() {
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);
    const future = this.tasks
      .filter((t) => !t.done && t.due && t.due > endOfToday.getTime())
      .sort((a, b) => a.due - b.due);

    const groups = new Map();
    for (const t of future) {
      const key = new Date(t.due).toDateString();
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(t);
    }
    return groups;
  }
}
