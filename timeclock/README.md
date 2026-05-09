# TimeClock

Lightweight Electron-based Windows desktop time tracker. Tracks billable
work time by client and task with start / pause / resume / stop, persists
to local SQLite, auto-pauses on screen lock, and lives as a floating
button plus a system tray icon.

## Status

Phases 1–4 of the build plan are implemented:

- **Phase 1 — Core**
  SQLite schema + CRUD, timer state machine (IDLE/RUNNING/PAUSED), screen
  lock + suspend auto-pause, IPC handlers, `contextBridge` API, app
  lifecycle with single-instance lock and crash-restore from open entries.
- **Phase 2 — UI**
  Floating button (frameless, transparent, draggable; gray/green-pulse/yellow
  states; right-click context menu). Status panel (idle / running / paused
  views, anchored next to the floating button, hides on blur). System tray
  (state-aware icon + tooltip + context menu with quick pause/stop and a
  Start-on-Login toggle).
- **Phase 3 — Manager**
  Manager window with four tabs: **Log** (filterable entry list with
  inline notes editing and totals), **Clients** (add / rename / deactivate /
  reactivate, optional show-inactive), **Tasks** (per-client, same actions),
  **Settings** (Start-on-Login toggle).
- **Phase 4 — Polish**
  Last-used client/task pre-selected in the panel, live elapsed ticker,
  confirmation dialog before stopping a timer that's been running over an
  hour, single-instance lock so re-launching just shows the panel,
  graceful clean stop on quit.

Phase 5 — WHMCS sync — is **not** in this build. The placeholder
`whmcs_client_id` / `whmcs_task_id` / `synced` columns are already in the
schema for it.

## Run it

```bash
cd timeclock
npm install        # postinstall rebuilds better-sqlite3 against Electron
npm run dev        # opens the floating button + tray; --dev opens DevTools
# or
npm start          # production-style launch
```

Re-launching the app while it's already running just brings the panel
forward (single-instance lock).

`better-sqlite3` ABI mismatch (rare):

```bash
npm run rebuild
```

## How it looks

- A small circular floating button sits in the bottom-right of your screen.
  Drag it anywhere — its position is remembered. Left-click toggles the
  status panel. Right-click opens a context menu (Show Panel, Open
  Manager, Hide, Quit).
- Click the tray icon for the same panel toggle. Right-click the tray
  icon for the full context menu.
- The panel either lets you pick a client + task and start, or shows the
  running entry with pause/resume/stop. Last-used selection is
  pre-filled the next time you go IDLE.
- Lock your screen (Win+L) → the running timer auto-pauses, and unlock
  brings the panel back so you can resume or stop.

## Architecture

```
main/
  main.js          app lifecycle, single-instance lock, wiring
  windows.js       floating + panel + manager creation, panel anchor logic
  tray.js          state-aware tray icon + tooltip + context menu
  db.js            better-sqlite3 schema + CRUD (clients, tasks, entries, pauses)
  timer.js         in-memory state machine; restoreFromDb on startup
  powerEvents.js   powerMonitor lock/unlock + suspend/resume auto-pause
  ipc.js           ipcMain handlers (timer, clients, tasks, entries, app, drag)
preload/
  preload.js       contextBridge exposing window.timeclock with allowlisted events
renderer/
  floating/        floating button window
  panel/           status panel (idle/running/paused views)
  manager/         manager window (Log, Clients, Tasks, Settings)
assets/
  *.png            placeholder icons (replace with .ico for Windows tray)
```

- **All DB access is in main**; renderers go through IPC only.
- **Elapsed time is always recomputed from timestamps** —
  `(now - started_at) - paused_seconds`. Nothing depends on a counter, so
  the timer survives crashes and restarts.
- On startup, `timer.restoreFromDb()` looks for an open `time_entries`
  row (no `stopped_at`) and resumes it. If a `pause_events` row for that
  entry has no `resumed_at`, the timer comes back as PAUSED.
- The tray keeps the app alive when all windows are closed.
- Panel hides on blur (clicking outside dismisses it).

## Icons

`assets/*.png` are placeholder colored circles (idle gray, running green,
paused yellow, app blue). Replace with proper `.ico` files before
production-building for crisp Windows tray rendering. The
`electron-builder.yml` references `assets/icon.ico` for the installer
icon — drop that file in before `npm run dist`.

## Build the installer

```bash
npm run dist       # NSIS installer in dist/
```

The installer goes to `%APPDATA%\TimeClock` (per-user, no admin needed).
The SQLite database lives next to it at
`%APPDATA%\TimeClock\timeclock.db`.

## Future — Phase 5 (WHMCS)

- WHMCS API credentials in Settings
- Pull clients + tasks from WHMCS
- Push completed time entries as project task time logs
- Mark entries `synced = 1`
