import type { SqliteDatabase } from "../database/sqliteTypes";

export type DeletedRecordRow = {
    id: string;
    entityType: "practice" | "session";
    recordId: string;
    userId: string | null;
    deletedAt: number;
    syncStatus: "pending" | "synced" | "failed";
    payload: string | null;
};

export function createDeletedRecordRepo(database: SqliteDatabase) {
    function insertDeletedRecord(
        id: string,
        entityType: "practice" | "session",
        recordId: string,
        userId: string | null,
        deletedAt: number,
        syncStatus: "pending" | "synced" | "failed",
        payload: string | null = null
    ) {
        database.runSync(
            `
      INSERT INTO deleted_records (
        id,
        entityType,
        recordId,
        userId,
        deletedAt,
        syncStatus,
        payload
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
            id,
            entityType,
            recordId,
            userId,
            deletedAt,
            syncStatus,
            payload
        );
    }

    function getPendingDeletedRecords(userId: string) {
        return database.getAllSync(
            `
      SELECT id, entityType, recordId, userId, deletedAt, syncStatus, payload
      FROM deleted_records
      WHERE userId = ?
        AND syncStatus = 'pending'
      ORDER BY deletedAt ASC
    `,
            userId
        ) as DeletedRecordRow[];
    }

    function claimAnonymousDeletedRecords(userId: string) {
        database.runSync(
            `
      UPDATE deleted_records
      SET userId = ?
      WHERE userId IS NULL
        AND syncStatus IN ('pending', 'failed')
    `,
            userId
        );
    }

    function markDeletedRecordSynced(id: string) {
        database.runSync(
            `
      UPDATE deleted_records
      SET syncStatus = 'synced'
      WHERE id = ?
    `,
            id
        );
    }

    function getPendingDeletedRecordForRecord(
        userId: string,
        entityType: "practice" | "session",
        recordId: string
    ): DeletedRecordRow | null {
        const rows = database.getAllSync(
            `
      SELECT id, entityType, recordId, userId, deletedAt, syncStatus, payload
      FROM deleted_records
      WHERE userId = ?
        AND entityType = ?
        AND recordId = ?
        AND syncStatus IN ('pending', 'failed')
      ORDER BY deletedAt DESC
      LIMIT 1
    `,
            userId,
            entityType,
            recordId
        ) as DeletedRecordRow[];

        return rows[0] ?? null;
    }

    function getAllDeletedRecords() {
        return database.getAllSync(
            `
      SELECT id, entityType, recordId, userId, deletedAt, syncStatus, payload
      FROM deleted_records
      ORDER BY deletedAt DESC
    `
        ) as DeletedRecordRow[];
    }

    function deleteDeletedRecord(id: string) {
        database.runSync(
            `DELETE FROM deleted_records WHERE id = ?`,
            id
        );
    }

    function deleteAllDeletedRecords() {
        database.execSync(`DELETE FROM deleted_records`);
    }

    function clearAllPendingDeletions(userId: string) {
        database.runSync(
            `DELETE FROM deleted_records 
         WHERE userId = ? AND syncStatus = 'pending'`,
            [userId]
        );
    }

    return {
        claimAnonymousDeletedRecords,
        clearAllPendingDeletions,
        deleteAllDeletedRecords,
        deleteDeletedRecord,
        getAllDeletedRecords,
        getPendingDeletedRecordForRecord,
        getPendingDeletedRecords,
        insertDeletedRecord,
        markDeletedRecordSynced,
    };
}

export type DeletedRecordRepository =
    ReturnType<typeof createDeletedRecordRepo>;
