const $ = (id) => document.getElementById(id);
const out = $('out');
const log = (label, value) => {
  const text = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  out.textContent = `[${new Date().toLocaleTimeString()}] ${label}\n${text}`;
};

let lastTaskId = null;

function renderState(s) {
  const pill = $('state');
  pill.className = `pill ${s.status.toLowerCase()}`;
  pill.textContent = s.status;
  $('elapsed').textContent = `${s.elapsedSeconds || 0}s`;
}

async function refresh() {
  const s = await window.timeclock.timer.getState();
  renderState(s);
}

window.timeclock.on('timer:state-changed', (s) => renderState(s));
window.timeclock.on('power:event', (e) => log('power event', e));

setInterval(refresh, 1000);
refresh();

$('seed').addEventListener('click', async () => {
  try {
    const client = await window.timeclock.clients.create(`Client ${Date.now() % 10000}`);
    const task = await window.timeclock.tasks.create(client.id, `Task ${Date.now() % 10000}`);
    lastTaskId = task.id;
    log('seeded', { client, task });
  } catch (err) { log('error', err.message); }
});

$('start').addEventListener('click', async () => {
  try {
    if (!lastTaskId) {
      const tasks = await window.timeclock.tasks.listAll();
      lastTaskId = tasks[0]?.id;
    }
    if (!lastTaskId) return log('error', 'no task — click Seed first');
    log('start', await window.timeclock.timer.start(lastTaskId));
  } catch (err) { log('error', err.message); }
});

$('pause').addEventListener('click', async () => {
  try { log('pause', await window.timeclock.timer.pause()); }
  catch (err) { log('error', err.message); }
});

$('resume').addEventListener('click', async () => {
  try { log('resume', await window.timeclock.timer.resume()); }
  catch (err) { log('error', err.message); }
});

$('stop').addEventListener('click', async () => {
  try { log('stop', await window.timeclock.timer.stop()); }
  catch (err) { log('error', err.message); }
});
