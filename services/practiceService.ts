import { randomUUID } from "expo-crypto";
import { db } from "../database/db";
import * as deletedRecordRepo from "../repositories/deletedRecordRepo";
import * as practiceRepo from "../repositories/practiceRepo";
import * as sessionRepo from "../repositories/sessionRepo";
import * as authService from "../services/authService";
import * as syncService from "../services/syncService";
import { emitDataChanged } from "../utils/events";

function getWriteSyncMetadata() {
    const userId = authService.getCurrentUserId();
    const now = Date.now();

    return {
        userId,
        updatedAt: now,
        syncStatus: userId ? ("pending" as const) : ("synced" as const),
        lastSyncedAt: userId ? null : now,
    };
}

export function createPractice(
    name: string,
    target: number,
    defaultAddCount: number = 108
) {
    const orderResult = practiceRepo.getMaxOrderIndex();
    const nextOrder = (orderResult.maxOrder ?? 0) + 1;
    const sync = getWriteSyncMetadata();

    practiceRepo.insertPractice(
        randomUUID(),
        name,
        target,
        nextOrder,
        null,
        defaultAddCount,
        sync.userId,
        sync.updatedAt,
        sync.syncStatus,
        sync.lastSyncedAt
    );

    emitDataChanged();
    void syncService.requestSync(sync.userId);
}

export function updatePractice(
    id: string,
    name: string,
    target: number,
    newTotal: number
) {
    const currentTotalResult = sessionRepo.getPracticeTotal(id);
    const currentTotal = currentTotalResult.total;
    const difference = newTotal - currentTotal;
    const sync = getWriteSyncMetadata();

    practiceRepo.updatePractice(
        id,
        name,
        target,
        sync.updatedAt,
        sync.syncStatus
    );

    if (difference !== 0) {
        sessionRepo.insertSession(
            randomUUID(),
            id,
            difference,
            Date.now(),
            1,
            0,
            sync.userId,
            sync.updatedAt,
            sync.syncStatus,
            sync.lastSyncedAt
        );
    }

    emitDataChanged();
    void syncService.requestSync(sync.userId);
}

export function deletePractice(id: string) {
    const userId = authService.getCurrentUserId();
    const deletedAt = Date.now();

    db.execSync("BEGIN TRANSACTION");

    try {
        const practice = practiceRepo.getPracticeById(id);

        if (!practice) {
            throw new Error(`Practice not found: ${id}`);
        }

        const sessions = sessionRepo.getSessionsByPracticeForSync(id);

        const practiceExistsRemotely =
            !!practice.userId && !!practice.lastSyncedAt;

        if (userId && practiceExistsRemotely) {

            // -------------------------
            // SESSION DELETIONS
            // -------------------------
            for (const session of sessions) {
                const sessionExistsRemotely =
                    !!session.userId && !!session.lastSyncedAt;

                if (!sessionExistsRemotely) continue;

                deletedRecordRepo.insertDeletedRecord(
                    randomUUID(),
                    "session",
                    session.id,
                    userId,
                    deletedAt,
                    "pending",
                    JSON.stringify({
                        practiceId: session.practiceId,
                        createdAt: session.createdAt,
                    })
                );
            }

            // -------------------------
            // PRACTICE DELETION (ONCE)
            // -------------------------
            deletedRecordRepo.insertDeletedRecord(
                randomUUID(),
                "practice",
                id,
                userId,
                deletedAt,
                "pending",
                JSON.stringify({
                    name: practice.name,
                    targetCount: practice.targetCount,
                    orderIndex: practice.orderIndex,
                    imageKey: practice.imageKey ?? null,
                    defaultAddCount: practice.defaultAddCount ?? 108,
                })
            );
        }

        sessionRepo.deleteSessionsByPractice(id);
        practiceRepo.deletePractice(id);

        db.execSync("COMMIT");
        emitDataChanged();
        void syncService.requestSync(userId);
    } catch (error) {
        db.execSync("ROLLBACK");
        throw error;
    }
}

export function getPracticeEditData(id: string) {
    const practice = practiceRepo.getPracticeById(id);

    if (!practice) {
        throw new Error(`Practice not found: ${id}`);
    }

    const totalResult = sessionRepo.getPracticeTotal(id);

    return {
        name: practice.name,
        targetCount: practice.targetCount,
        total: totalResult.total,
        defaultAddCount: practice.defaultAddCount ?? 108,
    };
}

export function getPracticeName(id: string) {
    return practiceRepo.getPracticeName(id);
}

export function getPractice(id: string) {
    return practiceRepo.getPracticeById(id);
}

export function getAllPractices() {
    return practiceRepo.getAllPractices();
}

export function updatePracticeDefaultAddCount(
    id: string,
    defaultAddCount: number
) {
    const sync = getWriteSyncMetadata();

    practiceRepo.updatePracticeDefaultAddCount(
        id,
        defaultAddCount,
        sync.updatedAt,
        sync.syncStatus
    );

    emitDataChanged();
    void syncService.requestSync(sync.userId);
}