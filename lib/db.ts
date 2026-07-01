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
  // v7
  [
    `CREATE TABLE IF NOT EXISTS plan_activity_categories (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      plan_id    INTEGER NOT NULL REFERENCES plans(id),
      name       TEXT    NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0
    )`,
    `CREATE TABLE IF NOT EXISTS plan_activity_spots (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id INTEGER NOT NULL REFERENCES plan_activity_categories(id),
      name        TEXT    NOT NULL,
      lat         REAL    NOT NULL,
      lon         REAL    NOT NULL,
      notes       TEXT
    )`,
  ],
  // v8 — multi-day trip support: day_number on sleep/bath spots, day cursors on plans
  [
    `ALTER TABLE plan_sleep_spots ADD COLUMN day_number INTEGER NOT NULL DEFAULT 1`,
    `ALTER TABLE plan_bath_spots  ADD COLUMN day_number INTEGER NOT NULL DEFAULT 1`,
    `ALTER TABLE plans ADD COLUMN current_sleep_day INTEGER NOT NULL DEFAULT 1`,
    `ALTER TABLE plans ADD COLUMN current_bath_day  INTEGER NOT NULL DEFAULT 1`,
  ],
  // v9 — Challenge Mode: achievements + user_achievements
  [
    `CREATE TABLE IF NOT EXISTS achievements (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      name           TEXT    NOT NULL,
      type           TEXT    NOT NULL,
      lat            REAL    NOT NULL,
      lon            REAL    NOT NULL,
      radius_meters  REAL    NOT NULL,
      description    TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS user_achievements (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      achievement_id INTEGER NOT NULL REFERENCES achievements(id),
      earned_at      INTEGER NOT NULL
    )`,
    // Yellowstone entrances — all share the name "Yellowstone Arrival"; only the first
    // hit awards the achievement (dedup by name in checkAndAwardAchievements).
    `INSERT OR IGNORE INTO achievements (id, name, type, lat, lon, radius_meters, description) VALUES
      (1, 'Yellowstone Arrival', 'park_entrance', 45.02955, -110.70870, 150, 'North Entrance — Gardiner, MT'),
      (2, 'Yellowstone Arrival', 'park_entrance', 45.00336, -110.00128, 150, 'Northeast Entrance — Cooke City, MT'),
      (3, 'Yellowstone Arrival', 'park_entrance', 44.48845, -110.00383, 150, 'East Entrance — Cody, WY corridor'),
      (4, 'Yellowstone Arrival', 'park_entrance', 44.13249, -110.66468, 150, 'South Entrance — Jackson, WY corridor'),
      (5, 'Yellowstone Arrival', 'park_entrance', 44.65841, -111.09719, 150, 'West Entrance — West Yellowstone, MT'),
      (6, 'Mount Washburn Summit', 'summit', 44.7854936, -110.4540905, 150, 'Dunraven Pass trailhead — summit of Mount Washburn')`,
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
  current_sleep_day: number;
  current_bath_day: number;
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
export type MultiDaySpotInput = SpotInput & { day_number: number };

export type PlanSleepSpotRow = {
  id: number; plan_id: number; name: string; lat: number; lon: number; notes: string | null; day_number: number;
};

export type PlanBathSpotRow = {
  id: number; plan_id: number; name: string; lat: number; lon: number; notes: string | null; day_number: number;
};

export type ActivePlanSleepData = { planId: number; currentDay: number; spots: PlanSleepSpotRow[] };
export type ActivePlanBathData  = { planId: number; currentDay: number; spots: PlanBathSpotRow[] };

export function upsertPlanSleepSpots(plan_id: number, spots: MultiDaySpotInput[]): void {
  const db = getDb();
  db.withTransactionSync(() => {
    db.runSync(`DELETE FROM plan_sleep_spots WHERE plan_id = ?`, [plan_id]);
    for (const s of spots) {
      db.runSync(
        `INSERT INTO plan_sleep_spots (plan_id, name, lat, lon, notes, day_number) VALUES (?, ?, ?, ?, ?, ?)`,
        [plan_id, s.name, s.lat, s.lon, s.notes, s.day_number]
      );
    }
    db.runSync(`UPDATE plans SET current_sleep_day = 1 WHERE id = ?`, [plan_id]);
  });
}

export function upsertPlanBathSpots(plan_id: number, spots: MultiDaySpotInput[]): void {
  const db = getDb();
  db.withTransactionSync(() => {
    db.runSync(`DELETE FROM plan_bath_spots WHERE plan_id = ?`, [plan_id]);
    for (const s of spots) {
      db.runSync(
        `INSERT INTO plan_bath_spots (plan_id, name, lat, lon, notes, day_number) VALUES (?, ?, ?, ?, ?, ?)`,
        [plan_id, s.name, s.lat, s.lon, s.notes, s.day_number]
      );
    }
    db.runSync(`UPDATE plans SET current_bath_day = 1 WHERE id = ?`, [plan_id]);
  });
}

export function promotePlanToCurrent(plan_id: number): void {
  const db = getDb();
  db.withTransactionSync(() => {
    db.runSync(`UPDATE plans SET status = 'upcoming' WHERE status = 'current'`);
    db.runSync(`UPDATE plans SET status = 'current' WHERE id = ?`, [plan_id]);
  });
}

export function getSleepSpotForPlan(plan_id: number): PlanSleepSpotRow | null {
  return getDb().getFirstSync<PlanSleepSpotRow>(
    `SELECT id, plan_id, name, lat, lon, notes, day_number FROM plan_sleep_spots WHERE plan_id = ? ORDER BY day_number LIMIT 1`,
    [plan_id]
  ) ?? null;
}

export function getBathSpotForPlan(plan_id: number): PlanBathSpotRow | null {
  return getDb().getFirstSync<PlanBathSpotRow>(
    `SELECT id, plan_id, name, lat, lon, notes, day_number FROM plan_bath_spots WHERE plan_id = ? ORDER BY day_number LIMIT 1`,
    [plan_id]
  ) ?? null;
}

export function completePlan(plan_id: number): void {
  getDb().runSync(`UPDATE plans SET status = 'past' WHERE id = ?`, [plan_id]);
}

export function setSleepDay(plan_id: number, day: number): void {
  getDb().runSync(`UPDATE plans SET current_sleep_day = ? WHERE id = ?`, [day, plan_id]);
}

export function setBathDay(plan_id: number, day: number): void {
  getDb().runSync(`UPDATE plans SET current_bath_day = ? WHERE id = ?`, [day, plan_id]);
}

export function getActivePlanSleepData(): ActivePlanSleepData | null {
  const db = getDb();
  const plan = db.getFirstSync<{ id: number; current_sleep_day: number }>(
    `SELECT id, current_sleep_day FROM plans
     WHERE status IN ('current', 'upcoming')
     ORDER BY CASE status WHEN 'current' THEN 0 ELSE 1 END, created_at DESC
     LIMIT 1`
  );
  if (!plan) return null;
  const spots = db.getAllSync<PlanSleepSpotRow>(
    `SELECT id, plan_id, name, lat, lon, notes, day_number FROM plan_sleep_spots
     WHERE plan_id = ? ORDER BY day_number`,
    [plan.id]
  );
  if (spots.length === 0) return null;
  return { planId: plan.id, currentDay: plan.current_sleep_day, spots };
}

export function getActivePlanBathData(): ActivePlanBathData | null {
  const db = getDb();
  const plan = db.getFirstSync<{ id: number; current_bath_day: number }>(
    `SELECT id, current_bath_day FROM plans
     WHERE status IN ('current', 'upcoming')
     ORDER BY CASE status WHEN 'current' THEN 0 ELSE 1 END, created_at DESC
     LIMIT 1`
  );
  if (!plan) return null;
  const spots = db.getAllSync<PlanBathSpotRow>(
    `SELECT id, plan_id, name, lat, lon, notes, day_number FROM plan_bath_spots
     WHERE plan_id = ? ORDER BY day_number`,
    [plan.id]
  );
  if (spots.length === 0) return null;
  return { planId: plan.id, currentDay: plan.current_bath_day, spots };
}

// ---------------------------------------------------------------------------
// Achievement helpers
// ---------------------------------------------------------------------------
export type AchievementRow = { id: number; name: string; type: string; lat: number; lon: number; radius_meters: number; description: string | null };

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6_371_000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function checkAndAwardAchievements(lat: number, lon: number): AchievementRow[] {
  const db = getDb();
  const all = db.getAllSync<AchievementRow>(
    `SELECT id, name, type, lat, lon, radius_meters, description FROM achievements`
  );
  const earnedNames = new Set(
    db.getAllSync<{ name: string }>(
      `SELECT DISTINCT a.name FROM user_achievements ua JOIN achievements a ON ua.achievement_id = a.id`
    ).map(r => r.name)
  );
  const newlyEarned: AchievementRow[] = [];
  for (const a of all) {
    if (earnedNames.has(a.name)) continue;
    if (haversineMeters(lat, lon, a.lat, a.lon) <= a.radius_meters) {
      db.runSync(
        `INSERT INTO user_achievements (achievement_id, earned_at) VALUES (?, ?)`,
        [a.id, Date.now()]
      );
      earnedNames.add(a.name);
      newlyEarned.push(a);
    }
  }
  return newlyEarned;
}

export function getAllUniqueAchievementNames(): { name: string; type: string }[] {
  return getDb().getAllSync<{ name: string; type: string }>(
    `SELECT DISTINCT name, type FROM achievements ORDER BY id`
  );
}

export function getUniqueEarnedAchievements(): { name: string; type: string; earned_at: number }[] {
  return getDb().getAllSync<{ name: string; type: string; earned_at: number }>(
    `SELECT a.name, a.type, MIN(ua.earned_at) as earned_at
     FROM user_achievements ua JOIN achievements a ON ua.achievement_id = a.id
     GROUP BY a.name ORDER BY earned_at ASC`
  );
}

// ---------------------------------------------------------------------------
// Activity helpers
// ---------------------------------------------------------------------------
export type ActivityCategoryRow = { id: number; plan_id: number; name: string; sort_order: number };
export type ActivitySpotRow = { id: number; category_id: number; name: string; lat: number; lon: number; notes: string | null };
export type ActivityCategoryWithSpots = { category: ActivityCategoryRow; spots: ActivitySpotRow[] };
export type ValidatedActivitySpot = { name: string; lat: number; lon: number; notes: string };
export type ValidatedActivityCategory = { name: string; spots: ValidatedActivitySpot[] };

export function upsertPlanActivities(plan_id: number, categories: ValidatedActivityCategory[]): void {
  const db = getDb();
  db.withTransactionSync(() => {
    const existing = db.getAllSync<{ id: number }>(
      `SELECT id FROM plan_activity_categories WHERE plan_id = ?`, [plan_id]
    );
    for (const cat of existing) {
      db.runSync(`DELETE FROM plan_activity_spots WHERE category_id = ?`, [cat.id]);
    }
    db.runSync(`DELETE FROM plan_activity_categories WHERE plan_id = ?`, [plan_id]);
    for (let i = 0; i < categories.length; i++) {
      const { lastInsertRowId: catId } = db.runSync(
        `INSERT INTO plan_activity_categories (plan_id, name, sort_order) VALUES (?, ?, ?)`,
        [plan_id, categories[i].name, i]
      );
      for (const spot of categories[i].spots) {
        db.runSync(
          `INSERT INTO plan_activity_spots (category_id, name, lat, lon, notes) VALUES (?, ?, ?, ?, ?)`,
          [catId, spot.name, spot.lat, spot.lon, spot.notes]
        );
      }
    }
  });
}

export function deletePlan(plan_id: number): void {
  const db = getDb();
  db.withTransactionSync(() => {
    db.runSync(
      `DELETE FROM plan_activity_spots WHERE category_id IN
       (SELECT id FROM plan_activity_categories WHERE plan_id = ?)`, [plan_id]
    );
    db.runSync(`DELETE FROM plan_activity_categories WHERE plan_id = ?`, [plan_id]);
    db.runSync(`DELETE FROM plan_sleep_spots WHERE plan_id = ?`, [plan_id]);
    db.runSync(`DELETE FROM plan_bath_spots WHERE plan_id = ?`, [plan_id]);
    db.runSync(`DELETE FROM plans WHERE id = ?`, [plan_id]);
  });
}

export function getActivitiesForPlan(plan_id: number): ActivityCategoryWithSpots[] {
  const db = getDb();
  const categories = db.getAllSync<ActivityCategoryRow>(
    `SELECT id, plan_id, name, sort_order FROM plan_activity_categories
     WHERE plan_id = ? ORDER BY sort_order`, [plan_id]
  );
  return categories.map(cat => ({
    category: cat,
    spots: db.getAllSync<ActivitySpotRow>(
      `SELECT id, category_id, name, lat, lon, notes FROM plan_activity_spots
       WHERE category_id = ? ORDER BY id`, [cat.id]
    ),
  }));
}

export function getActivePlanActivities(): ActivityCategoryWithSpots[] {
  const db = getDb();
  const planRow = db.getFirstSync<{ id: number }>(
    `SELECT id FROM plans
     WHERE status IN ('current', 'upcoming')
     ORDER BY CASE status WHEN 'current' THEN 0 ELSE 1 END, created_at DESC
     LIMIT 1`
  );
  if (!planRow) return [];
  const categories = db.getAllSync<ActivityCategoryRow>(
    `SELECT id, plan_id, name, sort_order FROM plan_activity_categories
     WHERE plan_id = ? ORDER BY sort_order`, [planRow.id]
  );
  return categories.map(cat => ({
    category: cat,
    spots: db.getAllSync<ActivitySpotRow>(
      `SELECT id, category_id, name, lat, lon, notes FROM plan_activity_spots
       WHERE category_id = ? ORDER BY id`, [cat.id]
    ),
  }));
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

// ---------------------------------------------------------------------------
// Trip cost estimate
// ---------------------------------------------------------------------------
export type TripCostEstimate = {
  fuel: number | null;
  sleep: number;
  bath: number;
  food: number;
  parkEntry: number;
  buffer: number;
  totalLow: number;
  totalHigh: number;
  perDay: number;
  numDays: number;
  note: string;
};

// $4.80/gal = honest West/mountain avg — replace with GasBuddy API when available
const GAS_PRICE_PER_GALLON = 4.80;
const WEEKLY_BUFFER_RATE = 100 / 7; // $100/wk van life reality buffer, applied to high estimate only

function classifySleepCost(notes: string | null): number {
  const n = (notes ?? '').toLowerCase();
  if (/dispersed|blm|free/.test(n)) return 0;
  if (/campground|state park|forest/.test(n)) return 30;
  if (/rv park|hookup|resort/.test(n)) return 50;
  return 25;
}

function classifyBathCost(notes: string | null): number {
  const n = (notes ?? '').toLowerCase();
  if (/free|natural|hot spring/.test(n) && !/fee/.test(n)) return 0;
  if (/facility|public|pool|shower/.test(n)) return 8;
  return 5;
}

export function getTripCostEstimate(plan_id: number): TripCostEstimate | null {
  const db = getDb();

  const plan = db.getFirstSync<PlanRow>(`SELECT * FROM plans WHERE id = ?`, [plan_id]);
  if (!plan) return null;

  const sleepSpots = db.getAllSync<PlanSleepSpotRow>(
    `SELECT id, plan_id, name, lat, lon, notes, day_number FROM plan_sleep_spots WHERE plan_id = ? ORDER BY day_number`,
    [plan_id]
  );
  const bathSpots = db.getAllSync<PlanBathSpotRow>(
    `SELECT id, plan_id, name, lat, lon, notes, day_number FROM plan_bath_spots WHERE plan_id = ? ORDER BY day_number`,
    [plan_id]
  );
  const achievementNames = db.getAllSync<{ name: string }>(
    `SELECT DISTINCT name FROM achievements`
  ).map(r => r.name);

  const mpgStr = getSetting('vehicleMpg', '');
  const mpg = mpgStr ? parseFloat(mpgStr) : null;

  const sleep = sleepSpots.reduce((sum, s) => sum + classifySleepCost(s.notes), 0);
  const bath  = bathSpots.reduce((sum, s) => sum + classifyBathCost(s.notes), 0);

  const numDays = Math.max(sleepSpots.length + 1, 1);
  const food = numDays * 25;

  const fuel = mpg && mpg > 0 ? (plan.distance_miles / mpg) * GAS_PRICE_PER_GALLON : null;

  // Park entry: scan all text in the plan for national park / landmark references
  const corpus = [
    plan.notes ?? '',
    plan.origin,
    plan.destination,
    ...sleepSpots.flatMap(s => [s.name, s.notes ?? '']),
    ...bathSpots.flatMap(s => [s.name, s.notes ?? '']),
  ].join(' ').toLowerCase();

  const parkTriggers = ['national park', 'yellowstone', ...achievementNames];
  const hasParkEntry = parkTriggers.some(t => corpus.includes(t.toLowerCase()));
  const parkEntry = hasParkEntry ? 35 : 0;

  const base = (fuel ?? 0) + sleep + bath + food + parkEntry;
  const buffer = parseFloat((WEEKLY_BUFFER_RATE * numDays).toFixed(2));
  const totalLow  = parseFloat((base * 0.95).toFixed(2));
  const totalHigh = parseFloat(((base + buffer) * 1.10).toFixed(2));
  const perDay    = parseFloat(((totalLow + totalHigh) / 2 / numDays).toFixed(2));

  return {
    fuel,
    sleep,
    bath,
    food,
    parkEntry,
    buffer,
    totalLow,
    totalHigh,
    perDay,
    numDays,
    note: `Fuel est. at $${GAS_PRICE_PER_GALLON.toFixed(2)}/gal · $100/wk buffer included`,
  };
}
