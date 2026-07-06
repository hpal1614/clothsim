import { Store } from "./store.js";
import { parseTaskInput } from "./nlTask.js";
import { tearTaskRow } from "./cloth/tearTask.js";

const store = new Store();
let view = "today"; // "today" | "upcoming" | "calendar"
let activeProject = null; // null = all projects, else a tag string
let calendarDate = new Date(); // controls which month the calendar view shows
let selectedDate = null; // Date | null, selected day in the calendar view

const app = document.getElementById("app");
app.style.position = "relative";

function dateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function parseDateKey(key) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function formatDue(due) {
  if (!due) return "";
  const d = new Date(due);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  if (isToday) return time;
  return d.toLocaleDateString([], { month: "short", day: "numeric" }) + " " + time;
}

function taskRowHtml(task) {
  const due = formatDue(task.due);
  const projectPill = task.project ? `<span class="task-project">#${escapeHtml(task.project)}</span>` : "";
  return `
    <li class="task-row" data-id="${task.id}">
      <button class="task-checkbox" aria-label="Complete task"></button>
      <span class="task-title">${escapeHtml(task.title)}</span>
      ${projectPill}
      ${due ? `<span class="task-due">${due}</span>` : ""}
      <button class="task-remove" aria-label="Delete task">&times;</button>
    </li>
  `;
}

function projectChipsHtml() {
  const projects = store.projects();
  if (!projects.length) return "";
  const all = [{ label: "All", value: "" }, ...projects.map((p) => ({ label: `#${p}`, value: p }))];
  const chips = all
    .map(({ label, value }) => {
      const active = activeProject === (value || null);
      return `<button class="project-chip ${active ? "active" : ""}" data-project="${escapeHtml(value)}">${escapeHtml(label)}</button>`;
    })
    .join("");
  return `<div class="project-chips">${chips}</div>`;
}

