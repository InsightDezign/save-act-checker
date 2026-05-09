const btn = document.getElementById('btn');
const icons = {
  IDLE:    document.getElementById('icon-idle'),
  RUNNING: document.getElementById('icon-running'),
  PAUSED:  document.getElementById('icon-paused'),
};

const DRAG_THRESHOLD_PX = 4;

function applyState(state) {
  const status = (state && state.status) || 'IDLE';
  btn.classList.remove('idle', 'running', 'paused');
  btn.classList.add(status.toLowerCase());
  for (const k of Object.keys(icons)) {
    icons[k].classList.toggle('hidden', k !== status);
  }
}

async function refresh() {
  try {
    const s = await window.timeclock.timer.getState();
    applyState(s);
  } catch (err) { console.error('[floating] refresh', err); }
}

window.timeclock.on('timer:state-changed', applyState);
refresh();

// ---------------------- drag + click ----------------------
let dragging = false;
let lastX = 0, lastY = 0;
let totalAbs = 0;

btn.addEventListener('pointerdown', (e) => {
  if (e.button !== 0) return;
  try { btn.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
  dragging = true;
  lastX = e.screenX;
  lastY = e.screenY;
  totalAbs = 0;
  e.preventDefault();
});

btn.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  const dx = e.screenX - lastX;
  const dy = e.screenY - lastY;
  if (dx === 0 && dy === 0) return;
  totalAbs += Math.abs(dx) + Math.abs(dy);
  lastX = e.screenX;
  lastY = e.screenY;
  window.timeclock.floating.drag(dx, dy);
});

function endDrag(e) {
  if (!dragging) return;
  dragging = false;
  try { if (e && e.pointerId != null) btn.releasePointerCapture(e.pointerId); } catch (_) {}
  const wasDrag = totalAbs > DRAG_THRESHOLD_PX;
  window.timeclock.floating.dragEnd();
  if (!wasDrag) {
    window.timeclock.app.togglePanel().catch((err) => console.error(err));
  }
}

btn.addEventListener('pointerup', endDrag);
btn.addEventListener('pointercancel', endDrag);

// right-click → context menu
btn.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  window.timeclock.floating.openContextMenu().catch((err) => console.error(err));
});

// suppress text selection / drag-image
btn.addEventListener('dragstart', (e) => e.preventDefault());
