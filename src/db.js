import Database from "@tauri-apps/plugin-sql";

const DB_URL = "sqlite:report_card.db";
let db = null;

export async function getDb() {
  if (!db) db = await Database.load(DB_URL);
  return db;
}

/* ---------- Config (categories + metrics) ---------- */

// Returns [{ id, key, name, description, icon, sort_order, active, metrics: [...] }]
// includeInactive: settings tab wants everything; daily tab wants active only.
export async function loadConfig({ includeInactive = false } = {}) {
  const d = await getDb();
  const catFilter = includeInactive ? "" : "WHERE active = 1";
  const cats = await d.select(
    `SELECT id, key, name, description, icon, sort_order, active
     FROM categories ${catFilter} ORDER BY sort_order, id`
  );
  const metFilter = includeInactive ? "" : "WHERE active = 1";
  const mets = await d.select(
    `SELECT id, category_id, label, sort_order, active
     FROM metrics ${metFilter} ORDER BY sort_order, id`
  );
  const byCat = new Map();
  for (const m of mets) {
    if (!byCat.has(m.category_id)) byCat.set(m.category_id, []);
    byCat.get(m.category_id).push(m);
  }
  return cats.map((c) => ({ ...c, metrics: byCat.get(c.id) || [] }));
}

/* ---------- Daily entries ---------- */

export async function saveDay(fields, scores) {
  // scores: Map/object of metricId -> value (1..10)
  const d = await getDb();
  await d.execute(
    `INSERT INTO report_cards
       (date, session_type, session_start, session_end, instruments,
        trades_taken, planned_trades, a_setups, b_setups, c_setups,
        note_well, note_improve, note_lesson, note_focus, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14, datetime('now'))
     ON CONFLICT(date) DO UPDATE SET
       session_type=excluded.session_type,
       session_start=excluded.session_start,
       session_end=excluded.session_end,
       instruments=excluded.instruments,
       trades_taken=excluded.trades_taken,
       planned_trades=excluded.planned_trades,
       a_setups=excluded.a_setups,
       b_setups=excluded.b_setups,
       c_setups=excluded.c_setups,
       note_well=excluded.note_well,
       note_improve=excluded.note_improve,
       note_lesson=excluded.note_lesson,
       note_focus=excluded.note_focus,
       updated_at=datetime('now')`,
    [
      fields.date,
      fields.sessionType,
      fields.sessionStart,
      fields.sessionEnd,
      fields.instruments,
      fields.tradesTaken,
      fields.plannedTrades,
      fields.aSetups,
      fields.bSetups,
      fields.cSetups,
      fields.noteWell,
      fields.noteImprove,
      fields.noteLesson,
      fields.noteFocus,
    ]
  );
  const rows = await d.select(`SELECT id FROM report_cards WHERE date = $1`, [fields.date]);
  const cardId = rows[0].id;
  await d.execute(`DELETE FROM scores WHERE report_card_id = $1`, [cardId]);
  for (const [metricId, value] of Object.entries(scores)) {
    await d.execute(
      `INSERT INTO scores (report_card_id, metric_id, value) VALUES ($1,$2,$3)`,
      [cardId, Number(metricId), value]
    );
  }
  return cardId;
}

export async function getDay(date) {
  const d = await getDb();
  const cards = await d.select(`SELECT * FROM report_cards WHERE date = $1`, [date]);
  if (cards.length === 0) return null;
  const card = cards[0];
  const scores = await d.select(
    `SELECT metric_id, value FROM scores WHERE report_card_id = $1`,
    [card.id]
  );
  card.scores = {};
  for (const s of scores) card.scores[s.metric_id] = s.value;
  return card;
}

export async function listDates() {
  const d = await getDb();
  const rows = await d.select(`SELECT date FROM report_cards ORDER BY date DESC`);
  return rows.map((r) => r.date);
}

// Per-category averages + overall for one saved day.
// Averages only cover metrics belonging to *active* categories so the weekly
// view lines up with the current grid columns; scores under retired
// categories remain stored but are excluded from the composite.
export async function getDaySummary(date) {
  const d = await getDb();
  const cards = await d.select(
    `SELECT id, trades_taken, a_setups FROM report_cards WHERE date = $1`,
    [date]
  );
  if (cards.length === 0) return null;
  const card = cards[0];
  const rows = await d.select(
    `SELECT c.id AS cat_id, AVG(s.value) AS avg_value
     FROM scores s
     JOIN metrics m ON m.id = s.metric_id
     JOIN categories c ON c.id = m.category_id
     WHERE s.report_card_id = $1 AND c.active = 1
     GROUP BY c.id`,
    [card.id]
  );
  const catAvgs = {};
  let total = 0;
  for (const r of rows) {
    catAvgs[r.cat_id] = r.avg_value;
    total += r.avg_value;
  }
  const overall = rows.length > 0 ? total / rows.length : 0;
  return {
    date,
    tradesTaken: card.trades_taken || 0,
    aSetups: card.a_setups || 0,
    catAvgs,
    overall,
  };
}

