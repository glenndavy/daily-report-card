# SMB Report Card

SMB-style daily trading report card as a Tauri 2 desktop app backed by a local
SQLite database. Port of the single-file HTML prototype, plus a **Setup** tab
for editing the grading categories and metrics.

## Stack

- **Tauri 2** — system webview, ~10 MB binary
- **tauri-plugin-sql (sqlite)** — DB access from the frontend; schema owned by
  Rust-side migrations in `src-tauri/migrations/`
- **Vite + Tailwind v4** — prototype's design tokens preserved in
  `src/styles.css` `@theme`
- **Chart.js**, **lucide**, **@fontsource/inter** — all bundled, no CDNs, fully
  offline

## Running it

### NixOS

```sh
nix develop        # or direnv with `use flake`
npm install
npm run tauri dev  # dev with hot reload
npm run tauri build
```

### Other Linux / macOS

Install Rust, Node 20+, and the [Tauri v2 prerequisites]
(https://v2.tauri.app/start/prerequisites/) for your platform, then the same
npm commands.

## Where the data lives

`report_card.db` is created in Tauri's app-data directory. On Linux:

```
~/.local/share/nz.glenn.smb-report-card/report_card.db
```

It's a plain SQLite file — inspect it with `sqlite3`, back it up with `cp`, or
sync it however you like. The in-app **Export backup** button also writes a
full JSON dump.

## Schema

```
categories (id, key, name, description, icon, sort_order, active)
metrics    (id, category_id, label, sort_order, active)
report_cards (id, date UNIQUE, session fields…, trade counts…, notes…)
scores     (id, report_card_id, metric_id, value 1–10, UNIQUE(card, metric))
weekly_notes (id, week_start UNIQUE, reflection)
```

Scores reference metric IDs, so editing the metric set never rewrites history:

- **Retire** (eye-off) hides a metric/category from new entries; old entries
  keep their scores. Retired *categories* are also excluded from weekly
  composites so the grid always matches the current column set.
- **Delete** is only allowed when a metric/category has never been scored.
- **Rename** applies everywhere, including past entries (it's the same row).

## Importing data from the HTML prototype

Use **Import backup** and pick a JSON file exported by the prototype's
"Export Backup" button (the `smb-day-*` / `smb-week-*` localStorage dump).
Slider values are mapped by position onto the seeded metric set, so **import
before customising metrics** — if you've already added/removed metrics the
positional mapping may not line up.

Native backups (exported from this app) fully replace the database on import.

## Known limitations / notes

- Editing metrics in Setup re-renders the Daily tab; unsaved slider positions
  reset. Save the day first.
- `window.print()` support varies with WebKitGTK versions; if Print/Export does
  nothing on Linux, export the backup JSON instead (or we can add a proper PDF
  export later).
- Reordering uses up/down buttons rather than drag-and-drop — deliberate, it's
  simpler and keyboard-friendly.
- The Rust side was written against tauri 2 / tauri-plugin-sql 2 but has not
  been compile-checked in the environment this project was generated in; if
  `cargo` complains about plugin API drift, the fixes should be mechanical.
