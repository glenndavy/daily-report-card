import "./styles.css";
import { loadConfig } from "./db.js";
import { refreshIcons, showToast } from "./ui.js";
import { initDaily, setDailyConfig, refreshLoadDropdown } from "./daily.js";
import { initWeekly, setWeeklyConfig } from "./weekly.js";
import { initSettings } from "./settings.js";
import { initBackup } from "./backup.js";

async function reloadActiveConfig() {
  const config = await loadConfig();
  setDailyConfig(config);
  setWeeklyConfig(config);
  await refreshLoadDropdown();
}

function wireTabs() {
  const panels = {
    daily: document.getElementById("daily-tab"),
    weekly: document.getElementById("weekly-tab"),
    settings: document.getElementById("settings-tab"),
  };
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach((b) => {
        b.classList.remove("tab-active", "bg-base-600");
        b.classList.add("tab-inactive");
      });
      btn.classList.remove("tab-inactive");
      btn.classList.add("tab-active", "bg-base-600");
      for (const [name, panel] of Object.entries(panels)) {
        panel.classList.toggle("hidden", name !== btn.dataset.tab);
      }
    });
  });
}

async function boot() {
  try {
    const config = await loadConfig(); // triggers DB load + migrations
    wireTabs();
    initDaily(config);
    initWeekly(config);
    initSettings(reloadActiveConfig);
    initBackup(reloadActiveConfig);
    refreshIcons();
  } catch (e) {
    console.error("Boot failed:", e);
    showToast("Database failed to open — see console", "#ef4444");
  }
}

boot();
