const db = require('./db');

const STATES = Object.freeze({ IDLE: 'IDLE', RUNNING: 'RUNNING', PAUSED: 'PAUSED' });

const state = {
  status: STATES.IDLE,
  entryId: null,
  taskId: null,
  clientId: null,
  startedAt: null,        // ISO string
  pausedSeconds: 0,       // accumulated, closed pauses only
  currentPauseId: null,   // id of open pause_event row when PAUSED
  currentPausedAt: null,  // ISO string of in-progress pause start
};

const listeners = new Set();

function onChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emit() {
  const snap = getState();
  for (const fn of listeners) {
    try { fn(snap); } catch (err) { console.error('[timer] listener error', err); }
  }
}

function reset() {
  state.status = STATES.IDLE;
  state.entryId = null;
  state.taskId = null;
  state.clientId = null;
  state.startedAt = null;
  state.pausedSeconds = 0;
  state.currentPauseId = null;
  state.currentPausedAt = null;
}

function getState() {
  return {
    status: state.status,
    entryId: state.entryId,
    taskId: state.taskId,
    clientId: state.clientId,
    startedAt: state.startedAt,
    pausedSeconds: state.pausedSeconds,
    elapsedSeconds: getElapsed(),
  };
}

function getElapsed() {
  if (state.status === STATES.IDLE || !state.startedAt) return 0;
  const startMs = new Date(state.startedAt).getTime();
  const nowMs = Date.now();
  let pausedMs = state.pausedSeconds * 1000;
  if (state.status === STATES.PAUSED && state.currentPausedAt) {
    pausedMs += nowMs - new Date(state.currentPausedAt).getTime();
  }
  const elapsedMs = (nowMs - startMs) - pausedMs;
  return Math.max(0, Math.floor(elapsedMs / 1000));
}

function start(taskId) {
  if (state.status !== STATES.IDLE) {
    throw new Error(`cannot start: timer is ${state.status}`);
  }
  const entry = db.entries.start(taskId);
  state.status = STATES.RUNNING;
  state.entryId = entry.id;
  state.taskId = entry.task_id;
  state.clientId = entry.client_id;
  state.startedAt = entry.started_at;
  state.pausedSeconds = 0;
  state.currentPauseId = null;
  state.currentPausedAt = null;
  emit();
  return getState();
}

function pause() {
  if (state.status !== STATES.RUNNING) {
    throw new Error(`cannot pause: timer is ${state.status}`);
  }
  const ev = db.pauses.open(state.entryId);
  state.currentPauseId = ev.id;
  state.currentPausedAt = ev.paused_at;
  state.status = STATES.PAUSED;
  emit();
  return getState();
}

function resume() {
  if (state.status !== STATES.PAUSED) {
    throw new Error(`cannot resume: timer is ${state.status}`);
  }
  if (state.currentPauseId != null) {
    const ev = db.pauses.close(state.currentPauseId);
    const startedMs = new Date(ev.paused_at).getTime();
    const endedMs = new Date(ev.resumed_at).getTime();
    const seconds = Math.max(0, Math.floor((endedMs - startedMs) / 1000));
    state.pausedSeconds += seconds;
    db.entries.setPausedSeconds(state.entryId, state.pausedSeconds);
  }
  state.currentPauseId = null;
  state.currentPausedAt = null;
  state.status = STATES.RUNNING;
  emit();
  return getState();
}

function stop() {
  if (state.status === STATES.IDLE) {
    throw new Error('cannot stop: timer is IDLE');
  }
  if (state.status === STATES.PAUSED && state.currentPauseId != null) {
    const ev = db.pauses.close(state.currentPauseId);
    const startedMs = new Date(ev.paused_at).getTime();
    const endedMs = new Date(ev.resumed_at).getTime();
    const seconds = Math.max(0, Math.floor((endedMs - startedMs) / 1000));
    state.pausedSeconds += seconds;
  }
  db.entries.setPausedSeconds(state.entryId, state.pausedSeconds);
  const stopped = db.entries.stop(state.entryId);
  reset();
  emit();
  return { stopped, state: getState() };
}

// Restore in-memory state from any open entry on app start
function restoreFromDb() {
  const open = db.entries.findOpen();
  if (!open) {
    reset();
    return getState();
  }
  state.entryId = open.id;
  state.taskId = open.task_id;
  state.clientId = open.client_id;
  state.startedAt = open.started_at;
  // Recompute paused seconds from closed pauses, in case process died mid-run
  state.pausedSeconds = db.pauses.totalSecondsForEntry(open.id);

  const openPause = db.pauses.findOpenForEntry(open.id);
  if (openPause) {
    state.status = STATES.PAUSED;
    state.currentPauseId = openPause.id;
    state.currentPausedAt = openPause.paused_at;
  } else {
    state.status = STATES.RUNNING;
    state.currentPauseId = null;
    state.currentPausedAt = null;
  }
  emit();
  return getState();
}

module.exports = {
  STATES,
  start,
  pause,
  resume,
  stop,
  getState,
  getElapsed,
  restoreFromDb,
  onChange,
};
