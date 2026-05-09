const $ = (id) => document.getElementById(id);
const tc = window.timeclock;

// ---------- tabs ----------
const tabs = document.querySelectorAll('.tab');
const pages = document.querySelectorAll('.page');

function activateTab(name) {
  for (const t of tabs) t.classList.toggle('active', t.dataset.tab === name);
  for (const p of pages) p.classList.toggle('active', p.dataset.page === name);
  if (name === 'log') refreshLog();
  if (name === 'clients') refreshClients();
  if (name === 'tasks') refreshTaskClientSelect().then(refreshTasks);
  if (name === 'settings') refreshSettings();
}
tabs.forEach((t) => t.addEventListener('click', () => activateTab(t.dataset.tab)));
activateTab('log');

// ---------- helpers ----------
const escMap = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => escMap[c]); }

function pad(n) { return n < 10 ? `0${n}` : `${n}`; }
function formatDuration(seconds) {
  const s = Math.max(0, Math.floor(seconds || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  if (h > 0) return `${h}h ${pad(m)}m`;
  if (m > 0) return `${m}m ${pad(r)}s`;
  return `${r}s`;
}

function durationOfEntry(e) {
  if (!e.started_at) return 0;
  const startMs = new Date(e.started_at).getTime();
  const endMs = e.stopped_at ? new Date(e.stopped_at).getTime() : Date.now();
  const elapsed = Math.floor((endMs - startMs) / 1000);
  const paused = Number(e.paused_seconds) || 0;
  return Math.max(0, elapsed - paused);
}

function formatDateTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString();
}

// ---------- LOG ----------
const logBody = $('log-body');
const logClientFilter = $('log-client-filter');
const logFrom = $('log-from');
const logTo = $('log-to');

async function refreshLog() {
  const clientId = logClientFilter.value ? Number(logClientFilter.value) : null;
  const filters = {};
  if (clientId) filters.clientId = clientId;
  if (logFrom.value) filters.from = `${logFrom.value}T00:00:00.000Z`;
  if (logTo.value) filters.to = `${logTo.value}T23:59:59.999Z`;
  const entries = await tc.entries.list(filters);

  if (!entries.length) {
    logBody.innerHTML = '<tr><td colspan="6" class="empty">No entries.</td></tr>';
    $('log-summary').textContent = '0 entries';
    return;
  }

  let totalSecs = 0;
  const rows = entries.map((e) => {
    const dur = durationOfEntry(e);
    totalSecs += dur;
    const status = e.stopped_at
      ? `<span class="tag">closed</span>`
      : `<span class="tag open">open</span>`;
    return `
      <tr data-id="${e.id}">
        <td title="${esc(e.started_at)}">${esc(formatDateTime(e.started_at))}</td>
        <td>${esc(e.client_name || '')}</td>
        <td>${esc(e.task_name || '')}</td>
        <td>${esc(formatDuration(dur))}</td>
        <td><input type="text" class="note-input" data-entry-id="${e.id}" value="${esc(e.notes || '')}" placeholder="Add notes…" /></td>
        <td>${status}</td>
      </tr>
    `;
  }).join('');
  logBody.innerHTML = rows;
  $('log-summary').textContent = `${entries.length} entries · ${formatDuration(totalSecs)} total`;
}

logBody.addEventListener('change', async (ev) => {
  const target = ev.target;
  if (!target.classList.contains('note-input')) return;
  const id = Number(target.dataset.entryId);
  try {
    await tc.entries.updateNotes(id, target.value);
    target.style.borderColor = '#16a34a';
    setTimeout(() => { target.style.borderColor = ''; }, 600);
  } catch (err) {
    alert(`Could not save note: ${err.message}`);
  }
});

$('log-refresh').addEventListener('click', refreshLog);
logClientFilter.addEventListener('change', refreshLog);
logFrom.addEventListener('change', refreshLog);
logTo.addEventListener('change', refreshLog);

async function refreshLogClientFilter() {
  const clients = await tc.clients.listAll();
  const prev = logClientFilter.value;
  logClientFilter.innerHTML = '<option value="">All</option>';
  for (const c of clients) {
    logClientFilter.add(new Option(c.name + (c.active ? '' : ' (inactive)'), String(c.id)));
  }
  logClientFilter.value = prev;
}

// ---------- CLIENTS ----------
const clientBody = $('client-body');
const clientNew = $('client-new-name');
const clientShowInactive = $('client-show-inactive');

async function refreshClients() {
  const showInactive = clientShowInactive.checked;
  const clients = showInactive ? await tc.clients.listAll() : await tc.clients.list();
  if (!clients.length) {
    clientBody.innerHTML = '<tr><td colspan="3" class="empty">No clients yet — add one above.</td></tr>';
  } else {
    clientBody.innerHTML = clients.map((c) => `
      <tr data-id="${c.id}" data-active="${c.active}">
        <td><span class="client-name-cell">${esc(c.name)}</span></td>
        <td><span class="tag ${c.active ? 'active' : 'inactive'}">${c.active ? 'active' : 'inactive'}</span></td>
        <td class="actions-cell">
          <button class="ghost" data-act="rename">Rename</button>
          ${c.active
            ? `<button class="danger" data-act="deactivate">Deactivate</button>`
            : `<button data-act="reactivate">Reactivate</button>`
          }
        </td>
      </tr>
    `).join('');
  }
  await refreshLogClientFilter();
  await refreshTaskClientSelect();
}

$('client-add').addEventListener('click', async () => {
  const name = clientNew.value.trim();
  if (!name) return;
  try {
    await tc.clients.create(name);
    clientNew.value = '';
    await refreshClients();
  } catch (err) { alert(`Could not add client: ${err.message}`); }
});
clientNew.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') $('client-add').click();
});
clientShowInactive.addEventListener('change', refreshClients);

