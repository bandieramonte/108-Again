import { SqliteDatabase } from "./sqliteTypes";

function addColumnIfMissing(
  db: SqliteDatabase,
  tableName: string,
  columnName: string,
  columnSql: string
) {
  const columns = db.getAllSync(`PRAGMA table_info(${tableName})`) as {
    name: string;
  }[];

  const exists = columns.some((column) => column.name === columnName);

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
      defaultAddCount INTEGER,
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
  addColumnIfMissing(db, "practices", "defaultAddCount", "defaultAddCount INTEGER");
  addColumnIfMissing(db, "practices", "totalOffset", "totalOffset INTEGER");
  addColumnIfMissing(db, "practices", "userId", "userId TEXT");
  addColumnIfMissing(db, "practices", "updatedAt", "updatedAt INTEGER");
  addColumnIfMissing(db, "practices", "syncStatus", "syncStatus TEXT DEFAULT 'synced'");
  addColumnIfMissing(db, "practices", "lastSyncedAt", "lastSyncedAt INTEGER");

  addColumnIfMissing(db, "sessions", "userId", "userId TEXT");
  addColumnIfMissing(db, "sessions", "updatedAt", "updatedAt INTEGER");
  addColumnIfMissing(db, "sessions", "syncStatus", "syncStatus TEXT DEFAULT 'synced'");
  addColumnIfMissing(db, "sessions", "lastSyncedAt", "lastSyncedAt INTEGER");
  addColumnIfMissing(db, "sessions", "deletedAt", "deletedAt INTEGER");
}
