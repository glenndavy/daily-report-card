import { save, open, confirm as confirmDialog } from "@tauri-apps/plugin-dialog";
import { writeTextFile, readTextFile } from "@tauri-apps/plugin-fs";
import { getDb } from "./db.js";
import { showToast, ymd } from "./ui.js";

let onDataChanged = null;

export function initBackup(dataChangedCallback) {
  onDataChanged = dataChangedCallback;
  document.getElementById("export-backup-btn").addEventListener("click", exportBackup);
  document.getElementById("import-backup-btn").addEventListener("click", importBackup);
}

/* ---------- export ---------- */

async function exportBackup() {
  try {
    const d = await getDb();
    const payload = {
      app: "smb-report-card",
      format: 1,
      exported_at: new Date().toISOString(),
      categories: await d.select(`SELECT * FROM categories ORDER BY id`),
      metrics: await d.select(`SELECT * FROM metrics ORDER BY id`),
      report_cards: await d.select(`SELECT * FROM report_cards ORDER BY id`),
      scores: await d.select(`SELECT * FROM scores ORDER BY id`),
      weekly_notes: await d.select(`SELECT * FROM weekly_notes ORDER BY id`),
    };
    const path = await save({
      defaultPath: `SMB_ReportCard_Backup_${ymd(new Date())}.json`,
      filters: [{ name: "JSON", extensions: ["json"] }],
    });
    if (!path) return;
    await writeTextFile(path, JSON.stringify(payload, null, 2));
    showToast("Backup exported ✓");
  } catch (e) {
    console.error(e);
    showToast("Export failed — see console", "#ef4444");
  }
}

/* ---------- import ---------- */

async function importBackup() {
  try {
    const path = await open({
      multiple: false,
      filters: [{ name: "JSON", extensions: ["json"] }],
    });
    if (!path) return;
    const text = await readTextFile(path);
    const data = JSON.parse(text);

    if (data && data.app === "smb-report-card" && data.format === 1) {
      const ok = await confirmDialog(
        "Importing a native backup REPLACES all current data (categories, metrics, entries). Continue?",
        { title: "Import backup", kind: "warning" }
      );
      if (!ok) return;
      await importNative(data);
      showToast("Backup restored ✓");
    } else if (data && typeof data === "object" && hasLegacyKeys(data)) {
      const ok = await confirmDialog(
        "This looks like a backup from the HTML prototype (localStorage export). Entries will be mapped onto the current metric set and merged into the database. Continue?",
        { title: "Import legacy backup", kind: "info" }
      );
      if (!ok) return;
      const n = await importLegacy(data);
      showToast(`Legacy backup imported — ${n} entries ✓`);
    } else {
      showToast("Unrecognised backup format", "#ef4444");
      return;
    }
    if (onDataChanged) await onDataChanged();
  } catch (e) {
    console.error(e);
    showToast("Import failed — see console", "#ef4444");
  }
}

function hasLegacyKeys(data) {
  return Object.keys(data).some((k) => k.startsWith("smb-day-") || k.startsWith("smb-week-"));
}

