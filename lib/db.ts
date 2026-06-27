import * as SQLite from 'expo-sqlite';

let _db: SQLite.SQLiteDatabase | null = null;

export function getDb(): SQLite.SQLiteDatabase {
  if (!_db) _db = SQLite.openDatabaseSync('vanism.db');
  return _db;
}

// ---------------------------------------------------------------------------
// Migrations — append only, never destructive
// ---------------------------------------------------------------------------
const MIGRATIONS: string[][] = [
  // v1
  [
    `CREATE TABLE IF NOT EXISTS spots (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      lat        REAL    NOT NULL,
      lon        REAL    NOT NULL,
      logged_at  INTEGER NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS budget_logs (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      amount     REAL    NOT NULL,
      item       TEXT    NOT NULL,
      logged_at  INTEGER NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )`,
  ],
  // v2
  [
    `CREATE TABLE IF NOT EXISTS plans (
      id                 INTEGER PRIMARY KEY AUTOINCREMENT,
      origin             TEXT    NOT NULL,
      destination        TEXT    NOT NULL,
      distance_miles     REAL    NOT NULL,
      drive_time_minutes INTEGER NOT NULL,
      status             TEXT    NOT NULL DEFAULT 'upcoming',
      created_at         INTEGER NOT NULL
    )`,
  ],
  // v3
  [
    `ALTER TABLE plans ADD COLUMN notes TEXT`,
  ],
  // v4 — hot_springs (kept for future discover mode, unused in current model)
  [
    `CREATE TABLE IF NOT EXISTS hot_springs (
      id   INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      lat  REAL NOT NULL,
      lon  REAL NOT NULL
    )`,
    // Hand-seeded starter set of well-known western US hot springs with verified coordinates.
    // Should be replaced with the full NOAA "Thermal Springs List for the United States"
    // (CC0 public domain, 1,661 locations) once the dataset file is sourced and added to
    // the project. IDs are hardcoded so OR IGNORE prevents re-seeding on re-apply.
    `INSERT OR IGNORE INTO hot_springs (id, name, lat, lon) VALUES
      (1,  'Granite Hot Springs',            43.369257, -110.446079),
      (2,  'Boiling River (Yellowstone NP)', 44.989800, -110.666500),
      (3,  'Strawberry Park Hot Springs',    40.547700, -106.842800),
      (4,  'Conundrum Hot Springs',          38.972700, -107.039600),
      (5,  'Ouray Hot Springs Pool',         38.022800, -107.671400),
      (6,  'Glenwood Hot Springs',           39.550500, -107.324700),
      (7,  'Pagosa Springs',                 37.269700, -107.009900),
      (8,  'Travertine Hot Springs',         38.269000, -119.224500),
      (9,  'Buckeye Hot Spring',             38.331900, -119.240800),
      (10, 'Kirkham Hot Springs',            44.079700, -115.658300),
      (11, 'Burgdorf Hot Springs',           45.374200, -115.650300),
      (12, 'Jerry Johnson Hot Springs',      46.299800, -114.884500),
      (13, 'Goldbug Hot Springs',            45.129200, -114.006900),
      (14, 'Umpqua Hot Springs',             43.289700, -122.360000),
      (15, 'The Homestead Crater',           40.361100, -111.494400)`,
  ],
  // v5
  [
    `CREATE TABLE IF NOT EXISTS plan_sleep_spots (
      id       INTEGER PRIMARY KEY AUTOINCREMENT,
      plan_id  INTEGER NOT NULL REFERENCES plans(id),
      name     TEXT    NOT NULL,
      lat      REAL    NOT NULL,
      lon      REAL    NOT NULL,
      notes    TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS plan_bath_spots (
      id       INTEGER PRIMARY KEY AUTOINCREMENT,
      plan_id  INTEGER NOT NULL REFERENCES plans(id),
      name     TEXT    NOT NULL,
      lat      REAL    NOT NULL,
      lon      REAL    NOT NULL,
      notes    TEXT
    )`,
  ],
  // v6 — re-ensures plan_sleep_spots and plan_bath_spots exist; v5 was skipped on
  // devices where schema_version was already stamped 5 before these tables were added.
  [
    `CREATE TABLE IF NOT EXISTS plan_sleep_spots (
      id       INTEGER PRIMARY KEY AUTOINCREMENT,
      plan_id  INTEGER NOT NULL REFERENCES plans(id),
      name     TEXT    NOT NULL,
      lat      REAL    NOT NULL,
      lon      REAL    NOT NULL,
      notes    TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS plan_bath_spots (
      id       INTEGER PRIMARY KEY AUTOINCREMENT,
      plan_id  INTEGER NOT NULL REFERENCES plans(id),
      name     TEXT    NOT NULL,
      lat      REAL    NOT NULL,
      lon      REAL    NOT NULL,
      notes    TEXT
    )`,
  ],
];

export function runMigrations(): void {
  const db = getDb();
  db.execSync(`PRAGMA journal_mode = WAL`);
  // Bootstrap: ensure schema_version exists before we query it
  db.execSync(`CREATE TABLE IF NOT EXISTS schema_version (id INTEGER PRIMARY KEY, version INTEGER NOT NULL)`);
  db.execSync(`INSERT OR IGNORE INTO schema_version (id, version) VALUES (1, 0)`);

  const row = db.getFirstSync<{ version: number }>(
    `SELECT version FROM schema_version WHERE id = 1`
  );
  const current = row?.version ?? 0;

  for (let i = current; i < MIGRATIONS.length; i++) {
    db.withTransactionSync(() => {
      for (const sql of MIGRATIONS[i]) {
        db.execSync(sql);
      }
      db.runSync(`UPDATE schema_version SET version = ? WHERE id = 1`, [i + 1]);
    });
  }
}

