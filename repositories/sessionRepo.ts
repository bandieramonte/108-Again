import { db } from "../database/db";
import { SyncMetadata, SyncStatus } from "../types/sync";

export type SessionRow = {
    id: string;
    practiceId: string;
    count: number;
    createdAt: number;
    userId?: string | null;
    updatedAt?: number | null;
    syncStatus?: SyncStatus;
    lastSyncedAt?: number | null;
    deletedAt?: number | null;
};

type PracticeTotalRow = {
    total: number;
};

export function insertSession(
    id: string,
    practiceId: string,
    count: number,
    createdAt: number,
    syncMetadata: SyncMetadata 
) {
    db.runSync(
        `INSERT INTO sessions (
      id,
      practiceId,
      count,
      createdAt,
      userId,
      updatedAt,
      syncStatus,
      lastSyncedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        id,
        practiceId,
        count,
        createdAt,
        syncMetadata.userId,
        syncMetadata.updatedAt,
        syncMetadata.syncStatus,
        syncMetadata.lastSyncedAt
    );
}

export function markSessionSynced(
    id: string,
    lastSyncedAt: number,
    pushedUpdatedAt: number | null
) {
    db.runSync(
        `UPDATE sessions
     SET syncStatus = 'synced',
         lastSyncedAt = ?
     WHERE id = ?
       AND syncStatus IN ('pending', 'failed')
       AND (
         updatedAt = ?
         OR (updatedAt IS NULL AND ? IS NULL)
       )`,
        lastSyncedAt,
        id,
        pushedUpdatedAt,
        pushedUpdatedAt
    );
}

export function getDirtySessions(userId: string): SessionRow[] {
    return db.getAllSync(
        `SELECT
      id,
      practiceId,
      count,
      createdAt,
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
        `
        SELECT
            MAX(
                0,
                COALESCE((
                    SELECT SUM(count)
                    FROM sessions
                    WHERE practiceId = p.id
                ), 0) + COALESCE(p.totalOffset, 0)
            ) as total
        FROM practices p
        WHERE p.id = ?
        `,
        practiceId
    )[0] as PracticeTotalRow;
}