function emptyStateHtml(heading, sub) {
  return `
    <div class="empty-state">
      <svg class="empty-state-glyph" width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
        <path d="M2 20c4-6 8 6 12 0s8-6 12 0" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
        <circle cx="2" cy="20" r="1.6" fill="currentColor" />
      </svg>
      <p class="empty-state-heading">${heading}</p>
      <p class="empty-state-sub">${sub}</p>
    </div>
  `;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function renderToday() {
  const tasks = store.today(activeProject);
  const list = tasks.length
    ? `<ul class="task-list">${tasks.map(taskRowHtml).join("")}</ul>`
    : emptyStateHtml("Nothing due today.", "Add something above, or enjoy the quiet.");

  return `
    <div class="quick-add">
      <div class="quick-add-field">
        <input type="text" id="quick-add-input" placeholder="Call dentist tomorrow 3pm #work, or stretch daily…" />
        <kbd class="kbd-hint">/</kbd>
      </div>
      <button id="quick-add-submit">Add</button>
    </div>
    ${projectChipsHtml()}
    ${list}
  `;
}

function renderUpcoming() {
  const groups = store.upcoming(activeProject);
  const chips = projectChipsHtml();
  if (groups.size === 0) {
    return chips + emptyStateHtml("Nothing scheduled ahead yet.", "Tasks with a future date will collect here.");
  }
  let html = chips;
  for (const [key, tasks] of groups) {
    const label = new Date(tasks[0].due).toLocaleDateString([], {
      weekday: "long",
      month: "short",
      day: "numeric",
    });
    html += `
      <div class="upcoming-group">
        <h3>${label}</h3>
        <ul class="task-list">${tasks.map(taskRowHtml).join("")}</ul>
      </div>
    `;
  }
  return html;
}

function renderCalendar() {
  const year = calendarDate.getFullYear();
  const month = calendarDate.getMonth();
  const counts = store.monthCounts(year, month);
  const firstOfMonth = new Date(year, month, 1);
  const startWeekday = firstOfMonth.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthLabel = firstOfMonth.toLocaleDateString([], { month: "long", year: "numeric" });
  const todayKey = dateKey(new Date());

  let cells = "";
  for (let i = 0; i < startWeekday; i++) {
    cells += `<div class="cal-cell cal-cell--blank"></div>`;
  }
  for (let day = 1; day <= daysInMonth; day++) {
    const cellDate = new Date(year, month, day);
    const key = dateKey(cellDate);
    const isToday = key === todayKey;
    const isSelected = selectedDate && key === dateKey(selectedDate);
    const count = counts.get(day) ?? 0;
    cells += `
      <button class="cal-cell${isToday ? " cal-cell--today" : ""}${isSelected ? " cal-cell--selected" : ""}" data-date="${key}">
        <span class="cal-cell-num">${day}</span>
        ${count ? `<span class="cal-cell-dot" aria-label="${count} task${count === 1 ? "" : "s"}"></span>` : ""}
      </button>
    `;
  }

  const weekdayLabels = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"]
    .map((d) => `<div class="cal-weekday">${d}</div>`)
    .join("");

  let detail = "";
  if (selectedDate) {
    const tasks = store.onDate(selectedDate);
    const label = selectedDate.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" });
    detail = `
      <div class="cal-detail">
        <h3>${label}</h3>
        ${
          tasks.length
            ? `<ul class="task-list">${tasks.map(taskRowHtml).join("")}</ul>`
            : `<div class="cal-detail-empty">Nothing scheduled.</div>`
        }
      </div>
    `;
  }

  return `
    <div class="cal-header">
      <button class="cal-nav" data-cal-nav="-1" aria-label="Previous month">&lsaquo;</button>
      <span class="cal-month-label">${monthLabel}</span>
      <button class="cal-nav" data-cal-nav="1" aria-label="Next month">&rsaquo;</button>
    </div>
    <div class="cal-grid cal-grid--weekdays">${weekdayLabels}</div>
    <div class="cal-grid">${cells}</div>
    ${detail}
  `;
}

const VIEW_TITLES = { today: "Today", upcoming: "Upcoming", calendar: "Calendar" };

function render() {
  const today = new Date().toLocaleDateString([], {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const body = view === "today" ? renderToday() : view === "upcoming" ? renderUpcoming() : renderCalendar();

  app.innerHTML = `
    <div class="glass-panel">
      <div class="app-header">
        <h1>${VIEW_TITLES[view]}</h1>
        <span class="date">${today}</span>
      </div>
      <div class="nav-tabs">
        <button data-view="today" class="${view === "today" ? "active" : ""}">Today</button>
        <button data-view="upcoming" class="${view === "upcoming" ? "active" : ""}">Upcoming</button>
        <button data-view="calendar" class="${view === "calendar" ? "active" : ""}">Calendar</button>
      </div>
      <div id="view-body">
        ${body}
      </div>
      <div class="glass-slider-row">
        <span>Clear</span>
        <input type="range" id="glass-slider" min="0" max="1" step="0.05"
          value="${getComputedStyle(document.documentElement).getPropertyValue("--glass-tint").trim() || 0.35}" />
        <span>Tinted</span>
      </div>
    </div>
  `;

  attachEvents();
}

function attachEvents() {
  app.querySelectorAll("[data-view]").forEach((btn) => {
    btn.addEventListener("click", () => {
      view = btn.dataset.view;
      render();
    });
  });

  const input = document.getElementById("quick-add-input");
  const submit = document.getElementById("quick-add-submit");

  function submitTask() {
    const parsed = parseTaskInput(input.value);
    if (!parsed || !parsed.title) return;
    store.add(parsed);
    input.value = "";
    render();
  }

  submit?.addEventListener("click", submitTask);
  input?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") submitTask();
  });

  app.querySelectorAll(".task-row").forEach((row) => {
    const id = row.dataset.id;

    row.querySelector(".task-checkbox").addEventListener("click", () => {
      const title = row.querySelector(".task-title").textContent;
      row.classList.add("tearing");
      tearTaskRow({
        container: app.querySelector(".glass-panel"),
        row,
        label: title,
        onComplete: () => {
          store.complete(id);
          render();
        },
      });
    });

    row.querySelector(".task-remove").addEventListener("click", () => {
      store.remove(id);
      render();
    });
  });

  const slider = document.getElementById("glass-slider");
  slider?.addEventListener("input", () => {
    document.documentElement.style.setProperty("--glass-tint", slider.value);
  });

  app.querySelectorAll("[data-project]").forEach((btn) => {
    btn.addEventListener("click", () => {
      activeProject = btn.dataset.project || null;
      render();
    });
  });

  app.querySelectorAll("[data-cal-nav]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const delta = Number(btn.dataset.calNav);
      calendarDate = new Date(calendarDate.getFullYear(), calendarDate.getMonth() + delta, 1);
      selectedDate = null;
      render();
    });
  });

  app.querySelectorAll(".cal-cell[data-date]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const key = btn.dataset.date;
      const clicked = parseDateKey(key);
      selectedDate = selectedDate && dateKey(selectedDate) === key ? null : clicked;
      render();
    });
  });
}

store.onChange(() => {
  // Store already re-rendered synchronously by callers after mutating;
  // this covers any future external mutation source.
});

document.addEventListener("keydown", (e) => {
  const input = document.getElementById("quick-add-input");
  if (!input) return;

  if (e.key === "/" && document.activeElement !== input) {
    e.preventDefault();
    input.focus();
    return;
  }

  if (e.key === "Escape" && document.activeElement === input) {
    if (input.value) input.value = "";
    else input.blur();
  }
});

render();
