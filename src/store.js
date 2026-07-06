const STORAGE_KEY = "torn.tasks.v1";

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    // Storage can be unavailable (sandboxed preview iframes, private mode) — fall back to session-only.
    return [];
  }
}

function save(tasks) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  } catch {
    // No-op if storage is unavailable; tasks still work for the current session.
  }
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
  today(project = null) {
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);
    return this.tasks
      .filter((t) => !t.done && (!t.due || t.due <= endOfToday.getTime()))
      .filter((t) => !project || t.project === project)
      .sort((a, b) => (a.due ?? Infinity) - (b.due ?? Infinity));
  }

  /** Undone tasks due after today, grouped by date string. */
  upcoming(project = null) {
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);
    const future = this.tasks
      .filter((t) => !t.done && t.due && t.due > endOfToday.getTime())
      .filter((t) => !project || t.project === project)
      .sort((a, b) => a.due - b.due);

    const groups = new Map();
    for (const t of future) {
      const key = new Date(t.due).toDateString();
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(t);
    }
    return groups;
  }

  /** Distinct project tags across active (undone) tasks, in first-seen order. */
  projects() {
    const seen = [];
    for (const t of this.tasks) {
      if (!t.done && t.project && !seen.includes(t.project)) seen.push(t.project);
    }
    return seen;
  }

  /** Undone tasks due on the given calendar date. */
  onDate(date) {
    const key = date.toDateString();
    return this.tasks
      .filter((t) => !t.done && t.due && new Date(t.due).toDateString() === key)
      .sort((a, b) => a.due - b.due);
  }

  /** Map of "day-of-month" -> undone task count for the given year/month (0-indexed month). */
  monthCounts(year, month) {
    const counts = new Map();
    for (const t of this.tasks) {
      if (t.done || !t.due) continue;
      const d = new Date(t.due);
      if (d.getFullYear() === year && d.getMonth() === month) {
        counts.set(d.getDate(), (counts.get(d.getDate()) ?? 0) + 1);
      }
    }
    return counts;
  }
}
