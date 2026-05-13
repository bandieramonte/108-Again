import { enqueueWrite } from "@/database/writeQueue";
import { randomUUID } from "expo-crypto";
import { db } from "../database/db";
import * as deletedRecordRepo from "../repositories/deletedRecordRepo";
import * as practiceRepo from "../repositories/practiceRepo";
import * as sessionRepo from "../repositories/sessionRepo";
import * as authService from "../services/authService";
import * as syncService from "../services/syncService";
import { SyncMetadata } from "../types/sync";
import { emitDataChanged } from "../utils/events";
import { MAX_TARGET_COUNT } from "../utils/numberUtils";

export function getWriteSyncMetadata() : SyncMetadata {
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
    const practices = practiceRepo.getAllPractices();

    if (practices.length >= 10) {
        throw new Error("Maximum of 10 practices reached.");
    }

    const orderResult = practiceRepo.getMaxOrderIndex();
    const nextOrder = (orderResult.maxOrder ?? 0) + 1;
    const syncMetadata = getWriteSyncMetadata();

    practiceRepo.insertPractice(
        randomUUID(),
        name,
        target,
        nextOrder,
        syncMetadata,
        null,
        defaultAddCount,
        0
    );

    emitDataChanged();
    void syncService.requestSync(syncMetadata.userId);
}

export function updatePractice(
    id: string,
    name: string,
    target: number,
    newTotal: number
) {

    if (newTotal > MAX_TARGET_COUNT) {
        throw new Error(
            `Total count cannot exceed ${MAX_TARGET_COUNT.toLocaleString()}`
        );
    }

    const currentTotal = sessionRepo.getPracticeTotal(id).total;
    const difference = newTotal - currentTotal;
    const syncMetadata = getWriteSyncMetadata();

    practiceRepo.updatePractice(
        id,
        name,
        target,
        syncMetadata
    );

if (difference !== 0) {
    const practice = practiceRepo.getPracticeById(id);

    const currentOffset = practice?.totalOffset ?? 0;
    const newOffset = currentOffset + difference;

    practiceRepo.updatePracticeTotalOffset(
        id,
        newOffset,
        syncMetadata
    );
}

    emitDataChanged();
    void syncService.requestSync(syncMetadata.userId);
}

export async function deletePractice(id: string) {

    const userId = authService.getCurrentUserId();
    const deletedAt = Date.now();

    await enqueueWrite(() => {

        db.execSync("BEGIN TRANSACTION");

        try {

            const practice = practiceRepo.getPracticeById(id);

            if (!practice) {
                throw new Error(`Practice not found: ${id}`);
            }

            const sessions =
                sessionRepo.getSessionsByPracticeForSync(id);

            const practiceExistsRemotely =
                !!practice.userId &&
                !!practice.lastSyncedAt;

            const deletionOwnerUserId =
                practice.userId;

            if (deletionOwnerUserId && practiceExistsRemotely) {
                // -------------------------
                // SESSION DELETIONS
                // -------------------------
                for (const session of sessions) {

                    const sessionExistsRemotely =
                        !!session.userId &&
                        !!session.lastSyncedAt;

                    if (!sessionExistsRemotely) continue;

                    deletedRecordRepo.insertDeletedRecord(
                        randomUUID(),
                        "session",
                        session.id,
                        deletionOwnerUserId,
                        deletedAt,
                        "pending",
                        JSON.stringify({
                            practiceId: session.practiceId,
                            createdAt: session.createdAt,
                        })
                    );
                }

                // -------------------------
                // PRACTICE DELETION
                // -------------------------
                deletedRecordRepo.insertDeletedRecord(
                    randomUUID(),
                    "practice",
                    id,
                    deletionOwnerUserId,
                    deletedAt,
                    "pending",
                    JSON.stringify({
                        name: practice.name,
                        targetCount: practice.targetCount,
                        orderIndex: practice.orderIndex,
                        imageKey: practice.imageKey ?? null,
                        defaultAddCount:
                            practice.defaultAddCount ?? 108,
                    })
                );
            }

            sessionRepo.deleteSessionsByPractice(id);
            practiceRepo.deletePractice(id);

            db.execSync("COMMIT");

        } catch (error) {

            db.execSync("ROLLBACK");
            throw error;

        }

    });

    emitDataChanged();
    void syncService.requestSync(userId);
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
    const syncMetadata = getWriteSyncMetadata();

    practiceRepo.updatePracticeDefaultAddCount(
        id,
        defaultAddCount,
        syncMetadata
    );

    emitDataChanged();
    void syncService.requestSync(syncMetadata.userId);
}

export function getExpectedTargetDate(
  targetCount: number,
  total: number,
  defaultAddCount?: number | null
): Date | null {

  const dailyAmount = defaultAddCount ?? 108;

  if (!Number.isFinite(dailyAmount) || dailyAmount <= 0) {
    return null;
  }

  const remaining = targetCount - total;

  if (remaining <= 0) {
    return new Date();
  }

  const daysNeeded =
    Math.ceil(remaining / dailyAmount);

  const targetDate = new Date();

  targetDate.setDate(
    targetDate.getDate() + daysNeeded
  );

  return targetDate;
}

export function calculateRequiredDailyCount(
    targetCount: number,
    total: number,
    targetDate: Date
) {
    const today = new Date();

    const diffDays = Math.ceil(
        (targetDate.getTime() - today.getTime()) /
        (1000 * 60 * 60 * 24)
    );

    if (diffDays <= 0) return targetCount - total;

    const remaining = targetCount - total;

    if (remaining <= 0) return 0;

    return Math.ceil(remaining / diffDays);
}