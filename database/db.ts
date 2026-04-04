import * as SQLite from "expo-sqlite";

export const db = SQLite.openDatabaseSync("ngondro.db");

function addColumnIfMissing(tableName: string, columnName: string, columnSql: string) {
  const columns = db.getAllSync(`PRAGMA table_info(${tableName})`) as {
    name: string;
  }[];

  const exists = columns.some((column) => column.name === columnName);

  if (!exists) {
    db.execSync(`ALTER TABLE ${tableName} ADD COLUMN ${columnSql}`);
  }
}

export function initializeDatabase() {
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


  addColumnIfMissing("practices", "imageKey", "imageKey TEXT");
  addColumnIfMissing("practices", "defaultAddCount", "defaultAddCount INTEGER");
  addColumnIfMissing("practices", "totalOffset", "totalOffset INTEGER");
  addColumnIfMissing("practices", "userId", "userId TEXT");
  addColumnIfMissing("practices", "updatedAt", "updatedAt INTEGER");
  addColumnIfMissing("practices", "syncStatus", "syncStatus TEXT DEFAULT 'synced'");
  addColumnIfMissing("practices", "lastSyncedAt", "lastSyncedAt INTEGER");

  addColumnIfMissing("sessions", "userId", "userId TEXT");
  addColumnIfMissing("sessions", "updatedAt", "updatedAt INTEGER");
  addColumnIfMissing("sessions", "syncStatus", "syncStatus TEXT DEFAULT 'synced'");
  addColumnIfMissing("sessions", "lastSyncedAt", "lastSyncedAt INTEGER");
  addColumnIfMissing("sessions", "deletedAt", "deletedAt INTEGER");
}