import * as SQLite from "expo-sqlite";
import { initializeDatabaseSchema } from "./schema";

export const db = SQLite.openDatabaseSync("ngondro.db");

export function initializeDatabase() {
  initializeDatabaseSchema(db);
}
