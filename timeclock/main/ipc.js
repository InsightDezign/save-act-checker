const { ipcMain, BrowserWindow } = require('electron');
const db = require('./db');
const timer = require('./timer');
const powerEvents = require('./powerEvents');

let storeRef = null;

function broadcast(channel, payload) {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send(channel, payload);
  }
}

function safe(fn) {
  return async (_event, ...args) => {
    try {
      return { ok: true, value: await fn(...args) };
    } catch (err) {
      console.error('[ipc] handler failed', err);
      return { ok: false, error: err.message || String(err) };
    }
  };
}

function register({ store }) {
  storeRef = store;

  // Timer
  ipcMain.handle('timer:start', safe((taskId) => timer.start(taskId)));
  ipcMain.handle('timer:stop', safe(() => timer.stop()));
  ipcMain.handle('timer:pause', safe(() => timer.pause()));
  ipcMain.handle('timer:resume', safe(() => timer.resume()));
  ipcMain.handle('timer:getState', safe(() => timer.getState()));

  // Clients
  ipcMain.handle('clients:list', safe(() => db.clients.list()));
  ipcMain.handle('clients:listAll', safe(() => db.clients.listAll()));
  ipcMain.handle('clients:create', safe((name) => db.clients.create(name)));
  ipcMain.handle('clients:update', safe((id, data) => db.clients.update(id, data)));
  ipcMain.handle('clients:deactivate', safe((id) => db.clients.deactivate(id)));

  // Tasks
  ipcMain.handle('tasks:list', safe((clientId) => db.tasks.list(clientId)));
  ipcMain.handle('tasks:listAll', safe((clientId) => db.tasks.listAll(clientId)));
  ipcMain.handle('tasks:create', safe((clientId, name) => db.tasks.create(clientId, name)));
  ipcMain.handle('tasks:update', safe((id, data) => db.tasks.update(id, data)));
  ipcMain.handle('tasks:deactivate', safe((id) => db.tasks.deactivate(id)));

  // Entries
  ipcMain.handle('entries:list', safe((filters) => db.entries.list(filters || {})));
  ipcMain.handle('entries:updateNotes', safe((id, notes) => db.entries.updateNotes(id, notes)));

  // App
  ipcMain.handle('app:showPanel', safe(() => {
    broadcast('app:request-show-panel');
    return true;
  }));
  ipcMain.handle('app:hidePanel', safe(() => {
    broadcast('app:request-hide-panel');
    return true;
  }));
  ipcMain.handle('app:showManager', safe(() => {
    broadcast('app:request-show-manager');
    return true;
  }));
  ipcMain.handle('app:getLastUsed', safe(() => {
    if (!storeRef) return { clientId: null, taskId: null };
    return storeRef.get('lastUsed', { clientId: null, taskId: null });
  }));
  ipcMain.handle('app:setLastUsed', safe((value) => {
    if (storeRef) storeRef.set('lastUsed', value || { clientId: null, taskId: null });
    return true;
  }));

  // Wire timer state changes → all renderers
  timer.onChange((s) => broadcast('timer:state-changed', s));

  // Wire power events → all renderers
  powerEvents.onEvent((name, payload) => {
    broadcast('power:event', { name, ...payload });
    if (name === 'unlock-screen' || name === 'resume') {
      broadcast('app:request-show-panel');
    }
  });
}

module.exports = { register, broadcast };
