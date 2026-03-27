import { db } from "../database/db";

export type SessionRow = {
    id: string;
    practiceId: string;
    count: number;
    createdAt: number;
    isAdjustment?: number;
    affectsAnalytics?: number;
    userId?: string | null;
    updatedAt?: number | null;
    syncStatus?: "pending" | "synced" | "failed" | null;
    lastSyncedAt?: number | null;
};

type PracticeTotalRow = {
    total: number;
};

export function insertSession(
    id: string,
    practiceId: string,
    count: number,
    createdAt: number,
    isAdjustment: number = 0,
    affectsAnalytics: number = 1,
    userId: string | null = null,
    updatedAt: number | null = null,
    syncStatus: "pending" | "synced" | "failed" = "synced",
    lastSyncedAt: number | null = null
) {
    db.runSync(
        `INSERT INTO sessions (
      id,
      practiceId,
      count,
      createdAt,
      isAdjustment,
      affectsAnalytics,
      userId,
      updatedAt,
      syncStatus,
      lastSyncedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        id,
        practiceId,
        count,
        createdAt,
        isAdjustment,
        affectsAnalytics,
        userId,
        updatedAt,
        syncStatus,
        lastSyncedAt
    );
}

export function markSessionSynced(id: string, lastSyncedAt: number) {
    db.runSync(
        `UPDATE sessions
     SET syncStatus = 'synced',
         lastSyncedAt = ?
     WHERE id = ?`,
        lastSyncedAt,
        id
    );
}

export function getDirtySessions(userId: string): SessionRow[] {
    return db.getAllSync(
        `SELECT
      id,
      practiceId,
      count,
      createdAt,
      isAdjustment,
      affectsAnalytics,
      userId,
      updatedAt,
      syncStatus,
      lastSyncedAt
     FROM sessions
     WHERE userId = ?
       AND syncStatus IN ('pending', 'failed')
     ORDER BY updatedAt ASC, createdAt ASC`,
        userId
    ) as SessionRow[];
}

export function getSessionsByPractice(practiceId: string): SessionRow[] {
    return db.getAllSync(
        `SELECT
      id,
      practiceId,
      count,
      createdAt,
      isAdjustment,
      affectsAnalytics,
      userId,
      updatedAt,
      syncStatus,
      lastSyncedAt
     FROM sessions
     WHERE practiceId = ?
     ORDER BY createdAt DESC`,
        practiceId
    ) as SessionRow[];
}

export function deleteSessionsByPractice(practiceId: string): void {
    db.runSync(`DELETE FROM sessions WHERE practiceId = ?`, practiceId);
}

export function getSessionsByPracticeForSync(practiceId: string): SessionRow[] {
    return db.getAllSync(
        `SELECT
      id,
      practiceId,
      count,
      createdAt,
      isAdjustment,
      affectsAnalytics,
      userId,
      updatedAt,
      syncStatus,
      lastSyncedAt
     FROM sessions
     WHERE practiceId = ?
     ORDER BY createdAt ASC`,
        practiceId
    ) as SessionRow[];
}

export function getPracticeTotal(practiceId: string): PracticeTotalRow {
    return db.getAllSync(
        `SELECT MAX(0, COALESCE(SUM(count), 0)) as total
        FROM sessions
        WHERE practiceId = ?`,
        practiceId
    )[0] as PracticeTotalRow;
}

export function getDailyTotals(practiceId: string) {
    return db.getAllSync(
        `
    SELECT
      date(createdAt/1000,'unixepoch') as day,
      SUM(CASE WHEN affectsAnalytics = 1 THEN count ELSE 0 END) as total
    FROM sessions
    WHERE practiceId = ?
    GROUP BY day
  `,
        practiceId
    ) as { day: string; total: number }[];
}

export function getSessionsForBackup() {
    return db.getAllSync(`
    SELECT
      s.count,
      s.createdAt,
      s.isAdjustment,
      s.affectsAnalytics,
      p.name AS practiceName,
      p.orderIndex
    FROM sessions s
    JOIN practices p
      ON s.practiceId = p.id
  `);
}

export function deleteAllSessions() {
    db.execSync(`DELETE FROM sessions`);
}

export function getSessionDays() {
    return db.getAllSync(`
    SELECT
      date(createdAt/1000,'unixepoch') as day
    FROM sessions
    WHERE COALESCE(affectsAnalytics,1) = 1
    GROUP BY date(createdAt/1000,'unixepoch')
    HAVING COALESCE(SUM(count), 0) > 0
    ORDER BY day DESC
  `) as { day: string }[];
}

export function getDailyTotalsWithAdjustments(practiceId: string) {
    return db.getAllSync(
        `
    SELECT
      date(createdAt/1000,'unixepoch') as day,
      SUM(
        CASE
          WHEN isAdjustment = 0 OR affectsAnalytics = 1
          THEN count
          ELSE 0
        END
      ) as total
    FROM sessions
    WHERE practiceId = ?
    GROUP BY day
  `,
        practiceId
    ) as { day: string; total: number }[];
}

export function claimAnonymousSessions(userId: string, updatedAt: number) {
    db.runSync(
        `
      UPDATE sessions
      SET userId = ?,
          updatedAt = COALESCE(updatedAt, ?),
          syncStatus = 'pending',
          lastSyncedAt = NULL
      WHERE userId IS NULL
    `,
        userId,
        updatedAt
    );
}

export function deleteSessionById(id: string) {
    db.runSync(`DELETE FROM sessions WHERE id = ?`, id);
}

export function upsertSessionFromRemote(row: {
    id: string;
    user_id: string;
    practice_id: string;
    count: number;
    created_at: string;
    is_adjustment: boolean;
    affects_analytics: boolean;
    updated_at: string;
    deleted_at: string | null;
}) {
    if (row.deleted_at) {
        db.runSync(`DELETE FROM sessions WHERE id = ?`, row.id);
        return;
    }

    db.runSync(
        `
      INSERT INTO sessions (
        id,
        practiceId,
        count,
        createdAt,
        isAdjustment,
        affectsAnalytics,
        userId,
        updatedAt,
        syncStatus,
        lastSyncedAt
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'synced', ?)
      ON CONFLICT(id) DO UPDATE SET
        practiceId = excluded.practiceId,
        count = excluded.count,
        createdAt = excluded.createdAt,
        isAdjustment = excluded.isAdjustment,
        affectsAnalytics = excluded.affectsAnalytics,
        userId = excluded.userId,
        updatedAt = excluded.updatedAt,
        syncStatus = 'synced',
        lastSyncedAt = excluded.lastSyncedAt
    `,
        row.id,
        row.practice_id,
        row.count,
        new Date(row.created_at).getTime(),
        row.is_adjustment ? 1 : 0,
        row.affects_analytics ? 1 : 0,
        row.user_id,
        new Date(row.updated_at).getTime(),
        Date.now()
    );
}

export function backfillLegacySessionsForUser(userId: string, now: number) {
    db.runSync(
        `
    UPDATE sessions
    SET
      userId = ?,
      updatedAt = COALESCE(updatedAt, ?),
      syncStatus = 'pending',
      lastSyncedAt = NULL
    WHERE
      userId IS NULL
      OR lastSyncedAt IS NULL
    `,
        userId,
        now
    );
}

export function getAllSessionsForSync(): SessionRow[] {
    return db.getAllSync(
        `SELECT
      id,
      practiceId,
      count,
      createdAt,
      isAdjustment,
      affectsAnalytics,
      userId,
      updatedAt,
      syncStatus,
      lastSyncedAt
     FROM sessions`
    ) as SessionRow[];
}

export function resetAllSyncState() {
    db.runSync(`
        UPDATE sessions
        SET
            userId = NULL,
            syncStatus = 'pending',
            lastSyncedAt = NULL
    `);
}