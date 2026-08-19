import { saveDay, getDay, listDates } from "./db.js";
import { showToast, getScoreColor, getGradeInfo, ymd, refreshIcons, escapeHtml } from "./ui.js";

let config = []; // active categories with active metrics
let sliderEls = {}; // metricId -> input element

export function initDaily(initialConfig) {
  config = initialConfig;
  renderCategorySections();
  wireStaticControls();
  document.getElementById("entry-date").value = ymd(new Date());
  document.getElementById("header-date").textContent = new Date().toLocaleDateString("en-NZ", {
    weekday: "long",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  refreshLoadDropdown();
}

// Called after settings change; re-renders sections (unsaved slider positions reset).
export function setDailyConfig(newConfig) {
  config = newConfig;
  renderCategorySections();
}

/* ---------- rendering ---------- */

function renderCategorySections() {
  // Clear previously rendered sections
  document.querySelectorAll("[data-cat-section]").forEach((el) => el.remove());
  sliderEls = {};

  const left = document.getElementById("daily-col-left");
  const right = document.getElementById("daily-col-right");
  const notesSection = document.getElementById("notes-section");

  config.forEach((cat, i) => {
    const section = document.createElement("section");
    section.className = "bg-base-700 rounded-2xl p-5 border border-base-500";
    section.dataset.catSection = cat.id;
    section.innerHTML = `
      <div class="flex items-center gap-2 mb-4">
        <i data-lucide="${escapeHtml(cat.icon || "star")}" class="w-5 h-5 text-pos-400"></i>
        <h2 class="text-base font-semibold text-txt-100">${escapeHtml(cat.name)}</h2>
        ${cat.description ? `<span class="tooltip-trigger ml-1" tabindex="0"><i data-lucide="help-circle" class="w-4 h-4 text-txt-400"></i><span class="tooltip-box">${escapeHtml(cat.description)}</span></span>` : ""}
        <span class="ml-auto text-sm font-bold tabular-nums" data-cat-avg="${cat.id}">—</span>
      </div>
      <div class="flex flex-col gap-3" data-cat-sliders="${cat.id}"></div>
    `;
    // Alternate columns like the prototype: first half left, second half right
    if (i < Math.ceil(config.length / 2)) {
      left.appendChild(section);
    } else {
      right.insertBefore(section, notesSection);
    }

    const container = section.querySelector(`[data-cat-sliders="${cat.id}"]`);
    for (const metric of cat.metrics) {
      container.appendChild(buildSliderRow(metric, cat.id));
    }
  });

  refreshIcons();
  config.forEach((cat) => updateCategoryAvg(cat.id));
  updateOverallGrade();
  const hint = document.getElementById("grade-composite-hint");
  hint.textContent = `Composite of all ${config.length} category averages`;
}

function buildSliderRow(metric, catId) {
  const row = document.createElement("div");
  row.className = "flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3";
  row.innerHTML = `
    <span class="text-xs text-txt-300 sm:w-56 flex-shrink-0">${escapeHtml(metric.label)}</span>
    <input type="range" min="1" max="10" value="5" class="flex-1 min-w-[100px]" data-metric="${metric.id}" data-cat="${catId}" />
    <span class="flex items-center gap-2 flex-shrink-0 sm:w-28 justify-end">
      <span class="text-sm font-bold tabular-nums text-txt-100 w-6 text-right" data-metric-val="${metric.id}">5</span>
      <span class="text-xs font-medium px-2 py-0.5 rounded-md" data-metric-badge="${metric.id}" style="background:rgba(245,158,11,0.15);color:#f59e0b;">Developing</span>
    </span>
  `;
  const slider = row.querySelector("input");
  sliderEls[metric.id] = slider;
  slider.addEventListener("input", () => {
    const v = parseInt(slider.value, 10);
    row.querySelector(`[data-metric-val="${metric.id}"]`).textContent = v;
    const badge = row.querySelector(`[data-metric-badge="${metric.id}"]`);
    const sc = getScoreColor(v);
    badge.style.background = sc.bg;
    badge.style.color = sc.text;
    badge.textContent = sc.label;
    updateCategoryAvg(catId);
    updateOverallGrade();
  });
  return row;
}

/* ---------- grade math ---------- */

function getCatAvg(catId) {
  const cat = config.find((c) => c.id === catId);
  if (!cat || cat.metrics.length === 0) return 0;
  let sum = 0;
  for (const m of cat.metrics) {
    sum += parseInt(sliderEls[m.id]?.value ?? "5", 10);
  }
  return sum / cat.metrics.length;
}

function updateCategoryAvg(catId) {
  const el = document.querySelector(`[data-cat-avg="${catId}"]`);
  if (!el) return;
  const avg = getCatAvg(catId);
  const sc = getScoreColor(avg);
  el.textContent = avg.toFixed(1);
  el.style.color = sc.text;
}

function updateOverallGrade() {
  const cats = config.filter((c) => c.metrics.length > 0);
  const overall =
    cats.length > 0 ? cats.reduce((s, c) => s + getCatAvg(c.id), 0) / cats.length : 0;
  const gi = getGradeInfo(overall);
  document.getElementById("grade-letter").textContent = gi.letter;
  document.getElementById("grade-letter").style.color = gi.color;
  document.getElementById("grade-num").textContent = overall.toFixed(1);
  document.getElementById("grade-label").textContent = gi.label;
  const circle = document.getElementById("grade-ring-circle");
  const circumference = 2 * Math.PI * 52;
  circle.style.strokeDashoffset = circumference - (overall / 10) * circumference;
  circle.style.stroke = gi.color;
  circle.style.transition = "stroke-dashoffset 0.5s ease, stroke 0.3s ease";
}

/* ---------- session controls ---------- */

function wireStaticControls() {
  const start = document.getElementById("session-start");
  const end = document.getElementById("session-end");
  const out = document.getElementById("elapsed-display");
  const calc = () => {
    if (!start.value || !end.value) {
      out.textContent = "—";
      return;
    }
    const [sh, sm] = start.value.split(":").map(Number);
    const [eh, em] = end.value.split(":").map(Number);
    let mins = eh * 60 + em - (sh * 60 + sm);
    if (mins <= 0) mins += 24 * 60; // crossed midnight
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    out.textContent = h > 0 ? `${h}h ${m}m` : `${m}m`;
  };
  for (const ev of ["input", "change"]) {
    start.addEventListener(ev, calc);
    end.addEventListener(ev, calc);
  }

  document.getElementById("save-day-btn").addEventListener("click", onSave);
  document.getElementById("load-prev-sel").addEventListener("change", onLoadSelect);
}

/* ---------- save / load ---------- */

async function onSave() {
  const date = document.getElementById("entry-date").value;
  if (!date) {
    showToast("Please select a date", "#ef4444");
    return;
  }
  const fields = {
    date,
    sessionType: document.getElementById("session-type").value,
    sessionStart: document.getElementById("session-start").value,
    sessionEnd: document.getElementById("session-end").value,
    instruments: document.getElementById("instruments").value,
    tradesTaken: parseInt(document.getElementById("trades-taken").value, 10) || 0,
    plannedTrades: parseInt(document.getElementById("planned-trades").value, 10) || 0,
    aSetups: parseInt(document.getElementById("a-setups").value, 10) || 0,
    bSetups: parseInt(document.getElementById("b-setups").value, 10) || 0,
    cSetups: parseInt(document.getElementById("c-setups").value, 10) || 0,
    noteWell: document.getElementById("note-well").value,
    noteImprove: document.getElementById("note-improve").value,
    noteLesson: document.getElementById("note-lesson").value,
    noteFocus: document.getElementById("note-focus").value,
  };
  const scores = {};
  for (const [metricId, el] of Object.entries(sliderEls)) {
    scores[metricId] = parseInt(el.value, 10);
  }
  try {
    await saveDay(fields, scores);
    showToast("Day saved ✓");
    refreshLoadDropdown();
  } catch (e) {
    console.error(e);
    showToast("Save failed — see console", "#ef4444");
  }
}

async function onLoadSelect(e) {
  const date = e.target.value;
  e.target.value = "";
  if (!date) return;
  const card = await getDay(date);
  if (!card) return;
  document.getElementById("entry-date").value = card.date;
  document.getElementById("session-type").value = card.session_type || "NY Open";
  document.getElementById("session-start").value = card.session_start || "";
  document.getElementById("session-end").value = card.session_end || "";
  document.getElementById("session-start").dispatchEvent(new Event("change"));
  document.getElementById("instruments").value = card.instruments || "";
  document.getElementById("trades-taken").value = card.trades_taken || 0;
  document.getElementById("planned-trades").value = card.planned_trades || 0;
  document.getElementById("a-setups").value = card.a_setups || 0;
  document.getElementById("b-setups").value = card.b_setups || 0;
  document.getElementById("c-setups").value = card.c_setups || 0;
  document.getElementById("note-well").value = card.note_well || "";
  document.getElementById("note-improve").value = card.note_improve || "";
  document.getElementById("note-lesson").value = card.note_lesson || "";
  document.getElementById("note-focus").value = card.note_focus || "";
  for (const [metricId, el] of Object.entries(sliderEls)) {
    el.value = card.scores[metricId] ?? 5;
    el.dispatchEvent(new Event("input"));
  }
  showToast("Loaded " + date);
}

export async function refreshLoadDropdown() {
  const sel = document.getElementById("load-prev-sel");
  while (sel.options.length > 1) sel.remove(1);
  const dates = await listDates();
  for (const d of dates) {
    const opt = document.createElement("option");
    opt.value = d;
    opt.textContent = new Date(d + "T12:00:00").toLocaleDateString("en-NZ", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    sel.appendChild(opt);
  }
}
