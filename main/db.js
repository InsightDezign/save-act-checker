const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

let db = null;

function init(userDataPath) {
  if (db) return db;
  fs.mkdirSync(userDataPath, { recursive: true });
  const dbPath = path.join(userDataPath, 'timeclock.db');
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  migrate();
  return db;
}

function migrate() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS clients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      active INTEGER DEFAULT 1,
      whmcs_client_id INTEGER,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER NOT NULL REFERENCES clients(id),
      name TEXT NOT NULL,
      active INTEGER DEFAULT 1,
      whmcs_task_id INTEGER,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS time_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL REFERENCES tasks(id),
      client_id INTEGER NOT NULL,
      started_at TEXT NOT NULL,
      stopped_at TEXT,
      paused_seconds INTEGER DEFAULT 0,
      notes TEXT,
      synced INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS pause_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entry_id INTEGER NOT NULL REFERENCES time_entries(id),
      paused_at TEXT NOT NULL,
      resumed_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_tasks_client ON tasks(client_id);
    CREATE INDEX IF NOT EXISTS idx_entries_task ON time_entries(task_id);
    CREATE INDEX IF NOT EXISTS idx_entries_open ON time_entries(stopped_at);
    CREATE INDEX IF NOT EXISTS idx_pause_entry ON pause_events(entry_id);
  `);
}

const clients = {
  list() {
    return db.prepare('SELECT * FROM clients WHERE active = 1 ORDER BY name COLLATE NOCASE').all();
  },
  listAll() {
    return db.prepare('SELECT * FROM clients ORDER BY name COLLATE NOCASE').all();
  },
  get(id) {
    return db.prepare('SELECT * FROM clients WHERE id = ?').get(id);
  },
  create(name) {
    const info = db.prepare('INSERT INTO clients (name) VALUES (?)').run(name);
    return clients.get(info.lastInsertRowid);
  },
  update(id, data) {
    const fields = [];
    const values = [];
    for (const k of ['name', 'active', 'whmcs_client_id']) {
      if (k in data) { fields.push(`${k} = ?`); values.push(data[k]); }
    }
    if (!fields.length) return clients.get(id);
    values.push(id);
    db.prepare(`UPDATE clients SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    return clients.get(id);
  },
  deactivate(id) {
    db.prepare('UPDATE clients SET active = 0 WHERE id = ?').run(id);
    return clients.get(id);
  },
};

const tasks = {
  list(clientId) {
    return db.prepare('SELECT * FROM tasks WHERE client_id = ? AND active = 1 ORDER BY name COLLATE NOCASE').all(clientId);
  },
  listAll(clientId) {
    if (clientId) {
      return db.prepare('SELECT * FROM tasks WHERE client_id = ? ORDER BY name COLLATE NOCASE').all(clientId);
    }
    return db.prepare('SELECT * FROM tasks ORDER BY name COLLATE NOCASE').all();
  },
  get(id) {
    return db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  },
  create(clientId, name) {
    const info = db.prepare('INSERT INTO tasks (client_id, name) VALUES (?, ?)').run(clientId, name);
    return tasks.get(info.lastInsertRowid);
  },
  update(id, data) {
    const fields = [];
    const values = [];
    for (const k of ['name', 'active', 'whmcs_task_id', 'client_id']) {
      if (k in data) { fields.push(`${k} = ?`); values.push(data[k]); }
    }
    if (!fields.length) return tasks.get(id);
    values.push(id);
    db.prepare(`UPDATE tasks SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    return tasks.get(id);
  },
  deactivate(id) {
    db.prepare('UPDATE tasks SET active = 0 WHERE id = ?').run(id);
    return tasks.get(id);
  },
};

const entries = {
  get(id) {
    return db.prepare('SELECT * FROM time_entries WHERE id = ?').get(id);
  },
  findOpen() {
    return db.prepare('SELECT * FROM time_entries WHERE stopped_at IS NULL ORDER BY id DESC LIMIT 1').get();
  },
  start(taskId) {
    const task = tasks.get(taskId);
    if (!task) throw new Error(`task ${taskId} not found`);
    const startedAt = new Date().toISOString();
    const info = db.prepare(
      'INSERT INTO time_entries (task_id, client_id, started_at) VALUES (?, ?, ?)'
    ).run(taskId, task.client_id, startedAt);
    return entries.get(info.lastInsertRowid);
  },
  stop(id) {
    const stoppedAt = new Date().toISOString();
    db.prepare('UPDATE time_entries SET stopped_at = ? WHERE id = ?').run(stoppedAt, id);
    return entries.get(id);
  },
  setPausedSeconds(id, seconds) {
    db.prepare('UPDATE time_entries SET paused_seconds = ? WHERE id = ?').run(seconds, id);
    return entries.get(id);
  },
  updateNotes(id, notes) {
    db.prepare('UPDATE time_entries SET notes = ? WHERE id = ?').run(notes, id);
    return entries.get(id);
  },
  list(filters = {}) {
    const where = [];
    const params = [];
    if (filters.clientId != null) { where.push('e.client_id = ?'); params.push(filters.clientId); }
    if (filters.taskId != null) { where.push('e.task_id = ?'); params.push(filters.taskId); }
    if (filters.from) { where.push('e.started_at >= ?'); params.push(filters.from); }
    if (filters.to) { where.push('e.started_at <= ?'); params.push(filters.to); }
    if (filters.synced != null) { where.push('e.synced = ?'); params.push(filters.synced ? 1 : 0); }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    return db.prepare(`
      SELECT e.*, c.name AS client_name, t.name AS task_name
      FROM time_entries e
      JOIN clients c ON c.id = e.client_id
      JOIN tasks t ON t.id = e.task_id
      ${whereSql}
      ORDER BY e.started_at DESC
    `).all(...params);
  },
};

const pauses = {
  open(entryId) {
    const pausedAt = new Date().toISOString();
    const info = db.prepare(
      'INSERT INTO pause_events (entry_id, paused_at) VALUES (?, ?)'
    ).run(entryId, pausedAt);
    return db.prepare('SELECT * FROM pause_events WHERE id = ?').get(info.lastInsertRowid);
  },
  close(pauseId) {
    const resumedAt = new Date().toISOString();
    db.prepare('UPDATE pause_events SET resumed_at = ? WHERE id = ?').run(resumedAt, pauseId);
    return db.prepare('SELECT * FROM pause_events WHERE id = ?').get(pauseId);
  },
  findOpenForEntry(entryId) {
    return db.prepare(
      'SELECT * FROM pause_events WHERE entry_id = ? AND resumed_at IS NULL ORDER BY id DESC LIMIT 1'
    ).get(entryId);
  },
  totalSecondsForEntry(entryId) {
    // Sum closed pauses only; in-progress pause is added live in timer.js
    const row = db.prepare(`
      SELECT COALESCE(SUM(strftime('%s', resumed_at) - strftime('%s', paused_at)), 0) AS secs
      FROM pause_events
      WHERE entry_id = ? AND resumed_at IS NOT NULL
    `).get(entryId);
    return row ? Number(row.secs) : 0;
  },
};

function close() {
  if (db) {
    db.close();
    db = null;
  }
}

module.exports = {
  init,
  close,
  get raw() { return db; },
  clients,
  tasks,
  entries,
  pauses,
};
