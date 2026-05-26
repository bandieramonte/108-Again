import type { SqliteDatabase } from "../database/sqliteTypes";

export function createAppMetaRepo(database: SqliteDatabase) {
  function getMeta(key: string): string | null {

    const rows = database.getAllSync(
      `SELECT value FROM app_meta WHERE key = ?`,
      key
    ) as { value: string }[];

    return rows[0]?.value ?? null;
  }

  function setMeta(key: string, value: string) {

    database.runSync(
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

  function deleteMeta(key: string) {
    database.runSync(
      `DELETE FROM app_meta WHERE key = ?`,
      key
    );
  }

  function getLocalDataOwnerUserId(): string | null {
    return getMeta("localDataOwnerUserId");
  }

  function setLocalDataOwnerUserId(userId: string | null) {

    if (!userId) return;

    setMeta(
      "localDataOwnerUserId",
      userId
    );
  }

  function clearLocalDataOwnerUserId() {
    deleteMeta("localDataOwnerUserId");
  }

  return {
    clearLocalDataOwnerUserId,
    deleteMeta,
    getLocalDataOwnerUserId,
    getMeta,
    setLocalDataOwnerUserId,
    setMeta,
  };
}

export type AppMetaRepository = ReturnType<typeof createAppMetaRepo>;
