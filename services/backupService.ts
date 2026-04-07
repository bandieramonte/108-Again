import { db } from "@/database/db";
import { enqueueWrite } from "@/database/writeQueue";
import * as practiceRepo from "@/repositories/practiceRepo";
import * as sessionRepo from "@/repositories/sessionRepo";
import * as authService from "@/services/authService";
import { randomUUID } from "expo-crypto";

export function getBackupData() {

    const practices = practiceRepo.getAllPractices();
    const sessions = sessionRepo.getSessionsForBackup();

    return {
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
        syncStatus: userId ? ("pending" as const) : ("synced" as const),
        lastSyncedAt: userId ? null : now,
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

            const practices = practiceRepo.getAllPractices();

            const practiceMap: Record<number, string> = {};

            practices.forEach(p => {
                practiceMap[p.orderIndex] = p.id;
            });

            sessions.forEach((s: any) => {

                const practiceId = practiceMap[s.orderIndex];

                if (!practiceId) return;

                sessionRepo.insertSession(
                    randomUUID(),
                    practiceId,
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