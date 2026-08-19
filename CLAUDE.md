# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

SMB-style daily trading report card — a Tauri 2 desktop app with a local SQLite database. Port of a single-file HTML prototype. Fully offline: all assets (Chart.js, lucide, Inter font) are bundled, no CDNs.

`/Users/glenn/w` is a convenience symlink to `/Users/glenn/wrk` — `…/w/smb-report-card` and `…/wrk/smb-report-card` are the same directory, not two copies.

## Commands

```sh
nix develop          # dev shell (NixOS; or direnv with `use flake`) — elsewhere install Rust, Node 20+, Tauri v2 prereqs
npm install
npm run tauri dev    # full app with hot reload (runs `npm run dev` + Rust side)
npm run tauri build  # production build
npm run dev          # Vite only — frontend loads but DB calls fail outside Tauri
```

There are no tests and no linter configured. Vite dev server must be on port 1420 (strictPort — Tauri expects it).

The flake's dev shell only targets Linux; on this Mac use an ad-hoc shell for node (`nix shell nixpkgs#nodejs_22 -c npm …`). CI (`.github/workflows/build.yml`) builds bundles for macOS (arm64 + x64), Linux (x64 + arm64), and Windows on every push to master. Platform icons in `src-tauri/icons/` were generated with `npx tauri icon src-tauri/icons/icon.png` — rerun that after changing the source icon.

## Architecture

Two layers, joined only by `tauri-plugin-sql`:

- **Rust side (`src-tauri/`)** — minimal: `lib.rs` just registers the sql/dialog/fs plugins and the migrations. **The schema is owned by Rust-side migrations** in `src-tauri/migrations/` (`001_initial.sql`, `002_seed.sql`), compiled in via `include_str!`. Schema changes mean a **new numbered migration file** added to the `migrations` vec in `lib.rs` — never edit an existing migration: tauri-plugin-sql records applied versions per database, so edits to an already-applied file are silently skipped on every existing install.
- **Frontend (`src/`, vanilla JS, no framework)** — all logic. `db.js` is the sole data-access layer (raw SQL via `Database.load("sqlite:report_card.db")`); no other module runs SQL (one small exception in `settings.js` for icon updates). Tab modules (`daily.js`, `weekly.js`, `settings.js`, `backup.js`) build DOM into static skeletons defined in `index.html` — all markup for the tabs lives in `index.html`; JS fills in the dynamic sections.

`main.js` boots everything and owns the config-propagation flow: Settings/Backup mutations call a `reloadActiveConfig()` callback which pushes fresh config into Daily and Weekly. Editing metrics re-renders the Daily tab, so **unsaved slider positions reset** — a known, accepted limitation.

### Key domain invariant

Scores reference metric IDs so editing the metric set never rewrites history:

- **Retire** (active=0) hides a metric/category from new entries; old scores are kept. Retired *categories* are also excluded from daily/weekly composites (`getDaySummary` filters `c.active = 1`) so the weekly grid always matches the current column set.
- **Delete** is only allowed when never scored (`metricHasScores`/`categoryHasScores` guard).
- **Rename** applies everywhere including past entries (same row).

Preserve this when touching anything in `db.js`, settings, or backup import.

### Conventions

- Dates are local-timezone `YYYY-MM-DD` strings; **never use `toISOString()` for calendar dates** — use `ymd()` from `ui.js` (NZ is UTC+12/+13, so toISOString shifts the date most of the day). Weeks start Monday (`getMonday()`), Mon–Fri only.
- Always `escapeHtml()` user-supplied strings interpolated into `innerHTML` (category names, metric labels, descriptions).
- After inserting elements with `<i data-lucide="...">`, call `refreshIcons()`; new icons must also be imported and added to the `ICONS` map in `ui.js` (lucide is tree-shaken, only listed icons render).
- Save/upsert pattern: `INSERT ... ON CONFLICT(date) DO UPDATE`, then delete + re-insert scores for that card.
- Styling: Tailwind v4 with prototype design tokens in `src/styles.css` `@theme` (`base-*`, `txt-*`, `pos-*` colors); score/grade color bands come from `getScoreColor()`/`getGradeInfo()` in `ui.js`.

### Backup formats (`backup.js`)

Two import paths: **native** (`{app: "smb-report-card", format: 1}`) wipes and fully replaces the DB, preserving IDs; **legacy** (HTML-prototype localStorage dump with `smb-day-*`/`smb-week-*` keys) merges, mapping slider arrays positionally onto metrics by `(category key, sort_order)` — only correct against the unedited seed set.

## Notes

- `report_card.db` lives in Tauri's app-data dir (Linux: `~/.local/share/nz.glenn.smb-report-card/`).
- Reordering uses up/down buttons, not drag-and-drop — deliberate (simpler, keyboard-friendly).
