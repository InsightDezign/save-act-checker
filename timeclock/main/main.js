const { app, BrowserWindow } = require('electron');
const db = require('./db');
const timer = require('./timer');
const powerEvents = require('./powerEvents');
const ipc = require('./ipc');
const windows = require('./windows');
const tray = require('./tray');

const isDev = process.argv.includes('--dev') || !app.isPackaged;
const startMinimized = process.argv.includes('--minimized');

let store = null;
let isQuitting = false;

async function loadStore() {
  // electron-store v8 is CJS; v10 is ESM-only. Support both.
  try {
    const Store = require('electron-store');
    return new Store();
  } catch (err) {
    const mod = await import('electron-store');
    const Store = mod.default;
    return new Store();
  }
}

async function getTaskInfo(state) {
  if (!state || state.status === 'IDLE' || state.taskId == null) return null;
  const t = db.tasks.get(state.taskId);
  const c = db.clients.get(state.clientId);
  return {
    task: t ? t.name : `task#${state.taskId}`,
    client: c ? c.name : `client#${state.clientId}`,
  };
}

async function start() {
  store = await loadStore();
  db.init(app.getPath('userData'));
  windows.init({ store });
  ipc.register({ store });
  powerEvents.register();
  timer.restoreFromDb();

  windows.createFloating();
  windows.createPanel();
  if (startMinimized) windows.hideFloating();

  tray.create({ getTaskInfo });

  // refresh tray on every timer state change
  timer.onChange(() => { tray.refresh().catch(() => {}); });

  // when power-event auto-pauses, surface the panel so user can decide
  powerEvents.onEvent((name) => {
    if (name === 'unlock-screen' || name === 'resume') {
      windows.showPanel();
    }
  });

  if (isDev) {
    const fl = windows.getFloating();
    if (fl) fl.webContents.openDevTools({ mode: 'detach' });
  }
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    windows.showFloating();
    windows.showPanel();
  });

  app.whenReady().then(() => {
    start().catch((err) => {
      console.error('[main] startup failed', err);
      app.exit(1);
    });

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0 && !isQuitting) {
        windows.createFloating();
        windows.createPanel();
      } else {
        windows.showFloating();
      }
    });
  });
}

// Tray keeps the app alive when all windows are closed
app.on('window-all-closed', () => {
  // intentional no-op
});

app.on('before-quit', () => {
  isQuitting = true;
  try {
    if (timer.getState().status !== timer.STATES.IDLE) {
      timer.stop();
    }
  } catch (err) {
    console.error('[main] before-quit timer.stop failed', err);
  }
  try { tray.destroy(); } catch (err) { console.error('[main] tray.destroy failed', err); }
  try { db.close(); } catch (err) { console.error('[main] db.close failed', err); }
});