async function importNative(data) {
  const d = await getDb();
  await d.execute("DELETE FROM scores");
  await d.execute("DELETE FROM report_cards");
  await d.execute("DELETE FROM metrics");
  await d.execute("DELETE FROM categories");
  await d.execute("DELETE FROM weekly_notes");
  for (const c of data.categories) {
    await d.execute(
      `INSERT INTO categories (id, key, name, description, icon, sort_order, active)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [c.id, c.key, c.name, c.description, c.icon, c.sort_order, c.active]
    );
  }
  for (const m of data.metrics) {
    await d.execute(
      `INSERT INTO metrics (id, category_id, label, sort_order, active) VALUES ($1,$2,$3,$4,$5)`,
      [m.id, m.category_id, m.label, m.sort_order, m.active]
    );
  }
  for (const r of data.report_cards) {
    await d.execute(
      `INSERT INTO report_cards
        (id, date, session_type, session_start, session_end, instruments,
         trades_taken, planned_trades, a_setups, b_setups, c_setups,
         note_well, note_improve, note_lesson, note_focus, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
      [
        r.id, r.date, r.session_type, r.session_start, r.session_end, r.instruments,
        r.trades_taken, r.planned_trades, r.a_setups, r.b_setups, r.c_setups,
        r.note_well, r.note_improve, r.note_lesson, r.note_focus, r.created_at, r.updated_at,
      ]
    );
  }
  for (const s of data.scores) {
    await d.execute(
      `INSERT INTO scores (id, report_card_id, metric_id, value) VALUES ($1,$2,$3,$4)`,
      [s.id, s.report_card_id, s.metric_id, s.value]
    );
  }
  for (const w of data.weekly_notes) {
    await d.execute(
      `INSERT INTO weekly_notes (id, week_start, reflection) VALUES ($1,$2,$3)`,
      [w.id, w.week_start, w.reflection]
    );
  }
}

/*
 * Legacy import: the prototype stored per-category slider arrays keyed by
 * category key ('playbook', 'quality', …) with values in seed order. We map
 * array position -> metric via (category key, metric sort_order). This is
 * exact if the seed set hasn't been edited; if metrics were added/removed
 * first, positions may not line up — import before customising.
 */
async function importLegacy(data) {
  const d = await getDb();
  const cats = await d.select(`SELECT id, key FROM categories`);
  const catByKey = new Map(cats.map((c) => [c.key, c.id]));
  const metrics = await d.select(
    `SELECT id, category_id, sort_order FROM metrics ORDER BY category_id, sort_order, id`
  );
  const metricsByCat = new Map();
  for (const m of metrics) {
    if (!metricsByCat.has(m.category_id)) metricsByCat.set(m.category_id, []);
    metricsByCat.get(m.category_id).push(m);
  }

  let imported = 0;
  for (const [key, raw] of Object.entries(data)) {
    if (key.startsWith("smb-day-")) {
      const day = typeof raw === "string" ? JSON.parse(raw) : raw;
      if (!day || !day.date) continue;
      await d.execute(
        `INSERT INTO report_cards
           (date, session_type, session_start, session_end, instruments,
            trades_taken, planned_trades, a_setups, b_setups, c_setups,
            note_well, note_improve, note_lesson, note_focus, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14, datetime('now'))
         ON CONFLICT(date) DO UPDATE SET
           session_type=excluded.session_type, session_start=excluded.session_start,
           session_end=excluded.session_end, instruments=excluded.instruments,
           trades_taken=excluded.trades_taken, planned_trades=excluded.planned_trades,
           a_setups=excluded.a_setups, b_setups=excluded.b_setups, c_setups=excluded.c_setups,
           note_well=excluded.note_well, note_improve=excluded.note_improve,
           note_lesson=excluded.note_lesson, note_focus=excluded.note_focus,
           updated_at=datetime('now')`,
        [
          day.date,
          day.sessionType || null,
          day.sessionStartTime || null,
          day.sessionEndTime || null,
          day.instruments || null,
          day.tradesTaken || 0,
          day.plannedTrades || 0,
          day.aSetups || 0,
          day.bSetups || 0,
          day.cSetups || 0,
          day.notes?.well || null,
          day.notes?.improve || null,
          day.notes?.lesson || null,
          day.notes?.focus || null,
        ]
      );
      const rows = await d.select(`SELECT id FROM report_cards WHERE date = $1`, [day.date]);
      const cardId = rows[0].id;
      await d.execute(`DELETE FROM scores WHERE report_card_id = $1`, [cardId]);
      if (day.sliders) {
        for (const [catKey, values] of Object.entries(day.sliders)) {
          const catId = catByKey.get(catKey);
          if (!catId) continue;
          const catMetrics = metricsByCat.get(catId) || [];
          for (let i = 0; i < values.length; i++) {
            const v = values[i];
            if (catMetrics[i] !== undefined && Number.isFinite(v)) {
              await d.execute(
                `INSERT INTO scores (report_card_id, metric_id, value) VALUES ($1,$2,$3)`,
                [cardId, catMetrics[i].id, v]
              );
            }
          }
        }
      }
      imported++;
    } else if (key.startsWith("smb-week-")) {
      const weekStart = key.replace("smb-week-", "");
      const reflection = typeof raw === "string" ? raw : JSON.stringify(raw);
      await d.execute(
        `INSERT INTO weekly_notes (week_start, reflection) VALUES ($1,$2)
         ON CONFLICT(week_start) DO UPDATE SET reflection=excluded.reflection`,
        [weekStart, reflection]
      );
    }
  }
  return imported;
}
