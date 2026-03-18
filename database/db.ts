import * as SQLite from "expo-sqlite";

export const db = SQLite.openDatabaseSync("ngondro.db")

export function initializeDatabase() {

  db.execSync(`
  CREATE TABLE IF NOT EXISTS practices (
    id TEXT PRIMARY KEY,
    name TEXT,
    targetCount INTEGER,
    orderIndex INTEGER,
    imageKey TEXT,
    defaultAddCount INTEGER
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    practiceId TEXT,
    count INTEGER,
    createdAt INTEGER,
    isAdjustment INTEGER,
    affectsAnalytics INTEGER
  );
`);
}