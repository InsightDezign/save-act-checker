const $ = (id) => document.getElementById(id);

const els = {
  pill:        $('status-pill'),
  managerBtn:  $('manager-btn'),
  // idle view
  idleView:    $('view-idle'),
  clientSel:   $('client-select'),
  taskSel:     $('task-select'),
  emptyHint:   $('empty-hint'),
  startBtn:    $('start-btn'),
  dismissIdle: $('dismiss-idle'),
  // active view
  activeView:  $('view-active'),
  activeClient:$('active-client'),
  activeTask:  $('active-task'),
  elapsed:     $('elapsed'),
  pauseBtn:    $('pause-btn'),
  resumeBtn:   $('resume-btn'),
  stopBtn:     $('stop-btn'),
  dismissActive: $('dismiss-active'),
};

let currentState = { status: 'IDLE', elapsedSeconds: 0 };
let clientsCache = [];
let tasksByClient = new Map();
let elapsedTickerId = null;

function pad(n) { return n < 10 ? `0${n}` : `${n}`; }
function formatHMS(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  return `${pad(h)}:${pad(m)}:${pad(r)}`;
}

function setPill(status) {
  els.pill.textContent = status;
  els.pill.className = `pill ${status.toLowerCase()}`;
}

function showView(name) {
  els.idleView.classList.toggle('hidden', name !== 'idle');
  els.activeView.classList.toggle('hidden', name !== 'active');
}

function updateStartEnabled() {
  els.startBtn.disabled = !(els.clientSel.value && els.taskSel.value);
}

async function loadClients() {
  clientsCache = await window.timeclock.clients.list();
  els.clientSel.innerHTML = '';
  if (!clientsCache.length) {
    els.emptyHint.classList.remove('hidden');
    els.clientSel.disabled = true;
    els.taskSel.disabled = true;
    updateStartEnabled();
    return;
  }
  els.emptyHint.classList.add('hidden');
  els.clientSel.disabled = false;

  const placeholder = new Option('Select client…', '');
  placeholder.disabled = true;
  placeholder.hidden = true;
  els.clientSel.add(placeholder);

  for (const c of clientsCache) {
    els.clientSel.add(new Option(c.name, String(c.id)));
  }
}

async function loadTasksFor(clientId) {
  els.taskSel.innerHTML = '';
  if (!clientId) {
    els.taskSel.disabled = true;
    updateStartEnabled();
    return;
  }
  let tasks = tasksByClient.get(clientId);
  if (!tasks) {
    tasks = await window.timeclock.tasks.list(clientId);
    tasksByClient.set(clientId, tasks);
  }
  els.taskSel.disabled = !tasks.length;
  if (!tasks.length) {
    els.taskSel.add(new Option('No tasks for this client', ''));
    updateStartEnabled();
    return;
  }
  const placeholder = new Option('Select task…', '');
  placeholder.disabled = true;
  placeholder.hidden = true;
  els.taskSel.add(placeholder);
  for (const t of tasks) {
    els.taskSel.add(new Option(t.name, String(t.id)));
  }
  updateStartEnabled();
}

async function applyLastUsed() {
  try {
    const last = await window.timeclock.app.getLastUsed();
    if (!last || last.clientId == null) return;
    const cId = String(last.clientId);
    if ([...els.clientSel.options].some((o) => o.value === cId)) {
      els.clientSel.value = cId;
      await loadTasksFor(Number(cId));
      const tId = String(last.taskId || '');
      if ([...els.taskSel.options].some((o) => o.value === tId)) {
        els.taskSel.value = tId;
      }
    }
    updateStartEnabled();
  } catch (err) { console.error('[panel] applyLastUsed', err); }
}

async function renderForState(state) {
  currentState = state || { status: 'IDLE', elapsedSeconds: 0 };
  setPill(currentState.status);

  if (currentState.status === 'IDLE') {
    showView('idle');
    stopElapsedTicker();
    els.elapsed.textContent = formatHMS(0);
    // refresh dropdowns in case clients/tasks were edited in manager
    tasksByClient.clear();
    await loadClients();
    await applyLastUsed();
    return;
  }

  // RUNNING or PAUSED
  showView('active');
  els.pauseBtn.classList.toggle('hidden', currentState.status !== 'RUNNING');
  els.resumeBtn.classList.toggle('hidden', currentState.status !== 'PAUSED');

  // populate client/task names
  try {
    const [client, task] = await Promise.all([
      currentState.clientId != null ? findClient(currentState.clientId) : null,
      currentState.taskId != null ? findTask(currentState.clientId, currentState.taskId) : null,
    ]);
    els.activeClient.textContent = client ? client.name : '—';
    els.activeTask.textContent   = task ? task.name : '—';
  } catch (err) { console.error('[panel] active labels', err); }

  els.elapsed.textContent = formatHMS(currentState.elapsedSeconds || 0);
  if (currentState.status === 'RUNNING') startElapsedTicker();
  else stopElapsedTicker();
}

async function findClient(id) {
  if (!clientsCache.length) clientsCache = await window.timeclock.clients.listAll();
  return clientsCache.find((c) => c.id === id) || null;
}
async function findTask(clientId, taskId) {
  let tasks = tasksByClient.get(clientId);
  if (!tasks) {
    tasks = await window.timeclock.tasks.listAll(clientId);
    tasksByClient.set(clientId, tasks);
  }
  return tasks.find((t) => t.id === taskId) || null;
}

function startElapsedTicker() {
  stopElapsedTicker();
  elapsedTickerId = setInterval(async () => {
    try {
      const s = await window.timeclock.timer.getState();
      currentState = s;
      els.elapsed.textContent = formatHMS(s.elapsedSeconds || 0);
    } catch (err) { /* ignore */ }
  }, 1000);
}
function stopElapsedTicker() {
  if (elapsedTickerId) { clearInterval(elapsedTickerId); elapsedTickerId = null; }
}

// ---------- events ----------
els.clientSel.addEventListener('change', () => {
  const id = els.clientSel.value ? Number(els.clientSel.value) : null;
  loadTasksFor(id);
});
els.taskSel.addEventListener('change', updateStartEnabled);

els.startBtn.addEventListener('click', async () => {
  const taskId = Number(els.taskSel.value);
  if (!taskId) return;
  try { await window.timeclock.timer.start(taskId); }
  catch (err) { alert(`Could not start: ${err.message}`); }
});

els.pauseBtn.addEventListener('click', async () => {
  try { await window.timeclock.timer.pause(); }
  catch (err) { alert(`Could not pause: ${err.message}`); }
});
els.resumeBtn.addEventListener('click', async () => {
  try { await window.timeclock.timer.resume(); }
  catch (err) { alert(`Could not resume: ${err.message}`); }
});
els.stopBtn.addEventListener('click', async () => {
  try {
    const result = await window.timeclock.timer.stop();
    if (result && result.cancelled) return;
  } catch (err) { alert(`Could not stop: ${err.message}`); }
});

els.dismissIdle.addEventListener('click', () => window.timeclock.app.hidePanel());
els.dismissActive.addEventListener('click', () => window.timeclock.app.hidePanel());
els.managerBtn.addEventListener('click', () => window.timeclock.app.showManager());

window.timeclock.on('timer:state-changed', renderForState);

(async function init() {
  try {
    const s = await window.timeclock.timer.getState();
    await renderForState(s);
  } catch (err) {
    console.error('[panel] init', err);
    await renderForState({ status: 'IDLE', elapsedSeconds: 0 });
  }
})();
