import { db } from "@/database/db";
import { enqueueWrite } from "@/database/writeQueue";
import * as practiceRepo from "@/repositories/practiceRepo";
import * as sessionRepo from "@/repositories/sessionRepo";
import * as authService from "@/services/authService";
import { MAX_PRACTICE_COUNT, MAX_REPETITIONS_PER_DAY, MAX_TARGET_COUNT } from "@/utils/numberUtils";

const BACKUP_APP_ID = "app108again";

export function getBackupData() {

    const practices = practiceRepo.getAllPractices();
    const sessions = sessionRepo.getAllSessionsForSync();

    return {
        app: BACKUP_APP_ID,
        exportedAt: Date.now(),
        practices,
        sessions
    };

}

function getBackupSyncMetadata() {
    const userId = authService.getCurrentUserId();
    const now = Date.now();

    return {
        userId,
        updatedAt: now,
        syncStatus: "pending" as const,
        lastSyncedAt: null,
    };
}

export async function restoreBackupData(data: any) {

    const backupPractices = Array.isArray(data?.practices)
        ? data.practices
        : [];

    const sessions = Array.isArray(data?.sessions)
        ? data.sessions
        : [];

    const syncMetadata = getBackupSyncMetadata();

    await enqueueWrite(() => {

        db.execSync("BEGIN TRANSACTION");

        try {

            sessionRepo.deleteAllSessions();
            practiceRepo.deleteAllPractices();

            backupPractices.forEach((p: any) => {

                practiceRepo.insertPractice(
                    p.id,
                    p.name,
                    p.targetCount,
                    p.orderIndex,
                    syncMetadata,
                    p.imageKey ?? null,
                    p.defaultAddCount ?? 108,
                    p.totalOffset ?? 0
                );

            });

            sessions.forEach((s: any) => {
                
                const id = s.id ?? `${s.practiceId}-${s.createdAt}`;
                sessionRepo.insertSession(
                    id,
                    s.practiceId,
                    s.count,
                    s.createdAt,
                    syncMetadata
                );

            });

            db.execSync("COMMIT");

        } catch (error) {

            db.execSync("ROLLBACK");
            throw error;

        }

    });

}

export function validateBackup(data: any) {

    if (!data || typeof data !== "object") {
        throw new Error("Invalid backup format");
    }

    if (data.app !== BACKUP_APP_ID) {
        throw new Error("Invalid backup file");
    }

    if (!Array.isArray(data.practices)) {
        throw new Error("Invalid practices data");
    }

    if (!Array.isArray(data.sessions)) {
        throw new Error("Invalid sessions data");
    }

    if (data.practices.length > MAX_PRACTICE_COUNT) {
        throw new Error("Too many practices in backup");
    }

    if (data.sessions.length > 10000) {
        throw new Error("Too many sessions in backup");
    }

    if (data.practices.length === 0) {
        throw new Error("Backup contains no practices");
    }

    for (const p of data.practices) {

        if (!p.id || typeof p.id !== "string") {
            throw new Error("Invalid practice id");
        }

        if (!p.name || typeof p.name !== "string") {
            throw new Error("Invalid practice name");
        }

        if (
            typeof p.targetCount !== "number" ||
            p.targetCount < 0 ||
            p.targetCount > MAX_TARGET_COUNT
        ) {
            throw new Error("Invalid target count");
        }

        if (
            typeof p.orderIndex !== "number" ||
            p.orderIndex < 0 ||
            p.orderIndex > MAX_PRACTICE_COUNT + 1
        ) {
            throw new Error("Invalid order index");
        }
    }

    for (const s of data.sessions) {

        if (typeof s.count !== "number" || s.count < 0 || s.count > MAX_REPETITIONS_PER_DAY) {
            throw new Error("Invalid session count");
        }

        if (typeof s.createdAt !== "number") {
            throw new Error("Invalid session date");
        }

        if (!s.practiceId || typeof s.practiceId !== "string") {
            throw new Error("Invalid session practiceId");
        }

        if (
            typeof s.createdAt !== "number" ||
            s.createdAt < 0 ||
            s.createdAt > Date.now() + 1000 * 60 * 60 * 24 * 365 * 10
        ) {
            throw new Error("Invalid session date");
        }
    }

    const orderIndexes = new Set();

    for (const p of data.practices) {

        if (orderIndexes.has(p.orderIndex)) {
            throw new Error("Duplicate practice order index");
        }

        orderIndexes.add(p.orderIndex);

    }
    
}