/* ---------- Weekly notes ---------- */

export async function getWeeklyNotes(weekStart) {
  const d = await getDb();
  const rows = await d.select(
    `SELECT reflection FROM weekly_notes WHERE week_start = $1`,
    [weekStart]
  );
  return rows.length > 0 ? rows[0].reflection || "" : "";
}

export async function saveWeeklyNotes(weekStart, reflection) {
  const d = await getDb();
  await d.execute(
    `INSERT INTO weekly_notes (week_start, reflection) VALUES ($1,$2)
     ON CONFLICT(week_start) DO UPDATE SET reflection=excluded.reflection`,
    [weekStart, reflection]
  );
}

/* ---------- Settings mutations ---------- */

export async function addCategory(name, icon = "star") {
  const d = await getDb();
  const key = slugify(name);
  const rows = await d.select(`SELECT COALESCE(MAX(sort_order), 0) AS mx FROM categories`);
  await d.execute(
    `INSERT INTO categories (key, name, description, icon, sort_order, active)
     VALUES ($1,$2,$3,$4,$5,1)`,
    [uniqueKey(key), name, "", icon, rows[0].mx + 1]
  );
}

export async function renameCategory(id, name) {
  const d = await getDb();
  await d.execute(`UPDATE categories SET name = $1 WHERE id = $2`, [name, id]);
}

export async function setCategoryDescription(id, description) {
  const d = await getDb();
  await d.execute(`UPDATE categories SET description = $1 WHERE id = $2`, [description, id]);
}

export async function setCategoryActive(id, active) {
  const d = await getDb();
  await d.execute(`UPDATE categories SET active = $1 WHERE id = $2`, [active ? 1 : 0, id]);
}

export async function swapCategoryOrder(idA, idB) {
  const d = await getDb();
  const rows = await d.select(
    `SELECT id, sort_order FROM categories WHERE id IN ($1, $2)`,
    [idA, idB]
  );
  if (rows.length !== 2) return;
  const [a, b] = rows;
  await d.execute(`UPDATE categories SET sort_order = $1 WHERE id = $2`, [b.sort_order, a.id]);
  await d.execute(`UPDATE categories SET sort_order = $1 WHERE id = $2`, [a.sort_order, b.id]);
}

export async function addMetric(categoryId, label) {
  const d = await getDb();
  const rows = await d.select(
    `SELECT COALESCE(MAX(sort_order), 0) AS mx FROM metrics WHERE category_id = $1`,
    [categoryId]
  );
  await d.execute(
    `INSERT INTO metrics (category_id, label, sort_order, active) VALUES ($1,$2,$3,1)`,
    [categoryId, label, rows[0].mx + 1]
  );
}

export async function renameMetric(id, label) {
  const d = await getDb();
  await d.execute(`UPDATE metrics SET label = $1 WHERE id = $2`, [label, id]);
}

export async function setMetricActive(id, active) {
  const d = await getDb();
  await d.execute(`UPDATE metrics SET active = $1 WHERE id = $2`, [active ? 1 : 0, id]);
}

export async function swapMetricOrder(idA, idB) {
  const d = await getDb();
  const rows = await d.select(
    `SELECT id, sort_order FROM metrics WHERE id IN ($1, $2)`,
    [idA, idB]
  );
  if (rows.length !== 2) return;
  const [a, b] = rows;
  await d.execute(`UPDATE metrics SET sort_order = $1 WHERE id = $2`, [b.sort_order, a.id]);
  await d.execute(`UPDATE metrics SET sort_order = $1 WHERE id = $2`, [a.sort_order, b.id]);
}

// Hard delete is only offered when a metric has never been scored.
export async function metricHasScores(id) {
  const d = await getDb();
  const rows = await d.select(
    `SELECT COUNT(*) AS n FROM scores WHERE metric_id = $1`,
    [id]
  );
  return rows[0].n > 0;
}

export async function deleteMetric(id) {
  const d = await getDb();
  await d.execute(`DELETE FROM metrics WHERE id = $1`, [id]);
}

export async function categoryHasScores(id) {
  const d = await getDb();
  const rows = await d.select(
    `SELECT COUNT(*) AS n
     FROM scores s JOIN metrics m ON m.id = s.metric_id
     WHERE m.category_id = $1`,
    [id]
  );
  return rows[0].n > 0;
}

export async function deleteCategory(id) {
  const d = await getDb();
  await d.execute(`DELETE FROM metrics WHERE category_id = $1`, [id]);
  await d.execute(`DELETE FROM categories WHERE id = $1`, [id]);
}

/* ---------- helpers ---------- */

function slugify(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "category";
}

// Keys only need to be unique; suffix with timestamp to avoid collisions
// without an extra round trip.
function uniqueKey(base) {
  return `${base}-${Date.now().toString(36)}`;
}
