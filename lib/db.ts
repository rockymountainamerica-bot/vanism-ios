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
