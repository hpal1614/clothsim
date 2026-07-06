import { Store } from "./store.js";
import { parseTaskInput } from "./nlTask.js";
import { tearTaskRow } from "./cloth/tearTask.js";

const store = new Store();
let view = "today"; // "today" | "upcoming"

const app = document.getElementById("app");
app.style.position = "relative";

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
  return `
    <li class="task-row" data-id="${task.id}">
      <button class="task-checkbox" aria-label="Complete task"></button>
      <span class="task-title">${escapeHtml(task.title)}</span>
      ${due ? `<span class="task-due">${due}</span>` : ""}
      <button class="task-remove" aria-label="Delete task">&times;</button>
    </li>
  `;
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
  const tasks = store.today();
  const list = tasks.length
    ? `<ul class="task-list">${tasks.map(taskRowHtml).join("")}</ul>`
    : emptyStateHtml("Nothing due today.", "Add something above, or enjoy the quiet.");

  return `
    <div class="quick-add">
      <div class="quick-add-field">
        <input type="text" id="quick-add-input" placeholder="Call dentist tomorrow 3pm, or stretch daily…" />
        <kbd class="kbd-hint">/</kbd>
      </div>
      <button id="quick-add-submit">Add</button>
    </div>
    ${list}
  `;
}

function renderUpcoming() {
  const groups = store.upcoming();
  if (groups.size === 0) {
    return emptyStateHtml("Nothing scheduled ahead yet.", "Tasks with a future date will collect here.");
  }
  let html = "";
  for (const [dateKey, tasks] of groups) {
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

function render() {
  const today = new Date().toLocaleDateString([], {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  app.innerHTML = `
    <div class="glass-panel">
      <div class="app-header">
        <h1>Today</h1>
        <span class="date">${today}</span>
      </div>
      <div class="nav-tabs">
        <button data-view="today" class="${view === "today" ? "active" : ""}">Today</button>
        <button data-view="upcoming" class="${view === "upcoming" ? "active" : ""}">Upcoming</button>
      </div>
      <div id="view-body">
        ${view === "today" ? renderToday() : renderUpcoming()}
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
