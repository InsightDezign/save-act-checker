const path = require('path');
const { BrowserWindow, screen, Menu, app } = require('electron');

const PRELOAD = path.join(__dirname, '..', 'preload', 'preload.js');
const RENDERER = path.join(__dirname, '..', 'renderer');

const FLOAT_W = 64;
const FLOAT_H = 64;
const PANEL_W = 300;
const PANEL_H = 380;

let floatingWin = null;
let panelWin = null;
let managerWin = null;
let storeRef = null;

function init({ store }) {
  storeRef = store;
}

function defaultFloatingPos() {
  const { workArea } = screen.getPrimaryDisplay();
  return {
    x: workArea.x + workArea.width - FLOAT_W - 16,
    y: workArea.y + workArea.height - FLOAT_H - 56,
  };
}

function clampFloatingPos(pos) {
  const display = screen.getDisplayNearestPoint(pos);
  const { workArea } = display;
  let { x, y } = pos;
  if (x < workArea.x) x = workArea.x;
  if (y < workArea.y) y = workArea.y;
  if (x + FLOAT_W > workArea.x + workArea.width) x = workArea.x + workArea.width - FLOAT_W;
  if (y + FLOAT_H > workArea.y + workArea.height) y = workArea.y + workArea.height - FLOAT_H;
  return { x, y };
}

function createFloating() {
  if (floatingWin) return floatingWin;
  const saved = storeRef && storeRef.get('floatingPosition');
  const pos = clampFloatingPos(
    saved && Number.isFinite(saved.x) && Number.isFinite(saved.y)
      ? saved
      : defaultFloatingPos()
  );

  floatingWin = new BrowserWindow({
    width: FLOAT_W,
    height: FLOAT_H,
    x: pos.x,
    y: pos.y,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    hasShadow: false,
    movable: true,
    focusable: true,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: PRELOAD,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });
  floatingWin.setMenuBarVisibility(false);
  floatingWin.loadFile(path.join(RENDERER, 'floating', 'floating.html'));
  floatingWin.on('closed', () => { floatingWin = null; });
  return floatingWin;
}

function createPanel() {
  if (panelWin) return panelWin;
  panelWin = new BrowserWindow({
    width: PANEL_W,
    height: PANEL_H,
    show: false,
    frame: false,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    backgroundColor: '#1f1f1f',
    webPreferences: {
      preload: PRELOAD,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });
  panelWin.setMenuBarVisibility(false);
  panelWin.loadFile(path.join(RENDERER, 'panel', 'panel.html'));
  panelWin.on('blur', () => {
    // hide panel when it loses focus (clicked outside)
    if (panelWin && !panelWin.isDestroyed()) panelWin.hide();
  });
  panelWin.on('closed', () => { panelWin = null; });
  return panelWin;
}

function showManager() {
  if (managerWin) {
    if (managerWin.isMinimized()) managerWin.restore();
    managerWin.show();
    managerWin.focus();
    return managerWin;
  }
  const saved = (storeRef && storeRef.get('managerBounds')) || {};
  managerWin = new BrowserWindow({
    width: saved.width || 900,
    height: saved.height || 650,
    x: Number.isFinite(saved.x) ? saved.x : undefined,
    y: Number.isFinite(saved.y) ? saved.y : undefined,
    minWidth: 720,
    minHeight: 480,
    title: 'TimeClock — Manager',
    backgroundColor: '#1a1a1a',
    webPreferences: {
      preload: PRELOAD,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });
  managerWin.setMenuBarVisibility(false);
  managerWin.loadFile(path.join(RENDERER, 'manager', 'manager.html'));
  managerWin.on('close', () => {
    if (managerWin && !managerWin.isDestroyed() && storeRef) {
      storeRef.set('managerBounds', managerWin.getBounds());
    }
  });
  managerWin.on('closed', () => { managerWin = null; });
  return managerWin;
}

function positionPanelNearFloating() {
  if (!floatingWin || !panelWin) return;
  const fb = floatingWin.getBounds();
  const pb = panelWin.getBounds();
  const display = screen.getDisplayMatching(fb);
  const wa = display.workArea;

  // default: panel above the floating button, right-aligned to it
  let x = fb.x + fb.width - pb.width;
  let y = fb.y - pb.height - 8;

  // if not enough space above, place below
  if (y < wa.y + 8) y = fb.y + fb.height + 8;

  // clamp horizontally
  if (x < wa.x + 8) x = wa.x + 8;
  if (x + pb.width > wa.x + wa.width - 8) x = wa.x + wa.width - pb.width - 8;
  // clamp vertically
  if (y + pb.height > wa.y + wa.height - 8) y = wa.y + wa.height - pb.height - 8;
  if (y < wa.y + 8) y = wa.y + 8;

  panelWin.setPosition(Math.round(x), Math.round(y));
}

function showPanel() {
  if (!panelWin) createPanel();
  positionPanelNearFloating();
  panelWin.show();
  panelWin.focus();
}

function hidePanel() {
  if (panelWin && !panelWin.isDestroyed()) panelWin.hide();
}

function togglePanel() {
  if (!panelWin) { showPanel(); return; }
  if (panelWin.isVisible()) hidePanel();
  else showPanel();
}

function moveFloatingBy(dx, dy) {
  if (!floatingWin || floatingWin.isDestroyed()) return;
  const [x, y] = floatingWin.getPosition();
  const target = clampFloatingPos({ x: x + dx, y: y + dy });
  floatingWin.setPosition(Math.round(target.x), Math.round(target.y));
}

function persistFloatingPosition() {
  if (!floatingWin || floatingWin.isDestroyed() || !storeRef) return;
  const [x, y] = floatingWin.getPosition();
  storeRef.set('floatingPosition', { x, y });
}

function showFloatingContextMenu({ onShowManager, onHide, onQuit }) {
  if (!floatingWin) return;
  const menu = Menu.buildFromTemplate([
    { label: 'Show Panel', click: showPanel },
    { label: 'Open Manager', click: () => onShowManager && onShowManager() },
    { type: 'separator' },
    { label: 'Hide (minimize to tray)', click: () => onHide && onHide() },
    { type: 'separator' },
    { label: 'Quit TimeClock', click: () => onQuit && onQuit() },
  ]);
  menu.popup({ window: floatingWin });
}

function hideFloating() {
  if (floatingWin && !floatingWin.isDestroyed()) floatingWin.hide();
}

function showFloating() {
  if (floatingWin && !floatingWin.isDestroyed()) floatingWin.show();
  else createFloating();
}

function getFloating() { return floatingWin; }
function getPanel() { return panelWin; }
function getManager() { return managerWin; }

module.exports = {
  init,
  createFloating,
  createPanel,
  showManager,
  showPanel,
  hidePanel,
  togglePanel,
  positionPanelNearFloating,
  moveFloatingBy,
  persistFloatingPosition,
  showFloatingContextMenu,
  hideFloating,
  showFloating,
  getFloating,
  getPanel,
  getManager,
};
