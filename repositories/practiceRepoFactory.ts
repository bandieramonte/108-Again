import type { SqliteDatabase } from "../database/sqliteTypes";
import type { SyncMetadata, SyncStatus } from "../types/sync";

export type PracticeRow = {
    id: string;
    name: string;
    targetCount: number;
    orderIndex: number;
    imageKey?: string | null;
    dailyTargetCount?: number | null;
    defaultSessionCount?: number | null;
    totalOffset?: number;
    userId?: string | null;
    updatedAt?: number | null;
    syncStatus?: SyncStatus;
    lastSyncedAt?: number | null;
};

type MaxOrderRow = {
    maxOrder: number | null;
};

export function createPracticeRepo(database: SqliteDatabase) {
    function getPracticeById(id: string): PracticeRow | null {
        const rows = database.getAllSync(
            `SELECT
      id,
      name,
      targetCount,
      orderIndex,
      imageKey,
      dailyTargetCount,
      defaultSessionCount,
      totalOffset,
      userId,
      updatedAt,
      syncStatus,
      lastSyncedAt
     FROM practices
     WHERE id = ?`,
            id
        ) as PracticeRow[];

        return rows[0] ?? null;
    }

    function getAllPractices(): PracticeRow[] {
        return database.getAllSync(
            `SELECT
      id,
      name,
      targetCount,
      orderIndex,
      imageKey,
      dailyTargetCount,
      defaultSessionCount,
      totalOffset,
      userId,
      updatedAt,
      syncStatus,
      lastSyncedAt
     FROM practices
     ORDER BY orderIndex`
        ) as PracticeRow[];
    }

    function insertPractice(
        id: string,
        name: string,
        target: number,
        orderIndex: number,
        syncMetadata: SyncMetadata,
        imageKey?: string | null,
        dailyTargetCount: number | null = null,
        defaultSessionCount: number = 108,
        totalOffset: number = 0,
    ): void {
        database.runSync(
            `INSERT INTO practices (
      id,
      name,
      targetCount,
      orderIndex,
      imageKey,
      dailyTargetCount,
      defaultSessionCount,
      totalOffset,
      userId,
      updatedAt,
      syncStatus,
      lastSyncedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            id,
            name,
            target,
            orderIndex,
            imageKey ?? null,
            dailyTargetCount,
            defaultSessionCount,
            totalOffset,
            syncMetadata.userId,
            syncMetadata.updatedAt,
            syncMetadata.syncStatus,
            syncMetadata.lastSyncedAt
        );
    }

    function updatePractice(
        id: string,
        name: string,
        target: number,
        syncMetadata : SyncMetadata
    ): void {
        if (syncMetadata.updatedAt == null && syncMetadata.syncStatus == null) {
            database.runSync(
                `UPDATE practices
       SET name = ?, targetCount = ?
       WHERE id = ?`,
                name,
                target,
                id
            );
            return;
        }

        database.runSync(
            `UPDATE practices
     SET name = ?,
         targetCount = ?,
         userId = ?,
         updatedAt = COALESCE(?, updatedAt),
         syncStatus = COALESCE(?, syncStatus),
         lastSyncedAt = ?
     WHERE id = ?`,
            name,
            target,
            syncMetadata.userId,
            syncMetadata.updatedAt,
            syncMetadata.syncStatus,
            syncMetadata.lastSyncedAt,
            id
        );
    }

    function updatePracticeDailyTargetCount(
        id: string,
        dailyTargetCount: number | null,
        syncMetadata: SyncMetadata
    ): void {
        if (syncMetadata.updatedAt == null && syncMetadata.syncStatus == null) {
            database.runSync(
                `UPDATE practices
       SET dailyTargetCount = ?
       WHERE id = ?`,
                dailyTargetCount,
                id
            );
            return;
        }

        database.runSync(
            `UPDATE practices
     SET dailyTargetCount = ?,
         userId = ?,
         updatedAt = COALESCE(?, updatedAt),
         syncStatus = COALESCE(?, syncStatus),
         lastSyncedAt = ?
     WHERE id = ?`,
            dailyTargetCount,
            syncMetadata.userId,
            syncMetadata.updatedAt,
            syncMetadata.syncStatus,
            syncMetadata.lastSyncedAt,
            id
        );
    }

    function updatePracticeDefaultSessionCount(
        id: string,
        defaultSessionCount: number,
        syncMetadata: SyncMetadata
    ): void {
        if (syncMetadata.updatedAt == null && syncMetadata.syncStatus == null) {
            database.runSync(
                `UPDATE practices
       SET defaultSessionCount = ?
       WHERE id = ?`,
                defaultSessionCount,
                id
            );
            return;
        }

        database.runSync(
            `UPDATE practices
     SET defaultSessionCount = ?,
         userId = ?,
         updatedAt = COALESCE(?, updatedAt),
         syncStatus = COALESCE(?, syncStatus),
         lastSyncedAt = ?
     WHERE id = ?`,
            defaultSessionCount,
            syncMetadata.userId,
            syncMetadata.updatedAt,
            syncMetadata.syncStatus,
            syncMetadata.lastSyncedAt,
            id
        );
    }

    function updatePracticeOrder(
        id: string,
        orderIndex: number,
        syncMetadata: SyncMetadata
    ): void {
        database.runSync(
            `UPDATE practices
     SET orderIndex = ?,
         userId = ?,
         updatedAt = COALESCE(?, updatedAt),
         syncStatus = COALESCE(?, syncStatus),
         lastSyncedAt = ?
     WHERE id = ?`,
            orderIndex,
            syncMetadata.userId,
            syncMetadata.updatedAt,
            syncMetadata.syncStatus,
            syncMetadata.lastSyncedAt,
            id
        );
    }

    function markPracticeSynced(
        id: string,
        lastSyncedAt: number,
        pushedUpdatedAt: number | null
    ): void {
        database.runSync(
            `UPDATE practices
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

    function getDirtyPractices(userId: string): PracticeRow[] {
        return database.getAllSync(
            `SELECT
      id,
      name,
      targetCount,
      orderIndex,
      imageKey,
      dailyTargetCount,
      defaultSessionCount,
      totalOffset,
      userId,
      updatedAt,
      syncStatus,
      lastSyncedAt
     FROM practices
     WHERE userId = ?
       AND syncStatus IN ('pending', 'failed')
     ORDER BY updatedAt ASC, orderIndex ASC`,
            userId
        ) as PracticeRow[];
    }

    function getMaxOrderIndex(): MaxOrderRow {
        return database.getAllSync(
            `SELECT MAX(orderIndex) as maxOrder FROM practices`
        )[0] as MaxOrderRow;
    }

    function getPracticeName(id: string) {
        const result = database.getAllSync(
            `SELECT name FROM practices WHERE id = ?`,
            id
        ) as { name: string }[];

        return result.length > 0 ? result[0].name : null;
    }

    function deletePractice(id: string): void {
        database.runSync(`DELETE FROM practices WHERE id = ?`, id);
    }

    function deleteAllPractices() {
        database.execSync(`DELETE FROM practices`);
    }

    function claimAnonymousPractices(userId: string, updatedAt: number) {
        database.runSync(
            `
      UPDATE practices
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

    function upsertPracticeFromRemote(row: {
        id: string;
        user_id: string;
        name: string;
        target_count: number;
        order_index: number;
        image_key: string | null;
        default_add_count: number;
        daily_target_count: number | null;
        default_session_count: number | null;
        total_offset: number;
        updated_at: string;
        deleted_at: string | null;
    }) {
        if (row.deleted_at) {
            database.runSync(`DELETE FROM practices WHERE id = ?`, row.id);
            return;
        }

        database.runSync(
            `
      INSERT INTO practices (
        id,
        name,
        targetCount,
        orderIndex,
        imageKey,
        dailyTargetCount,
        defaultSessionCount,
        totalOffset,
        userId,
        updatedAt,
        syncStatus,
        lastSyncedAt
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced', ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        targetCount = excluded.targetCount,
        orderIndex = excluded.orderIndex,
        imageKey = excluded.imageKey,
        dailyTargetCount = excluded.dailyTargetCount,
        defaultSessionCount = excluded.defaultSessionCount,
        totalOffset = excluded.totalOffset,
        userId = excluded.userId,
        updatedAt = excluded.updatedAt,
        syncStatus = 'synced',
        lastSyncedAt = excluded.lastSyncedAt
    `,
            row.id,
            row.name,
            row.target_count,
            row.order_index,
            row.image_key,
            row.daily_target_count,
            row.default_session_count ?? row.default_add_count ?? 108,
            row.total_offset ?? 0,
            row.user_id,
            new Date(row.updated_at).getTime(),
            Date.now()
        );
    }

    function resetAllSyncState() {
        database.runSync(`
        UPDATE practices
        SET
            userId = NULL,
            syncStatus = 'pending',
            lastSyncedAt = NULL
    `);
    }

    function updatePracticeTotalOffset(
        id: string,
        totalOffset: number,
        syncMetadata: SyncMetadata
    ) {
        database.runSync(
            `UPDATE practices
         SET totalOffset = ?,
             userId = ?,
             updatedAt = COALESCE(?, updatedAt),
             syncStatus = COALESCE(?, syncStatus),
             lastSyncedAt = ?
         WHERE id = ?`,
            totalOffset,
            syncMetadata.userId,
            syncMetadata.updatedAt,
            syncMetadata.syncStatus,
            syncMetadata.lastSyncedAt,
            id
        );
    }

    function resetPracticeTotals(userId: string | null, updatedAt: number) {
        database.runSync(`
        UPDATE practices
        SET
            totalOffset = 0,
            userId = ?,
            updatedAt = ?,
            syncStatus = 'pending',
            lastSyncedAt = NULL
    `, userId, updatedAt);
    }

    function markAllPracticesPending(userId: string, updatedAt: number) {
        database.runSync(`
        UPDATE practices
        SET
            userId = ?,
            updatedAt = ?,
            syncStatus = 'pending',
            lastSyncedAt = NULL
    `, userId, updatedAt);
    }

    function reassignAllPracticesToUser(userId: string, now: number) {
        database.runSync(`
        UPDATE practices
        SET
            userId = ?,
            updatedAt = ?,
            syncStatus = 'pending',
            lastSyncedAt = NULL
    `, userId, now);
    }

    return {
        claimAnonymousPractices,
        deleteAllPractices,
        deletePractice,
        getAllPractices,
        getDirtyPractices,
        getMaxOrderIndex,
        getPracticeById,
        getPracticeName,
        insertPractice,
        markAllPracticesPending,
        markPracticeSynced,
        reassignAllPracticesToUser,
        resetAllSyncState,
        resetPracticeTotals,
        updatePractice,
        updatePracticeDailyTargetCount,
        updatePracticeDefaultSessionCount,
        updatePracticeOrder,
        updatePracticeTotalOffset,
        upsertPracticeFromRemote,
    };
}

export type PracticeRepository = ReturnType<typeof createPracticeRepo>;
