const path = require('path');
const { app, Tray, Menu, nativeImage } = require('electron');
const timer = require('./timer');
const windows = require('./windows');

let tray = null;
const icons = {};
let getTaskInfoFn = async () => null;
let refreshIntervalId = null;

function loadIcons() {
  const dir = path.join(__dirname, '..', 'assets');
  for (const k of ['idle', 'running', 'paused']) {
    const img = nativeImage.createFromPath(path.join(dir, `tray-${k}.png`));
    icons[k] = img && !img.isEmpty() ? img : nativeImage.createEmpty();
  }
}

function formatElapsed(seconds) {
  const s = Math.max(0, Number(seconds) || 0);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function buildMenu(state, info, onQuit) {
  const isActive = state.status !== 'IDLE';
  const items = [];
  if (isActive && info) {
    const verb = state.status === 'PAUSED' ? 'Paused' : 'Running';
    items.push({
      label: `${verb}: ${info.client} — ${info.task} (${formatElapsed(state.elapsedSeconds)})`,
      enabled: false,
    });
  } else {
    items.push({ label: 'TimeClock — Idle', enabled: false });
  }
  items.push({ type: 'separator' });
  items.push({ label: 'Show Panel', click: () => windows.showPanel() });
  items.push({ label: 'Open Manager', click: () => windows.showManager() });
  if (isActive) {
    items.push({ type: 'separator' });
    if (state.status === 'RUNNING') {
      items.push({ label: 'Pause', click: () => { try { timer.pause(); } catch (e) { console.error(e); } } });
    } else if (state.status === 'PAUSED') {
      items.push({ label: 'Resume', click: () => { try { timer.resume(); } catch (e) { console.error(e); } } });
    }
    items.push({
      label: 'Stop Timer',
      click: () => { try { timer.stop(); } catch (e) { console.error(e); } },
    });
  }
  items.push({ type: 'separator' });
  items.push({
    label: 'Start on Login',
    type: 'checkbox',
    checked: app.getLoginItemSettings().openAtLogin,
    click: (item) => {
      app.setLoginItemSettings({ openAtLogin: item.checked });
    },
  });
  items.push({ type: 'separator' });
  items.push({ label: 'Quit', click: onQuit || (() => app.quit()) });
  return Menu.buildFromTemplate(items);
}

async function refresh() {
  if (!tray || tray.isDestroyed()) return;
  const state = timer.getState();
  const key = state.status === 'RUNNING' ? 'running' : state.status === 'PAUSED' ? 'paused' : 'idle';
  if (icons[key] && !icons[key].isEmpty()) tray.setImage(icons[key]);

  let info = null;
  try { info = await getTaskInfoFn(state); } catch (err) { console.error('[tray] getTaskInfo', err); }

  let tip = 'TimeClock — Idle';
  if (state.status !== 'IDLE' && info) {
    const verb = state.status === 'PAUSED' ? 'Paused' : 'Running';
    tip = `${verb}: ${info.client} — ${info.task} (${formatElapsed(state.elapsedSeconds)})`;
  }
  tray.setToolTip(tip);
  tray.setContextMenu(buildMenu(state, info));
}

function create({ getTaskInfo }) {
  loadIcons();
  if (getTaskInfo) getTaskInfoFn = getTaskInfo;

  const initial = icons.idle && !icons.idle.isEmpty() ? icons.idle : nativeImage.createEmpty();
  tray = new Tray(initial);
  tray.setToolTip('TimeClock');
  tray.on('click', () => windows.togglePanel());
  tray.on('right-click', () => {
    if (tray && !tray.isDestroyed()) tray.popUpContextMenu();
  });
  refresh();

  // refresh tooltip periodically so elapsed in the tooltip stays current
  refreshIntervalId = setInterval(refresh, 30000);
  return tray;
}

function destroy() {
  if (refreshIntervalId) {
    clearInterval(refreshIntervalId);
    refreshIntervalId = null;
  }
  if (tray && !tray.isDestroyed()) {
    tray.destroy();
  }
  tray = null;
}

module.exports = { create, refresh, destroy };
