import Chart from "chart.js/auto";
import { getDaySummary, getWeeklyNotes, saveWeeklyNotes } from "./db.js";
import { showToast, getScoreColor, getGradeInfo, ymd, getMonday, escapeHtml } from "./ui.js";

let config = [];
let currentWeekStart = getMonday(new Date());
let weeklyChart = null;

const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

export function initWeekly(initialConfig) {
  config = initialConfig;
  updateWeekLabel();
  document.getElementById("week-prev-btn").addEventListener("click", () => shiftWeek(-7));
  document.getElementById("week-next-btn").addEventListener("click", () => shiftWeek(7));
  document.getElementById("gen-week-btn").addEventListener("click", generate);
  document.getElementById("save-wk-notes-btn").addEventListener("click", async () => {
    await saveWeeklyNotes(ymd(currentWeekStart), document.getElementById("wk-reflection").value);
    showToast("Weekly notes saved ✓");
  });
  document.getElementById("print-wk-btn").addEventListener("click", () => window.print());
}

export function setWeeklyConfig(newConfig) {
  config = newConfig;
}

function shiftWeek(days) {
  currentWeekStart.setDate(currentWeekStart.getDate() + days);
  updateWeekLabel();
}

function fmtShort(d) {
  return d.toLocaleDateString("en-NZ", { month: "short", day: "numeric" });
}

function updateWeekLabel() {
  const fri = new Date(currentWeekStart);
  fri.setDate(fri.getDate() + 4);
  document.getElementById("week-range-label").textContent =
    `${fmtShort(currentWeekStart)} – ${fmtShort(fri)}, ${fri.getFullYear()}`;
}

async function generate() {
  const days = [];
  for (let i = 0; i < 5; i++) {
    const d = new Date(currentWeekStart);
    d.setDate(d.getDate() + i);
    days.push(await getDaySummary(ymd(d)));
  }

  document.getElementById("weekly-content").classList.remove("hidden");
  document.getElementById("weekly-empty").classList.add("hidden");

  // Stats
  let totalTrades = 0,
    totalA = 0,
    daysWithData = 0,
    overallSum = 0;
  for (const d of days) {
    if (d) {
      totalTrades += d.tradesTaken;
      totalA += d.aSetups;
      daysWithData++;
      overallSum += d.overall;
    }
  }
  document.getElementById("wk-total-trades").textContent = totalTrades;
  document.getElementById("wk-a-setups").textContent = totalA;
  document.getElementById("wk-a-pct").textContent =
    totalTrades > 0 ? Math.round((totalA / totalTrades) * 100) + "%" : "0%";
  const avgGrade = daysWithData > 0 ? overallSum / daysWithData : 0;
  const gi = getGradeInfo(avgGrade);
  const avgEl = document.getElementById("wk-avg-grade");
  avgEl.textContent = daysWithData > 0 ? `${gi.letter} (${avgGrade.toFixed(1)})` : "—";
  avgEl.style.color = daysWithData > 0 ? gi.color : "#94a3b8";

  // Per-category weekly averages (active categories only)
  const catAvgs = config.map((cat) => {
    let sum = 0,
      cnt = 0;
    for (const d of days) {
      if (d && d.catAvgs[cat.id] !== undefined) {
        sum += d.catAvgs[cat.id];
        cnt++;
      }
    }
    return cnt > 0 ? sum / cnt : 0;
  });

  renderChart(catAvgs);
  renderGrid(days);
  renderStrengthsFocus(catAvgs);

  document.getElementById("wk-reflection").value = await getWeeklyNotes(ymd(currentWeekStart));
}

function barColor(v, alpha) {
  if (v >= 9) return alpha ? "rgba(34,197,94,0.7)" : "#22c55e";
  if (v >= 7) return alpha ? "rgba(59,130,246,0.7)" : "#3b82f6";
  if (v >= 5) return alpha ? "rgba(245,158,11,0.7)" : "#f59e0b";
  if (v >= 3) return alpha ? "rgba(249,115,22,0.7)" : "#f97316";
  return alpha ? "rgba(239,68,68,0.7)" : "#ef4444";
}

