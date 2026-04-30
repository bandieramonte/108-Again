import { db } from "@/database/db";

export type DeletedRecordRow = {
    id: string;
    entityType: "practice" | "session";
    recordId: string;
    userId: string | null;
    deletedAt: number;
    syncStatus: "pending" | "synced" | "failed";
    payload: string | null;
};

export function insertDeletedRecord(
    id: string,
    entityType: "practice" | "session",
    recordId: string,
    userId: string | null,
    deletedAt: number,
    syncStatus: "pending" | "synced" | "failed",
    payload: string | null = null
) {
    db.runSync(
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

export function getPendingDeletedRecords(userId: string) {
    return db.getAllSync(
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

export function markDeletedRecordSynced(id: string) {
    db.runSync(
        `
      UPDATE deleted_records
      SET syncStatus = 'synced'
      WHERE id = ?
    `,
        id
    );
}

export function getAllDeletedRecords() {
    return db.getAllSync(
        `
      SELECT id, entityType, recordId, userId, deletedAt, syncStatus, payload
      FROM deleted_records
      ORDER BY deletedAt DESC
    `
    ) as DeletedRecordRow[];
}

export function deleteDeletedRecord(id: string) {
    db.runSync(
        `DELETE FROM deleted_records WHERE id = ?`,
        id
    );
}

export function deleteAllDeletedRecords() {
    db.execSync(`DELETE FROM deleted_records`);
}

export function clearAllPendingDeletions(userId: string) {
    db.runSync(
        `DELETE FROM deleted_records 
         WHERE userId = ? AND syncStatus = 'pending'`,
        [userId]
    );
}