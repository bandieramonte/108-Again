import { SqliteDatabase } from "./sqliteTypes";

const DAILY_TARGET_OPTIONAL_MIGRATION_KEY =
  "dailyTargetOptionalMigrationApplied";

function getTableColumns(
  db: SqliteDatabase,
  tableName: string
) {
  return db.getAllSync(`PRAGMA table_info(${tableName})`) as {
    name: string;
  }[];
}

function hasColumn(
  db: SqliteDatabase,
  tableName: string,
  columnName: string
) {
  return getTableColumns(db, tableName)
    .some((column) => column.name === columnName);
}

function addColumnIfMissing(
  db: SqliteDatabase,
  tableName: string,
  columnName: string,
  columnSql: string
) {
  const exists = hasColumn(db, tableName, columnName);

  if (!exists) {
    db.execSync(`ALTER TABLE ${tableName} ADD COLUMN ${columnSql}`);
  }
}

export function initializeDatabaseSchema(db: SqliteDatabase) {
  db.execSync(`
    CREATE TABLE IF NOT EXISTS practices (
      id TEXT PRIMARY KEY,
      name TEXT,
      targetCount INTEGER,
      orderIndex INTEGER,
      imageKey TEXT,
      dailyTargetCount INTEGER,
      defaultSessionCount INTEGER,
      totalOffset INTEGER
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      practiceId TEXT,
      count INTEGER,
      createdAt INTEGER,
      userId TEXT,
      updatedAt INTEGER,
      syncStatus TEXT,
      lastSyncedAt INTEGER,
      deletedAt INTEGER
    );

    CREATE TABLE IF NOT EXISTS user_profile (
      userId TEXT PRIMARY KEY,
      email TEXT,
      firstName TEXT,
      updatedAt INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS deleted_records (
      id TEXT PRIMARY KEY,
      entityType TEXT NOT NULL,
      recordId TEXT NOT NULL,
      userId TEXT,
      deletedAt INTEGER NOT NULL,
      syncStatus TEXT NOT NULL,
      payload TEXT
    );

    CREATE TABLE IF NOT EXISTS app_meta (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);

  addColumnIfMissing(db, "practices", "imageKey", "imageKey TEXT");
  addColumnIfMissing(db, "practices", "dailyTargetCount", "dailyTargetCount INTEGER");
  addColumnIfMissing(db, "practices", "defaultSessionCount", "defaultSessionCount INTEGER");
  addColumnIfMissing(db, "practices", "totalOffset", "totalOffset INTEGER");
  addColumnIfMissing(db, "practices", "userId", "userId TEXT");
  addColumnIfMissing(db, "practices", "updatedAt", "updatedAt INTEGER");
  addColumnIfMissing(db, "practices", "syncStatus", "syncStatus TEXT DEFAULT 'synced'");
  addColumnIfMissing(db, "practices", "lastSyncedAt", "lastSyncedAt INTEGER");

  if (hasColumn(db, "practices", "defaultAddCount")) {
    db.execSync(`
      UPDATE practices
      SET defaultSessionCount = COALESCE(defaultSessionCount, defaultAddCount, 108)
      WHERE defaultSessionCount IS NULL;
    `);
  }

  db.execSync(`
    UPDATE practices
    SET defaultSessionCount = COALESCE(defaultSessionCount, 108)
    WHERE defaultSessionCount IS NULL;
  `);

  const optionalDailyTargetMigration =
    db.getAllSync(
      `SELECT value FROM app_meta WHERE key = ?`,
      DAILY_TARGET_OPTIONAL_MIGRATION_KEY
    )[0] as { value: string } | undefined;

  if (!optionalDailyTargetMigration) {
    db.execSync(`
      UPDATE practices
      SET dailyTargetCount = NULL;
    `);
    db.runSync(
      `INSERT OR REPLACE INTO app_meta (key, value) VALUES (?, ?)`,
      DAILY_TARGET_OPTIONAL_MIGRATION_KEY,
      "true"
    );
  }

  addColumnIfMissing(db, "sessions", "userId", "userId TEXT");
  addColumnIfMissing(db, "sessions", "updatedAt", "updatedAt INTEGER");
  addColumnIfMissing(db, "sessions", "syncStatus", "syncStatus TEXT DEFAULT 'synced'");
  addColumnIfMissing(db, "sessions", "lastSyncedAt", "lastSyncedAt INTEGER");
  addColumnIfMissing(db, "sessions", "deletedAt", "deletedAt INTEGER");
}