function renderChart(catAvgs) {
  const ctx = document.getElementById("weekly-chart").getContext("2d");
  if (weeklyChart) weeklyChart.destroy();
  weeklyChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: config.map((c) => c.name),
      datasets: [
        {
          label: "Weekly Average",
          data: catAvgs.map((v) => parseFloat(v.toFixed(1))),
          backgroundColor: catAvgs.map((v) => barColor(v, true)),
          borderColor: catAvgs.map((v) => barColor(v, false)),
          borderWidth: 1,
          borderRadius: 4,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: "y",
      scales: {
        x: {
          min: 0,
          max: 10,
          ticks: { color: "#94a3b8", font: { family: "Inter", size: 11 } },
          grid: { color: "rgba(53,56,73,0.5)" },
        },
        y: {
          ticks: { color: "#cbd5e1", font: { family: "Inter", size: 12, weight: 500 } },
          grid: { display: false },
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "#1a1d27",
          titleColor: "#f1f5f9",
          bodyColor: "#cbd5e1",
          borderColor: "#353849",
          borderWidth: 1,
          cornerRadius: 8,
          titleFont: { family: "Inter", weight: 600 },
          bodyFont: { family: "Inter" },
        },
      },
    },
  });
}

function renderGrid(days) {
  const head = document.getElementById("wk-grid-head");
  head.innerHTML =
    `<th class="py-2 text-left font-medium">Day</th>` +
    config
      .map((c) => `<th class="py-2 text-center font-medium">${escapeHtml(shortName(c.name))}</th>`)
      .join("") +
    `<th class="py-2 text-center font-medium">Grade</th>`;

  const tbody = document.getElementById("wk-grid-body");
  tbody.innerHTML = "";
  days.forEach((d, i) => {
    const tr = document.createElement("tr");
    tr.className = "border-b border-base-600";
    let cells = `<td class="py-2.5 text-left text-txt-200 font-medium">${DAY_NAMES[i]}</td>`;
    if (d && Object.keys(d.catAvgs).length > 0) {
      for (const cat of config) {
        const v = d.catAvgs[cat.id];
        if (v === undefined) {
          cells += `<td class="py-2.5 text-center text-txt-500">—</td>`;
        } else {
          const sc = getScoreColor(v);
          cells += `<td class="py-2.5 text-center"><span class="text-xs font-semibold px-2 py-0.5 rounded-md tabular-nums" style="background:${sc.bg};color:${sc.text};">${v.toFixed(1)}</span></td>`;
        }
      }
      const g = getGradeInfo(d.overall);
      cells += `<td class="py-2.5 text-center"><span class="text-sm font-bold px-2 py-0.5 rounded-md" style="background:${getScoreColor(d.overall).bg};color:${g.color};">${g.letter}</span></td>`;
    } else {
      for (let j = 0; j < config.length + 1; j++) {
        cells += `<td class="py-2.5 text-center text-txt-500">—</td>`;
      }
    }
    tr.innerHTML = cells;
    tbody.appendChild(tr);
  });
}

// "Emotional & Mental Stability" -> "Emotional" for column headers
function shortName(name) {
  return name.split(/\s+/)[0].replace(/&$/, "");
}

function renderStrengthsFocus(catAvgs) {
  const indexed = config
    .map((c, i) => ({ name: c.name, avg: catAvgs[i] }))
    .filter((x) => x.avg > 0)
    .sort((a, b) => b.avg - a.avg);
  const strengthsEl = document.getElementById("wk-strengths");
  const focusEl = document.getElementById("wk-focus");
  strengthsEl.innerHTML = "";
  focusEl.innerHTML = "";

  const rowHtml = (s) => {
    const sc = getScoreColor(s.avg);
    return `<div class="flex items-center justify-between p-3 rounded-xl" style="background:${sc.bg}"><span class="text-sm font-medium" style="color:${sc.text}">${escapeHtml(s.name)}</span><span class="text-sm font-bold tabular-nums" style="color:${sc.text}">${s.avg.toFixed(1)}</span></div>`;
  };

  if (indexed.length === 0) {
    strengthsEl.innerHTML = '<p class="text-sm text-txt-500">No data for this week</p>';
    focusEl.innerHTML = '<p class="text-sm text-txt-500">No data for this week</p>';
  } else if (indexed.length === 1) {
    strengthsEl.innerHTML = rowHtml(indexed[0]);
    focusEl.innerHTML = '<p class="text-sm text-txt-500">Add more categories to compare</p>';
  } else {
    indexed.slice(0, 2).forEach((s) => (strengthsEl.innerHTML += rowHtml(s)));
    indexed
      .slice(-2)
      .reverse()
      .forEach((s) => (focusEl.innerHTML += rowHtml(s)));
  }
}