// ---------------------------------------------------------------------------
// Spot helpers
// ---------------------------------------------------------------------------
export function insertSpot(lat: number, lon: number): void {
  getDb().runSync(
    `INSERT INTO spots (lat, lon, logged_at) VALUES (?, ?, ?)`,
    [lat, lon, Date.now()]
  );
}

export function getLastSpot(): { lat: number; lon: number; logged_at: number } | null {
  return getDb().getFirstSync<{ lat: number; lon: number; logged_at: number }>(
    `SELECT lat, lon, logged_at FROM spots ORDER BY logged_at DESC LIMIT 1`
  ) ?? null;
}

// ---------------------------------------------------------------------------
// Budget log helpers
// ---------------------------------------------------------------------------
export type BudgetRow = { id: number; amount: number; item: string; logged_at: number };

export function insertBudgetLog(amount: number, item: string): void {
  getDb().runSync(
    `INSERT INTO budget_logs (amount, item, logged_at) VALUES (?, ?, ?)`,
    [amount, item, Date.now()]
  );
}

export function getTodayBudgetLogs(): BudgetRow[] {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  return getDb().getAllSync<BudgetRow>(
    `SELECT id, amount, item, logged_at FROM budget_logs WHERE logged_at >= ? ORDER BY logged_at DESC`,
    [startOfDay.getTime()]
  );
}

// ---------------------------------------------------------------------------
// Plan helpers
// ---------------------------------------------------------------------------
export type PlanRow = {
  id: number;
  origin: string;
  destination: string;
  distance_miles: number;
  drive_time_minutes: number;
  status: 'upcoming' | 'current' | 'past';
  created_at: number;
  notes: string | null;
};

export function insertPlan(
  origin: string,
  destination: string,
  distance_miles: number,
  drive_time_minutes: number,
  notes: string
): void {
  getDb().runSync(
    `INSERT INTO plans (origin, destination, distance_miles, drive_time_minutes, status, created_at, notes) VALUES (?, ?, ?, ?, 'upcoming', ?, ?)`,
    [origin, destination, distance_miles, drive_time_minutes, Date.now(), notes]
  );
}

export function getPlansByStatus(status: PlanRow['status']): PlanRow[] {
  return getDb().getAllSync<PlanRow>(
    `SELECT * FROM plans WHERE status = ? ORDER BY created_at DESC`,
    [status]
  );
}

export type SpotInput = { name: string; lat: number; lon: number; notes: string };

export type PlanBathSpotRow = {
  id: number; plan_id: number; name: string; lat: number; lon: number; notes: string | null;
};

export function upsertPlanSleepSpot(plan_id: number, spot: SpotInput): void {
  const db = getDb();
  db.withTransactionSync(() => {
    db.runSync(`DELETE FROM plan_sleep_spots WHERE plan_id = ?`, [plan_id]);
    db.runSync(
      `INSERT INTO plan_sleep_spots (plan_id, name, lat, lon, notes) VALUES (?, ?, ?, ?, ?)`,
      [plan_id, spot.name, spot.lat, spot.lon, spot.notes]
    );
  });
}

export function upsertPlanBathSpot(plan_id: number, spot: SpotInput): void {
  const db = getDb();
  db.withTransactionSync(() => {
    db.runSync(`DELETE FROM plan_bath_spots WHERE plan_id = ?`, [plan_id]);
    db.runSync(
      `INSERT INTO plan_bath_spots (plan_id, name, lat, lon, notes) VALUES (?, ?, ?, ?, ?)`,
      [plan_id, spot.name, spot.lat, spot.lon, spot.notes]
    );
  });
}

export function promotePlanToCurrent(plan_id: number): void {
  const db = getDb();
  db.withTransactionSync(() => {
    db.runSync(`UPDATE plans SET status = 'upcoming' WHERE status = 'current'`);
    db.runSync(`UPDATE plans SET status = 'current' WHERE id = ?`, [plan_id]);
  });
}

export function getActivePlanBathSpot(): PlanBathSpotRow | null {
  return getDb().getFirstSync<PlanBathSpotRow>(
    `SELECT b.id, b.plan_id, b.name, b.lat, b.lon, b.notes
     FROM plan_bath_spots b
     JOIN plans p ON b.plan_id = p.id
     WHERE p.status IN ('current', 'upcoming')
     ORDER BY CASE p.status WHEN 'current' THEN 0 ELSE 1 END, p.created_at DESC
     LIMIT 1`
  ) ?? null;
}

// ---------------------------------------------------------------------------
// Hot springs helpers
// ---------------------------------------------------------------------------
export type HotSpringRow = { id: number; name: string; lat: number; lon: number };

export function getHotSprings(): HotSpringRow[] {
  return getDb().getAllSync<HotSpringRow>(`SELECT id, name, lat, lon FROM hot_springs ORDER BY id`);
}

// ---------------------------------------------------------------------------
// Settings helpers
// ---------------------------------------------------------------------------
export function getSetting(key: string, fallback: string): string {
  const row = getDb().getFirstSync<{ value: string }>(
    `SELECT value FROM settings WHERE key = ?`, [key]
  );
  return row?.value ?? fallback;
}

export function setSetting(key: string, value: string): void {
  getDb().runSync(
    `INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [key, value]
  );
}
