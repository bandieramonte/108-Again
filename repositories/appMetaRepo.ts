import { db } from "../database/db";

export function getMeta(key: string): string | null {

  const rows = db.getAllSync(
    `SELECT value FROM app_meta WHERE key = ?`,
    key
  ) as { value: string }[];

  return rows[0]?.value ?? null;
}

export function setMeta(key: string, value: string) {

  db.runSync(
    `
    INSERT INTO app_meta (key, value)
    VALUES (?, ?)
    ON CONFLICT(key)
    DO UPDATE SET value = excluded.value
    `,
    key,
    value
  );
}