export function getDailyTotals(practiceId: string) {
    return db.getAllSync(
        `
    SELECT
      date(createdAt/1000,'unixepoch') as day,
      SUM(count) as total
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
    GROUP BY date(createdAt/1000,'unixepoch')
    HAVING COALESCE(SUM(count), 0) > 0
    ORDER BY day DESC
  `) as { day: string }[];
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
        userId,
        updatedAt,
        syncStatus,
        lastSyncedAt
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        practiceId = excluded.practiceId,
        count = excluded.count,
        createdAt = excluded.createdAt,
        userId = excluded.userId,
        updatedAt = excluded.updatedAt,
        syncStatus = 'synced',
        lastSyncedAt = excluded.lastSyncedAt
    `,
        row.id,
        row.practice_id,
        row.count,
        new Date(row.created_at).getTime(),
        row.user_id,
        new Date(row.updated_at).getTime(),
        "synced",
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

export function getSessionForDay(
    practiceId: string,
    date: string
): SessionRow | null {
    const rows = db.getAllSync(
        `
        SELECT
            id,
            practiceId,
            count,
            createdAt,
            userId,
            updatedAt,
            syncStatus,
            lastSyncedAt
        FROM sessions
        WHERE practiceId = ?
        AND date(createdAt/1000,'unixepoch') = ?
        LIMIT 1
        `,
        practiceId,
        date
    ) as SessionRow[];

    return rows[0] ?? null;
}

export function updateSessionCount(
    id: string,
    count: number,
    syncMetadata : SyncMetadata
) {
    db.runSync(
        `
        UPDATE sessions
        SET count = ?,
            userId = ?,
            updatedAt = ?,
            syncStatus = ?,
            lastSyncedAt = ?
        WHERE id = ?
        `,
        count,
        syncMetadata.userId,
        syncMetadata.updatedAt,
        syncMetadata.syncStatus,
        syncMetadata.lastSyncedAt,
        id
    );
}

export function getDeletedSessionForDay(
    practiceId: string,
    date: string
): SessionRow | null {
    return db.getAllSync(
        `
        SELECT *
        FROM sessions
        WHERE practiceId = ?
        AND date(createdAt/1000,'unixepoch') = ?
        AND deletedAt IS NOT NULL
        LIMIT 1
        `,
        practiceId,
        date
    )[0] as SessionRow | null;
}

export function reviveSession(
    id: string,
    count: number,
    syncMetadata : SyncMetadata
) {
    db.runSync(
        `
        UPDATE sessions
        SET 
          count = ?,
          deletedAt = NULL,
          userId = ?,
          updatedAt = ?,
          syncStatus = ?,
          lastSyncedAt = ?
        WHERE id = ?
        `,
        count,
        syncMetadata.userId,
        syncMetadata.updatedAt,
        syncMetadata.syncStatus,
        syncMetadata.lastSyncedAt,
        id
    );
}

export function softDeleteAllSessions(
    userId: string | null,
    updatedAt: number | null
) {
    db.runSync(
        `
        UPDATE sessions
        SET deletedAt = ?,
            userId = ?,
            updatedAt = ?,
            syncStatus = 'pending'
        `,
        Date.now(),
        userId,
        updatedAt
    );
}

export function markAllSessionsPending(userId: string, updatedAt: number) {
    db.runSync(`
        UPDATE sessions
        SET
            userId = ?,
            updatedAt = ?,
            syncStatus = 'pending',
            lastSyncedAt = NULL
    `, userId, updatedAt);
}

export function reassignAllSessionsToUser(userId: string, now: number) {
    db.runSync(`
        UPDATE sessions
        SET
            userId = ?,
            updatedAt = ?,
            syncStatus = 'pending',
            lastSyncedAt = NULL
    `, userId, now);
}

export function getPracticeLifetimeStats(practiceId: string) {
    const rows = getDailyTotals(practiceId);

    if (rows.length === 0) {
        return {
            averageSessionSize: 0,
            largestSession: 0,
            longestStreak: 0,
            currentStreak: 0,
        };
    }

    const totals = rows.map(r => r.total);

    const totalSum =
        totals.reduce((sum, n) => sum + n, 0);

    const averageSessionSize =
        Math.round(totalSum / rows.length);

    const largestSession =
        Math.max(...totals, 0);

    const sortedDays = rows
        .map(r => r.day)
        .sort();

    let longestStreak = 1;
    let currentRunningStreak = 1;

    for (let i = 1; i < sortedDays.length; i++) {
        const prev =
            new Date(sortedDays[i - 1] + "T00:00:00Z");

        const curr =
            new Date(sortedDays[i] + "T00:00:00Z");

        const diffDays = Math.round(
            (curr.getTime() - prev.getTime()) /
            (1000 * 60 * 60 * 24)
        );

        if (diffDays === 1) {
            currentRunningStreak++;
            longestStreak = Math.max(
                longestStreak,
                currentRunningStreak
            );
        } else {
            currentRunningStreak = 1;
        }
    }

    // current streak = streak ending today or yesterday
    let currentStreak = 0;

    const lastDay =
        sortedDays[sortedDays.length - 1];

    const lastDate =
        new Date(lastDay + "T00:00:00Z");

    const today =
        new Date();

    const todayUtc =
        new Date(Date.UTC(
            today.getUTCFullYear(),
            today.getUTCMonth(),
            today.getUTCDate()
        ));

    const diffFromToday = Math.round(
        (todayUtc.getTime() - lastDate.getTime()) /
        (1000 * 60 * 60 * 24)
    );

    if (diffFromToday <= 1) {
        currentStreak = 1;

        for (
            let i = sortedDays.length - 1;
            i > 0;
            i--
        ) {
            const curr =
                new Date(sortedDays[i] + "T00:00:00Z");

            const prev =
                new Date(sortedDays[i - 1] + "T00:00:00Z");

            const diffDays = Math.round(
                (curr.getTime() - prev.getTime()) /
                (1000 * 60 * 60 * 24)
            );

            if (diffDays === 1) {
                currentStreak++;
            } else {
                break;
            }
        }
    }

    return {
        averageSessionSize,
        largestSession,
        longestStreak,
        currentStreak,
    };
}

export function getEarliestSessionDateForPractice(
    practiceId: string
): number | null {

    const result = db.getFirstSync(
        `
        SELECT MIN(createdAt) as earliest
        FROM sessions
        WHERE practiceId = ?
        `,
        [practiceId]
    ) as { earliest: number | null } | null;
    return result?.earliest ?? null;
}
