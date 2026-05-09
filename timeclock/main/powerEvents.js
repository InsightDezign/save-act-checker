const { powerMonitor } = require('electron');
const timer = require('./timer');

let registered = false;
const listeners = new Set();

function onEvent(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emit(name, payload) {
  for (const fn of listeners) {
    try { fn(name, payload); } catch (err) { console.error('[power] listener error', err); }
  }
}

function register() {
  if (registered) return;
  registered = true;

  powerMonitor.on('lock-screen', () => {
    // Auto-pause if running so locked time isn't billed
    try {
      if (timer.getState().status === timer.STATES.RUNNING) {
        timer.pause();
        emit('lock-screen', { autoPaused: true });
        return;
      }
    } catch (err) {
      console.error('[power] lock-screen pause failed', err);
    }
    emit('lock-screen', { autoPaused: false });
  });

  powerMonitor.on('unlock-screen', () => {
    emit('unlock-screen', { state: timer.getState() });
  });

  // Suspend / resume mirror lock/unlock for sleep events
  powerMonitor.on('suspend', () => {
    try {
      if (timer.getState().status === timer.STATES.RUNNING) {
        timer.pause();
        emit('suspend', { autoPaused: true });
        return;
      }
    } catch (err) {
      console.error('[power] suspend pause failed', err);
    }
    emit('suspend', { autoPaused: false });
  });

  powerMonitor.on('resume', () => {
    emit('resume', { state: timer.getState() });
  });
}

module.exports = { register, onEvent };
