const { ipcMain, app, BrowserWindow, dialog } = require('electron');
const db = require('./db');
const timer = require('./timer');
const powerEvents = require('./powerEvents');
const windows = require('./windows');

let storeRef = null;

const CONFIRM_STOP_AFTER_SECONDS = 60 * 60; // 1 hour

function broadcast(channel, payload) {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send(channel, payload);
  }
}

function safe(fn) {
  return async (event, ...args) => {
    try {
      return { ok: true, value: await fn(event, ...args) };
    } catch (err) {
      console.error('[ipc] handler failed', err);
      return { ok: false, error: err.message || String(err) };
    }
  };
}

function ownerWin(event) {
  const sender = event && event.sender;
  if (!sender) return null;
  const win = BrowserWindow.fromWebContents(sender);
  return win && !win.isDestroyed() ? win : null;
}

function register({ store }) {
  storeRef = store;

  // ---------- Timer ----------
  ipcMain.handle('timer:start', safe(async (event, taskId) => {
    const result = timer.start(taskId);
    // remember last-used client/task
    try {
      const s = timer.getState();
      storeRef.set('lastUsed', { clientId: s.clientId, taskId: s.taskId });
    } catch (err) { /* ignore */ }
    return result;
  }));

  ipcMain.handle('timer:stop', safe(async (event, opts) => {
    const force = opts && opts.force;
    const s = timer.getState();
    if (!force && s.status !== 'IDLE' && s.elapsedSeconds > CONFIRM_STOP_AFTER_SECONDS) {
      const win = ownerWin(event) || windows.getPanel() || windows.getManager() || windows.getFloating();
      const minutes = Math.floor(s.elapsedSeconds / 60);
      const choice = await dialog.showMessageBox(win || undefined, {
        type: 'question',
        title: 'Stop timer?',
        message: 'Stop the running timer?',
        detail: `Elapsed: ${minutes} minutes. This will close the time entry.`,
        buttons: ['Cancel', 'Stop'],
        defaultId: 1,
        cancelId: 0,
      });
      if (choice.response !== 1) {
        return { cancelled: true, state: s };
      }
    }
    return timer.stop();
  }));

  ipcMain.handle('timer:pause', safe(() => timer.pause()));
  ipcMain.handle('timer:resume', safe(() => timer.resume()));
  ipcMain.handle('timer:getState', safe(() => timer.getState()));

  // ---------- Clients ----------
  ipcMain.handle('clients:list', safe(() => db.clients.list()));
  ipcMain.handle('clients:listAll', safe(() => db.clients.listAll()));
  ipcMain.handle('clients:create', safe((event, name) => db.clients.create(name)));
  ipcMain.handle('clients:update', safe((event, id, data) => db.clients.update(id, data)));
  ipcMain.handle('clients:deactivate', safe((event, id) => db.clients.deactivate(id)));

  // ---------- Tasks ----------
  ipcMain.handle('tasks:list', safe((event, clientId) => db.tasks.list(clientId)));
  ipcMain.handle('tasks:listAll', safe((event, clientId) => db.tasks.listAll(clientId)));
  ipcMain.handle('tasks:create', safe((event, clientId, name) => db.tasks.create(clientId, name)));
  ipcMain.handle('tasks:update', safe((event, id, data) => db.tasks.update(id, data)));
  ipcMain.handle('tasks:deactivate', safe((event, id) => db.tasks.deactivate(id)));

  // ---------- Entries ----------
  ipcMain.handle('entries:list', safe((event, filters) => db.entries.list(filters || {})));
  ipcMain.handle('entries:updateNotes', safe((event, id, notes) => db.entries.updateNotes(id, notes)));

  // ---------- App ----------
  ipcMain.handle('app:showPanel', safe(() => { windows.showPanel(); return true; }));
  ipcMain.handle('app:hidePanel', safe(() => { windows.hidePanel(); return true; }));
  ipcMain.handle('app:togglePanel', safe(() => { windows.togglePanel(); return true; }));
  ipcMain.handle('app:showManager', safe(() => { windows.showManager(); return true; }));
  ipcMain.handle('app:hideFloating', safe(() => { windows.hideFloating(); return true; }));
  ipcMain.handle('app:showFloating', safe(() => { windows.showFloating(); return true; }));
  ipcMain.handle('app:quit', safe(() => { app.quit(); return true; }));

  ipcMain.handle('app:getLastUsed', safe(() => storeRef.get('lastUsed', { clientId: null, taskId: null })));
  ipcMain.handle('app:setLastUsed', safe((event, value) => {
    storeRef.set('lastUsed', value || { clientId: null, taskId: null });
    return true;
  }));

  ipcMain.handle('app:getStartOnLogin', safe(() => app.getLoginItemSettings().openAtLogin));
  ipcMain.handle('app:setStartOnLogin', safe((event, enabled) => {
    app.setLoginItemSettings({ openAtLogin: !!enabled, args: ['--minimized'] });
    storeRef.set('startOnLogin', !!enabled);
    return app.getLoginItemSettings().openAtLogin;
  }));

  ipcMain.handle('floating:openContextMenu', safe(() => {
    windows.showFloatingContextMenu({
      onShowManager: () => windows.showManager(),
      onHide: () => windows.hideFloating(),
      onQuit: () => app.quit(),
    });
    return true;
  }));

  // ---------- Floating drag (one-way; no reply) ----------
  ipcMain.on('floating:drag', (event, payload) => {
    const dx = Number(payload && payload.dx) || 0;
    const dy = Number(payload && payload.dy) || 0;
    if (dx === 0 && dy === 0) return;
    windows.moveFloatingBy(dx, dy);
  });
  ipcMain.on('floating:drag-end', () => {
    windows.persistFloatingPosition();
  });

  // ---------- Wire timer + power → renderers ----------
  timer.onChange((s) => broadcast('timer:state-changed', s));
  powerEvents.onEvent((name, payload) => {
    broadcast('power:event', { name, ...payload });
  });
}

module.exports = { register, broadcast };