clientBody.addEventListener('click', async (ev) => {
  const btn = ev.target.closest('button');
  if (!btn) return;
  const tr = btn.closest('tr');
  const id = Number(tr.dataset.id);
  const act = btn.dataset.act;
  try {
    if (act === 'deactivate') {
      if (!confirm('Deactivate this client? Inactive clients are hidden from the panel.')) return;
      await tc.clients.deactivate(id);
    } else if (act === 'reactivate') {
      await tc.clients.update(id, { active: 1 });
    } else if (act === 'rename') {
      const cell = tr.querySelector('.client-name-cell');
      const current = cell.textContent;
      const next = prompt('Rename client:', current);
      if (next == null) return;
      const trimmed = next.trim();
      if (!trimmed || trimmed === current) return;
      await tc.clients.update(id, { name: trimmed });
    }
    await refreshClients();
  } catch (err) { alert(`Failed: ${err.message}`); }
});

// ---------- TASKS ----------
const taskClientSelect = $('task-client-select');
const taskBody = $('task-body');
const taskNew = $('task-new-name');
const taskShowInactive = $('task-show-inactive');

async function refreshTaskClientSelect() {
  const prev = taskClientSelect.value;
  const clients = await tc.clients.listAll();
  taskClientSelect.innerHTML = '';
  if (!clients.length) {
    taskClientSelect.add(new Option('(no clients)', ''));
    taskClientSelect.disabled = true;
    return;
  }
  taskClientSelect.disabled = false;
  for (const c of clients) {
    taskClientSelect.add(new Option(c.name + (c.active ? '' : ' (inactive)'), String(c.id)));
  }
  if (prev && [...taskClientSelect.options].some((o) => o.value === prev)) {
    taskClientSelect.value = prev;
  }
}

async function refreshTasks() {
  const clientId = taskClientSelect.value ? Number(taskClientSelect.value) : null;
  if (!clientId) {
    taskBody.innerHTML = '<tr><td colspan="3" class="empty">Select a client.</td></tr>';
    return;
  }
  const showInactive = taskShowInactive.checked;
  const tasks = showInactive
    ? await tc.tasks.listAll(clientId)
    : await tc.tasks.list(clientId);
  if (!tasks.length) {
    taskBody.innerHTML = '<tr><td colspan="3" class="empty">No tasks for this client yet.</td></tr>';
    return;
  }
  taskBody.innerHTML = tasks.map((t) => `
    <tr data-id="${t.id}" data-active="${t.active}">
      <td><span class="task-name-cell">${esc(t.name)}</span></td>
      <td><span class="tag ${t.active ? 'active' : 'inactive'}">${t.active ? 'active' : 'inactive'}</span></td>
      <td class="actions-cell">
        <button class="ghost" data-act="rename">Rename</button>
        ${t.active
          ? `<button class="danger" data-act="deactivate">Deactivate</button>`
          : `<button data-act="reactivate">Reactivate</button>`
        }
      </td>
    </tr>
  `).join('');
}

taskClientSelect.addEventListener('change', refreshTasks);
taskShowInactive.addEventListener('change', refreshTasks);

$('task-add').addEventListener('click', async () => {
  const clientId = taskClientSelect.value ? Number(taskClientSelect.value) : null;
  const name = taskNew.value.trim();
  if (!clientId || !name) return;
  try {
    await tc.tasks.create(clientId, name);
    taskNew.value = '';
    await refreshTasks();
  } catch (err) { alert(`Could not add task: ${err.message}`); }
});
taskNew.addEventListener('keydown', (e) => { if (e.key === 'Enter') $('task-add').click(); });

taskBody.addEventListener('click', async (ev) => {
  const btn = ev.target.closest('button');
  if (!btn) return;
  const tr = btn.closest('tr');
  const id = Number(tr.dataset.id);
  const act = btn.dataset.act;
  try {
    if (act === 'deactivate') {
      if (!confirm('Deactivate this task?')) return;
      await tc.tasks.deactivate(id);
    } else if (act === 'reactivate') {
      await tc.tasks.update(id, { active: 1 });
    } else if (act === 'rename') {
      const cell = tr.querySelector('.task-name-cell');
      const current = cell.textContent;
      const next = prompt('Rename task:', current);
      if (next == null) return;
      const trimmed = next.trim();
      if (!trimmed || trimmed === current) return;
      await tc.tasks.update(id, { name: trimmed });
    }
    await refreshTasks();
  } catch (err) { alert(`Failed: ${err.message}`); }
});

// ---------- SETTINGS ----------
const autoStart = $('setting-auto-start');

async function refreshSettings() {
  try {
    autoStart.checked = !!(await tc.app.getStartOnLogin());
  } catch (err) { console.error(err); }
  $('db-path-hint').textContent = '%APPDATA%/TimeClock/timeclock.db (or platform equivalent)';
}
autoStart.addEventListener('change', async () => {
  try {
    const result = await tc.app.setStartOnLogin(autoStart.checked);
    autoStart.checked = !!result;
  } catch (err) {
    alert(`Could not change setting: ${err.message}`);
    autoStart.checked = !autoStart.checked;
  }
});

// keep log fresh when timer state changes
tc.on('timer:state-changed', () => {
  if (document.querySelector('.page.active')?.dataset.page === 'log') refreshLog();
});
