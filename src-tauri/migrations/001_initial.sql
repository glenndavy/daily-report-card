-- Schema for SMB daily report card.
-- Categories group metrics; scores reference metrics so edits to the metric
-- set never orphan or rewrite historical grades.

CREATE TABLE categories (
  id          INTEGER PRIMARY KEY,
  key         TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  description TEXT,
  icon        TEXT,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  active      INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE metrics (
  id          INTEGER PRIMARY KEY,
  category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  label       TEXT NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  active      INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE report_cards (
  id             INTEGER PRIMARY KEY,
  date           TEXT NOT NULL UNIQUE,   -- YYYY-MM-DD, local trading date
  session_type   TEXT,
  session_start  TEXT,                   -- HH:MM
  session_end    TEXT,                   -- HH:MM
  instruments    TEXT,
  trades_taken   INTEGER NOT NULL DEFAULT 0,
  planned_trades INTEGER NOT NULL DEFAULT 0,
  a_setups       INTEGER NOT NULL DEFAULT 0,
  b_setups       INTEGER NOT NULL DEFAULT 0,
  c_setups       INTEGER NOT NULL DEFAULT 0,
  note_well      TEXT,
  note_improve   TEXT,
  note_lesson    TEXT,
  note_focus     TEXT,
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT
);

CREATE TABLE scores (
  id             INTEGER PRIMARY KEY,
  report_card_id INTEGER NOT NULL REFERENCES report_cards(id) ON DELETE CASCADE,
  metric_id      INTEGER NOT NULL REFERENCES metrics(id),
  value          INTEGER NOT NULL CHECK (value BETWEEN 1 AND 10),
  UNIQUE (report_card_id, metric_id)
);

CREATE TABLE weekly_notes (
  id         INTEGER PRIMARY KEY,
  week_start TEXT NOT NULL UNIQUE,       -- Monday, YYYY-MM-DD
  reflection TEXT
);

CREATE INDEX idx_scores_card   ON scores(report_card_id);
CREATE INDEX idx_scores_metric ON scores(metric_id);
CREATE INDEX idx_metrics_cat   ON metrics(category_id);
