import { db } from "../database/db";
import { SyncMetadata, SyncStatus } from "../types/sync";

export type PracticeRow = {
    id: string;
    name: string;
    targetCount: number;
    orderIndex: number;
    imageKey?: string | null;
    defaultAddCount?: number | null;
    totalOffset?: number;
    userId?: string | null;
    updatedAt?: number | null;
    syncStatus?: SyncStatus;
    lastSyncedAt?: number | null;
};

type MaxOrderRow = {
    maxOrder: number | null;
};

export function getPracticeById(id: string): PracticeRow | null {
    const rows = db.getAllSync(
        `SELECT
      id,
      name,
      targetCount,
      orderIndex,
      imageKey,
      defaultAddCount,
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

export function getAllPractices(): PracticeRow[] {
    return db.getAllSync(
        `SELECT
      id,
      name,
      targetCount,
      orderIndex,
      imageKey,
      defaultAddCount,
      totalOffset,
      userId,
      updatedAt,
      syncStatus,
      lastSyncedAt
     FROM practices
     ORDER BY orderIndex`
    ) as PracticeRow[];
}

export function insertPractice(
    id: string,
    name: string,
    target: number,
    orderIndex: number,
    syncMetadata: SyncMetadata,
    imageKey?: string | null,
    defaultAddCount: number = 108,
    totalOffset: number = 0,
): void {
    db.runSync(
        `INSERT INTO practices (
      id,
      name,
      targetCount,
      orderIndex,
      imageKey,
      defaultAddCount,
      totalOffset,
      userId,
      updatedAt,
      syncStatus,
      lastSyncedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        id,
        name,
        target,
        orderIndex,
        imageKey ?? null,
        defaultAddCount,
        totalOffset,
        syncMetadata.userId,
        syncMetadata.updatedAt,
        syncMetadata.syncStatus,
        syncMetadata.lastSyncedAt
    );
}

export function updatePractice(
    id: string,
    name: string,
    target: number,
    syncMetadata : SyncMetadata
): void {
    if (syncMetadata.updatedAt == null && syncMetadata.syncStatus == null) {
        db.runSync(
            `UPDATE practices
       SET name = ?, targetCount = ?
       WHERE id = ?`,
            name,
            target,
            id
        );
        return;
    }

    db.runSync(
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

export function updatePracticeDefaultAddCount(
    id: string,
    defaultAddCount: number,
    syncMetadata: SyncMetadata
): void {
    if (syncMetadata.updatedAt == null && syncMetadata.syncStatus == null) {
        db.runSync(
            `UPDATE practices
       SET defaultAddCount = ?
       WHERE id = ?`,
            defaultAddCount,
            id
        );
        return;
    }

    db.runSync(
        `UPDATE practices
     SET defaultAddCount = ?,
         userId = ?,
         updatedAt = COALESCE(?, updatedAt),
         syncStatus = COALESCE(?, syncStatus),
         lastSyncedAt = ?
     WHERE id = ?`,
        defaultAddCount,
        syncMetadata.userId,
        syncMetadata.updatedAt,
        syncMetadata.syncStatus,
        syncMetadata.lastSyncedAt,
        id
    );
}

export function updatePracticeOrder(
    id: string,
    orderIndex: number,
    syncMetadata: SyncMetadata
): void {
    db.runSync(
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

export function markPracticeSynced(
    id: string,
    lastSyncedAt: number,
    pushedUpdatedAt: number | null
): void {
    db.runSync(
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

export function getDirtyPractices(userId: string): PracticeRow[] {
    return db.getAllSync(
        `SELECT
      id,
      name,
      targetCount,
      orderIndex,
      imageKey,
      defaultAddCount,
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

export function getMaxOrderIndex(): MaxOrderRow {
    return db.getAllSync(
        `SELECT MAX(orderIndex) as maxOrder FROM practices`
    )[0] as MaxOrderRow;
}

export function getPracticeName(id: string) {
    const result = db.getAllSync(
        `SELECT name FROM practices WHERE id = ?`,
        id
    ) as { name: string }[];

    return result.length > 0 ? result[0].name : null;
}

export function deletePractice(id: string): void {
    db.runSync(`DELETE FROM practices WHERE id = ?`, id);
}

export function deleteAllPractices() {
    db.execSync(`DELETE FROM practices`);
}

export function claimAnonymousPractices(userId: string, updatedAt: number) {
    db.runSync(
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

export function upsertPracticeFromRemote(row: {
    id: string;
    user_id: string;
    name: string;
    target_count: number;
    order_index: number;
    image_key: string | null;
    default_add_count: number;
    total_offset: number;
    updated_at: string;
    deleted_at: string | null;
}) {
    if (row.deleted_at) {
        db.runSync(`DELETE FROM practices WHERE id = ?`, row.id);
        return;
    }

    db.runSync(
        `
      INSERT INTO practices (
        id,
        name,
        targetCount,
        orderIndex,
        imageKey,
        defaultAddCount,
        totalOffset,
        userId,
        updatedAt,
        syncStatus,
        lastSyncedAt
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced', ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        targetCount = excluded.targetCount,
        orderIndex = excluded.orderIndex,
        imageKey = excluded.imageKey,
        defaultAddCount = excluded.defaultAddCount,
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
        row.default_add_count,
        row.total_offset ?? 0,
        row.user_id,
        new Date(row.updated_at).getTime(),
        Date.now()
    );
}

export function resetAllSyncState() {
    db.runSync(`
        UPDATE practices
        SET
            userId = NULL,
            syncStatus = 'pending',
            lastSyncedAt = NULL
    `);
}

export function updatePracticeTotalOffset(
    id: string,
    totalOffset: number,
    syncMetadata: SyncMetadata
) {
    db.runSync(
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

export function resetPracticeTotals(userId: string | null, updatedAt: number) {
    db.runSync(`
        UPDATE practices
        SET
            totalOffset = 0,
            userId = ?,
            updatedAt = ?,
            syncStatus = 'pending',
            lastSyncedAt = NULL
    `, userId, updatedAt);
}

export function markAllPracticesPending(userId: string, updatedAt: number) {
    db.runSync(`
        UPDATE practices
        SET
            userId = ?,
            updatedAt = ?,
            syncStatus = 'pending',
            lastSyncedAt = NULL
    `, userId, updatedAt);
}

export function reassignAllPracticesToUser(userId: string, now: number) {
    db.runSync(`
        UPDATE practices
        SET
            userId = ?,
            updatedAt = ?,
            syncStatus = 'pending',
            lastSyncedAt = NULL
    `, userId, now);
}
