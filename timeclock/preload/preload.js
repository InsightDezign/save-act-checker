const { contextBridge, ipcRenderer } = require('electron');

function call(channel, ...args) {
  return ipcRenderer.invoke(channel, ...args).then((res) => {
    if (res && res.ok === false) throw new Error(res.error);
    return res ? res.value : undefined;
  });
}

const ALLOWED_EVENTS = new Set([
  'timer:state-changed',
  'power:event',
  'app:request-show-panel',
  'app:request-hide-panel',
  'app:request-show-manager',
]);

contextBridge.exposeInMainWorld('timeclock', {
  timer: {
    start: (taskId) => call('timer:start', taskId),
    stop: () => call('timer:stop'),
    pause: () => call('timer:pause'),
    resume: () => call('timer:resume'),
    getState: () => call('timer:getState'),
  },
  clients: {
    list: () => call('clients:list'),
    listAll: () => call('clients:listAll'),
    create: (name) => call('clients:create', name),
    update: (id, data) => call('clients:update', id, data),
    deactivate: (id) => call('clients:deactivate', id),
  },
  tasks: {
    list: (clientId) => call('tasks:list', clientId),
    listAll: (clientId) => call('tasks:listAll', clientId),
    create: (clientId, name) => call('tasks:create', clientId, name),
    update: (id, data) => call('tasks:update', id, data),
    deactivate: (id) => call('tasks:deactivate', id),
  },
  entries: {
    list: (filters) => call('entries:list', filters),
    updateNotes: (id, notes) => call('entries:updateNotes', id, notes),
  },
  app: {
    showPanel: () => call('app:showPanel'),
    hidePanel: () => call('app:hidePanel'),
    showManager: () => call('app:showManager'),
    getLastUsed: () => call('app:getLastUsed'),
    setLastUsed: (value) => call('app:setLastUsed', value),
  },
  on(channel, callback) {
    if (!ALLOWED_EVENTS.has(channel)) {
      throw new Error(`channel not allowed: ${channel}`);
    }
    const handler = (_event, payload) => callback(payload);
    ipcRenderer.on(channel, handler);
    return () => ipcRenderer.removeListener(channel, handler);
  },
});
