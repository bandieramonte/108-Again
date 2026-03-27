import { db } from "../database/db";

export type PracticeRow = {
    id: string;
    name: string;
    targetCount: number;
    orderIndex: number;
    imageKey?: string | null;
    defaultAddCount?: number | null;
    userId?: string | null;
    updatedAt?: number | null;
    syncStatus?: "pending" | "synced" | "failed" | null;
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
    imageKey?: string | null,
    defaultAddCount: number = 108,
    userId: string | null = null,
    updatedAt: number | null = null,
    syncStatus: "pending" | "synced" | "failed" = "synced",
    lastSyncedAt: number | null = null
): void {
    db.runSync(
        `INSERT INTO practices (
      id,
      name,
      targetCount,
      orderIndex,
      imageKey,
      defaultAddCount,
      userId,
      updatedAt,
      syncStatus,
      lastSyncedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        id,
        name,
        target,
        orderIndex,
        imageKey ?? null,
        defaultAddCount,
        userId,
        updatedAt,
        syncStatus,
        lastSyncedAt
    );
}

export function updatePractice(
    id: string,
    name: string,
    target: number,
    updatedAt: number | null = null,
    syncStatus: "pending" | "synced" | "failed" | null = null
): void {
    if (updatedAt == null && syncStatus == null) {
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
         updatedAt = COALESCE(?, updatedAt),
         syncStatus = COALESCE(?, syncStatus)
     WHERE id = ?`,
        name,
        target,
        updatedAt,
        syncStatus,
        id
    );
}

export function updatePracticeDefaultAddCount(
    id: string,
    defaultAddCount: number,
    updatedAt: number | null = null,
    syncStatus: "pending" | "synced" | "failed" | null = null
): void {
    if (updatedAt == null && syncStatus == null) {
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
         updatedAt = COALESCE(?, updatedAt),
         syncStatus = COALESCE(?, syncStatus)
     WHERE id = ?`,
        defaultAddCount,
        updatedAt,
        syncStatus,
        id
    );
}

export function updatePracticeOrder(
    id: string,
    orderIndex: number,
    updatedAt: number | null = null,
    syncStatus: "pending" | "synced" | "failed" | null = null
): void {
    db.runSync(
        `UPDATE practices
     SET orderIndex = ?,
         updatedAt = COALESCE(?, updatedAt),
         syncStatus = COALESCE(?, syncStatus)
     WHERE id = ?`,
        orderIndex,
        updatedAt,
        syncStatus,
        id
    );
}

export function markPracticeSynced(id: string, lastSyncedAt: number): void {
    db.runSync(
        `UPDATE practices
     SET syncStatus = 'synced',
         lastSyncedAt = ?
     WHERE id = ?`,
        lastSyncedAt,
        id
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
        userId,
        updatedAt,
        syncStatus,
        lastSyncedAt
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'synced', ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        targetCount = excluded.targetCount,
        orderIndex = excluded.orderIndex,
        imageKey = excluded.imageKey,
        defaultAddCount = excluded.defaultAddCount,
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
        row.user_id,
        new Date(row.updated_at).getTime(),
        Date.now()
    );
}

export function backfillLegacyPracticesForUser(userId: string, now: number) {
    db.runSync(
        `
    UPDATE practices
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

export function resetAllSyncState() {
    db.runSync(`
        UPDATE practices
        SET
            userId = NULL,
            syncStatus = 'pending',
            lastSyncedAt = NULL
    `);
}