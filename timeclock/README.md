# TimeClock

Lightweight Electron-based Windows desktop time tracker. Tracks billable work time
by client and task with start / pause / resume / stop, persists to local SQLite,
auto-pauses on screen lock.

## Status — Phase 1 (core)

This pass builds the foundation only:

- SQLite schema + CRUD (`main/db.js`)
- Timer state machine: IDLE / RUNNING / PAUSED (`main/timer.js`)
- Screen lock/unlock + suspend/resume auto-pause (`main/powerEvents.js`)
- IPC handlers (`main/ipc.js`) and `contextBridge` API (`preload/preload.js`)
- App lifecycle (`main/main.js`) with timer-state restore on startup

There is **no real UI yet** — Phase 1 ships a small dev window with a few buttons
plus DevTools so you can poke at `window.timeclock.*`. Phases 2–4 will add the
floating button, status panel, system tray, and manager window.

## Run it

The project lives in this `timeclock/` subdirectory.

```bash
cd timeclock
npm install      # rebuilds better-sqlite3 against Electron via postinstall
npm run dev      # opens the Phase 1 dev window with DevTools
```

If `better-sqlite3` complains about ABI mismatch (rare), force a rebuild:

```bash
npm run rebuild
```

The SQLite file lives in your Electron `userData` folder
(on Windows: `%APPDATA%\TimeClock\timeclock.db`).

## Smoke test

In the dev window:

1. Click **Seed: client + task** — creates one client and one task.
2. Click **Start (last task)** — timer goes RUNNING; elapsed seconds tick up.
3. Click **Pause** / **Resume** — state pill changes; elapsed stops/starts.
4. Click **Stop** — entry's `stopped_at` is filled in.
5. Lock your screen (Win+L) while running — the timer auto-pauses.

Or open DevTools and call directly:

```js
await window.timeclock.clients.create('Acme');
await window.timeclock.tasks.create(1, 'Onboarding');
await window.timeclock.timer.start(1);
await window.timeclock.timer.getState();
await window.timeclock.entries.list({});
```

## Architecture notes

- All DB access is in the main process. Renderers go through IPC only.
- Timer state lives in memory in `timer.js`; persistent truth is the DB
  (`time_entries.started_at` + `pause_events`). Elapsed is always recomputed
  from timestamps, never stored as a counter, so it survives restarts.
- On startup, `timer.restoreFromDb()` looks for an open `time_entries` row
  (no `stopped_at`) and resumes its in-memory state. If a `pause_events` row
  for that entry has no `resumed_at`, the timer comes back as PAUSED.

## Icons

`assets/*.png` are placeholder colored circles (idle = gray, running = green,
paused = yellow, app = blue). Replace with real `.ico` files before
production-building for Windows tray rendering quality.

## Next phases

- Phase 2 — floating button window, status panel, system tray
- Phase 3 — manager window (log, clients, tasks, settings tabs)
- Phase 4 — polish (last-used pre-select, confirm-on-stop, error UX)
- Phase 5 — WHMCS sync (future)
