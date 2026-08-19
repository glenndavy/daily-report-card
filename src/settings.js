import {
  loadConfig,
  addCategory,
  renameCategory,
  setCategoryDescription,
  setCategoryActive,
  swapCategoryOrder,
  addMetric,
  renameMetric,
  setMetricActive,
  swapMetricOrder,
  metricHasScores,
  deleteMetric,
  categoryHasScores,
  deleteCategory,
} from "./db.js";
import { showToast, refreshIcons, escapeHtml, CATEGORY_ICONS } from "./ui.js";

let onConfigChanged = null; // callback: notify main.js so Daily/Weekly re-render

export function initSettings(configChangedCallback) {
  onConfigChanged = configChangedCallback;
  document.getElementById("add-category-btn").addEventListener("click", async () => {
    const name = prompt("New category name:");
    if (!name || !name.trim()) return;
    await addCategory(name.trim());
    await refresh("Category added ✓");
  });
  render();
}

async function refresh(toastMsg) {
  await render();
  if (toastMsg) showToast(toastMsg);
  if (onConfigChanged) await onConfigChanged();
}

async function render() {
  const cats = await loadConfig({ includeInactive: true });
  const root = document.getElementById("settings-categories");
  root.innerHTML = "";

  cats.forEach((cat, ci) => {
    const card = document.createElement("section");
    card.className =
      "bg-base-700 rounded-2xl p-5 border border-base-500" + (cat.active ? "" : " inactive-row");
    card.innerHTML = `
      <div class="flex items-center gap-2 mb-1 flex-wrap">
        <select data-icon-sel class="!w-auto text-sm" title="Category icon">
          ${CATEGORY_ICONS.map((ic) => `<option value="${ic}" ${ic === cat.icon ? "selected" : ""}>${ic}</option>`).join("")}
        </select>
        <input type="text" data-cat-name class="!w-auto flex-1 min-w-[180px] font-semibold" value="${escapeHtml(cat.name)}" />
        <button class="settings-icon-btn" data-cat-up title="Move up" ${ci === 0 ? "disabled" : ""}><i data-lucide="chevron-up"></i></button>
        <button class="settings-icon-btn" data-cat-down title="Move down" ${ci === cats.length - 1 ? "disabled" : ""}><i data-lucide="chevron-down"></i></button>
        <button class="settings-icon-btn" data-cat-toggle title="${cat.active ? "Retire category (kept in history)" : "Restore category"}">
          <i data-lucide="${cat.active ? "eye-off" : "eye"}"></i>
        </button>
        <button class="settings-icon-btn danger" data-cat-delete title="Delete category (only if never scored)"><i data-lucide="trash-2"></i></button>
      </div>
      <input type="text" data-cat-desc class="text-xs mb-3" placeholder="Description shown in the tooltip…" value="${escapeHtml(cat.description || "")}" />
      <div class="flex flex-col gap-2" data-metric-list></div>
      <div class="flex gap-2 mt-3">
        <input type="text" data-new-metric placeholder="New metric label…" class="flex-1" />
        <button class="settings-icon-btn" data-add-metric title="Add metric"><i data-lucide="plus"></i></button>
      </div>
    `;

    // Category handlers
    const nameInput = card.querySelector("[data-cat-name]");
    nameInput.addEventListener("change", async () => {
      const v = nameInput.value.trim();
      if (!v) {
        nameInput.value = cat.name;
        return;
      }
      await renameCategory(cat.id, v);
      await refresh("Renamed ✓");
    });
    const descInput = card.querySelector("[data-cat-desc]");
    descInput.addEventListener("change", async () => {
      await setCategoryDescription(cat.id, descInput.value.trim());
      await refresh("Description saved ✓");
    });
    card.querySelector("[data-icon-sel]").addEventListener("change", async (e) => {
      const d = await import("./db.js");
      const dbi = await d.getDb();
      await dbi.execute(`UPDATE categories SET icon = $1 WHERE id = $2`, [e.target.value, cat.id]);
      await refresh("Icon updated ✓");
    });
    card.querySelector("[data-cat-up]").addEventListener("click", async () => {
      if (ci > 0) {
        await swapCategoryOrder(cat.id, cats[ci - 1].id);
        await refresh();
      }
    });
    card.querySelector("[data-cat-down]").addEventListener("click", async () => {
      if (ci < cats.length - 1) {
        await swapCategoryOrder(cat.id, cats[ci + 1].id);
        await refresh();
      }
    });
    card.querySelector("[data-cat-toggle]").addEventListener("click", async () => {
      await setCategoryActive(cat.id, !cat.active);
      await refresh(cat.active ? "Category retired (history kept)" : "Category restored ✓");
    });
    card.querySelector("[data-cat-delete]").addEventListener("click", async () => {
      if (await categoryHasScores(cat.id)) {
        showToast("Has saved scores — retire it instead of deleting", "#f59e0b");
        return;
      }
      if (!confirm(`Delete category "${cat.name}" and its metrics? This cannot be undone.`)) return;
      await deleteCategory(cat.id);
      await refresh("Category deleted");
    });

    // Metrics
    const list = card.querySelector("[data-metric-list]");
    cat.metrics.forEach((m, mi) => {
      const row = document.createElement("div");
      row.className = "flex items-center gap-2" + (m.active ? "" : " inactive-row");
      row.innerHTML = `
        <input type="text" data-metric-label class="flex-1 text-sm" value="${escapeHtml(m.label)}" />
        <button class="settings-icon-btn" data-m-up title="Move up" ${mi === 0 ? "disabled" : ""}><i data-lucide="chevron-up"></i></button>
        <button class="settings-icon-btn" data-m-down title="Move down" ${mi === cat.metrics.length - 1 ? "disabled" : ""}><i data-lucide="chevron-down"></i></button>
        <button class="settings-icon-btn" data-m-toggle title="${m.active ? "Retire metric (kept in history)" : "Restore metric"}">
          <i data-lucide="${m.active ? "eye-off" : "eye"}"></i>
        </button>
        <button class="settings-icon-btn danger" data-m-delete title="Delete metric (only if never scored)"><i data-lucide="trash-2"></i></button>
      `;
      const labelInput = row.querySelector("[data-metric-label]");
      labelInput.addEventListener("change", async () => {
        const v = labelInput.value.trim();
        if (!v) {
          labelInput.value = m.label;
          return;
        }
        await renameMetric(m.id, v);
        await refresh("Renamed ✓");
      });
      row.querySelector("[data-m-up]").addEventListener("click", async () => {
        if (mi > 0) {
          await swapMetricOrder(m.id, cat.metrics[mi - 1].id);
          await refresh();
        }
      });
      row.querySelector("[data-m-down]").addEventListener("click", async () => {
        if (mi < cat.metrics.length - 1) {
          await swapMetricOrder(m.id, cat.metrics[mi + 1].id);
          await refresh();
        }
      });
      row.querySelector("[data-m-toggle]").addEventListener("click", async () => {
        await setMetricActive(m.id, !m.active);
        await refresh(m.active ? "Metric retired (history kept)" : "Metric restored ✓");
      });
      row.querySelector("[data-m-delete]").addEventListener("click", async () => {
        if (await metricHasScores(m.id)) {
          showToast("Has saved scores — retire it instead of deleting", "#f59e0b");
          return;
        }
        if (!confirm(`Delete metric "${m.label}"? This cannot be undone.`)) return;
        await deleteMetric(m.id);
        await refresh("Metric deleted");
      });
      list.appendChild(row);
    });

    // Add metric
    const newInput = card.querySelector("[data-new-metric]");
    const doAdd = async () => {
      const v = newInput.value.trim();
      if (!v) return;
      await addMetric(cat.id, v);
      newInput.value = "";
      await refresh("Metric added ✓");
    };
    card.querySelector("[data-add-metric]").addEventListener("click", doAdd);
    newInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") doAdd();
    });

    root.appendChild(card);
  });

  refreshIcons();
}
