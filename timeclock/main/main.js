const path = require('path');
const { app, BrowserWindow } = require('electron');
const db = require('./db');
const timer = require('./timer');
const powerEvents = require('./powerEvents');
const ipc = require('./ipc');

const isDev = process.argv.includes('--dev') || !app.isPackaged;
let store = null;
let devWindow = null;
let isQuitting = false;

async function loadStore() {
  // electron-store v8 is CJS; v10 is ESM-only. Support both via dynamic import fallback.
  try {
    const Store = require('electron-store');
    return new Store();
  } catch (err) {
    const mod = await import('electron-store');
    const Store = mod.default;
    return new Store();
  }
}

function createDevWindow() {
  // Phase 1 only: a small dev window so you can verify IPC via DevTools.
  // Phase 2 will add floating button / panel windows and remove this.
  devWindow = new BrowserWindow({
    width: 520,
    height: 360,
    title: 'TimeClock — Phase 1 (dev)',
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });
  devWindow.loadFile(path.join(__dirname, '..', 'dev', 'index.html'));
  if (isDev) devWindow.webContents.openDevTools({ mode: 'detach' });
  devWindow.on('closed', () => { devWindow = null; });
}

async function start() {
  store = await loadStore();
  db.init(app.getPath('userData'));
  ipc.register({ store });
  powerEvents.register();
  timer.restoreFromDb();
  createDevWindow();
}

app.whenReady().then(() => {
  start().catch((err) => {
    console.error('[main] startup failed', err);
    app.exit(1);
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0 && !isQuitting) createDevWindow();
  });
});

// Keep app alive when all windows are closed (tray-style background app).
// Phase 2 will add the tray; for now this prevents auto-quit on macOS/Linux.
app.on('window-all-closed', () => {
  // Intentionally do nothing on Windows/Linux/macOS — Phase 2 adds tray.
  // For Phase 1 development convenience, quit if dev window is closed.
  if (isDev) app.quit();
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
  try { db.close(); } catch (err) { console.error('[main] db.close failed', err); }
});
