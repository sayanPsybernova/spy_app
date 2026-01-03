import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.join(__dirname, '..', '..', 'telemetry.db');

export const db = new Database(dbPath);

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');

function initializeDatabase() {
  // Devices table
  db.exec(`
    CREATE TABLE IF NOT EXISTS devices (
      device_id TEXT PRIMARY KEY,
      username TEXT NOT NULL,
      device_name TEXT NOT NULL,
      first_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_seen DATETIME,
      is_online INTEGER DEFAULT 0,
      location_enabled INTEGER DEFAULT 0
    )
  `);

  // Telemetry events table
  db.exec(`
    CREATE TABLE IF NOT EXISTS telemetry_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      device_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      app_package TEXT,
      app_label TEXT,
      start_time DATETIME,
      end_time DATETIME,
      duration_ms INTEGER,
      screen_state TEXT,
      network_type TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (device_id) REFERENCES devices(device_id)
    )
  `);

  // Sessions table
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      device_id TEXT NOT NULL,
      session_start DATETIME,
      session_end DATETIME,
      total_active_time_ms INTEGER,
      app_switches INTEGER,
      FOREIGN KEY (device_id) REFERENCES devices(device_id)
    )
  `);

  // Intent results table
  db.exec(`
    CREATE TABLE IF NOT EXISTS intent_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      device_id TEXT NOT NULL,
      session_id INTEGER,
      intent_category TEXT,
      confidence REAL,
      reasoning TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (device_id) REFERENCES devices(device_id),
      FOREIGN KEY (session_id) REFERENCES sessions(id)
    )
  `);

  // Location history table
  db.exec(`
    CREATE TABLE IF NOT EXISTS location_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      device_id TEXT NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      accuracy REAL,
      altitude REAL,
      speed REAL,
      bearing REAL,
      timestamp DATETIME NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (device_id) REFERENCES devices(device_id)
    )
  `);

  // Create index for fast location queries
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_location_device_time
    ON location_history(device_id, timestamp DESC)
  `);

  // Create index for telemetry queries
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_telemetry_device_time
    ON telemetry_events(device_id, created_at DESC)
  `);

  console.log('Database initialized successfully');
}

// Initialize tables before creating prepared statements
initializeDatabase();

// Device operations
export const deviceQueries = {
  getAll: db.prepare('SELECT * FROM devices ORDER BY last_seen DESC'),

  getById: db.prepare('SELECT * FROM devices WHERE device_id = ?'),

  insert: db.prepare(`
    INSERT INTO devices (device_id, username, device_name, first_seen, last_seen, is_online)
    VALUES (?, ?, ?, datetime('now'), datetime('now'), 1)
  `),

  updateOnlineStatus: db.prepare(`
    UPDATE devices SET is_online = ?, last_seen = datetime('now') WHERE device_id = ?
  `),

  updateLocationEnabled: db.prepare(`
    UPDATE devices SET location_enabled = ? WHERE device_id = ?
  `),

  delete: db.prepare('DELETE FROM devices WHERE device_id = ?')
};

// Telemetry operations
export const telemetryQueries = {
  insert: db.prepare(`
    INSERT INTO telemetry_events (device_id, event_type, app_package, app_label, start_time, end_time, duration_ms, screen_state, network_type)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `),

  getByDevice: db.prepare(`
    SELECT * FROM telemetry_events WHERE device_id = ? ORDER BY created_at DESC LIMIT ?
  `),

  getRecent: db.prepare(`
    SELECT * FROM telemetry_events WHERE device_id = ? AND created_at > datetime('now', '-1 hour') ORDER BY created_at DESC
  `)
};

// Location operations
export const locationQueries = {
  insert: db.prepare(`
    INSERT INTO location_history (device_id, latitude, longitude, accuracy, altitude, speed, bearing, timestamp)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `),

  getLatest: db.prepare(`
    SELECT * FROM location_history WHERE device_id = ? ORDER BY timestamp DESC LIMIT 1
  `),

  getHistory: db.prepare(`
    SELECT * FROM location_history WHERE device_id = ? ORDER BY timestamp DESC LIMIT ?
  `),

  getTrail: db.prepare(`
    SELECT * FROM location_history
    WHERE device_id = ? AND timestamp > datetime('now', '-30 minutes')
    ORDER BY timestamp ASC
  `)
};

// Session operations
export const sessionQueries = {
  insert: db.prepare(`
    INSERT INTO sessions (device_id, session_start, session_end, total_active_time_ms, app_switches)
    VALUES (?, ?, ?, ?, ?)
  `),

  getByDevice: db.prepare(`
    SELECT * FROM sessions WHERE device_id = ? ORDER BY session_start DESC LIMIT ?
  `)
};

// Intent operations
export const intentQueries = {
  insert: db.prepare(`
    INSERT INTO intent_results (device_id, session_id, intent_category, confidence, reasoning)
    VALUES (?, ?, ?, ?, ?)
  `),

  getByDevice: db.prepare(`
    SELECT * FROM intent_results WHERE device_id = ? ORDER BY created_at DESC LIMIT ?
  `)
};
