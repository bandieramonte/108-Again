import { db } from "@/database/db";
import * as practiceRepo from "@/repositories/practiceRepo";
import * as sessionRepo from "@/repositories/sessionRepo";
import { randomUUID } from "expo-crypto";

export function getBackupData() {

    const practices = practiceRepo.getAllPractices();

    const sessions = sessionRepo.getSessionsForBackup();

    return {
        practices,
        sessions
    };

}

export function restoreBackupData(data: any) {

    const backupPractices = data.practices ?? [];
    const sessions = data.sessions ?? [];

    db.execSync("BEGIN TRANSACTION");

    sessionRepo.deleteAllSessions();
    practiceRepo.deleteAllPractices();

    backupPractices.forEach((p: any) => {

        practiceRepo.insertPractice(
            p.id,
            p.name,
            p.targetCount,
            p.orderIndex,
            p.imageKey ?? null,
            p.defaultAddCount ?? 108
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
            s.isAdjustment ?? 0,
            s.affectsAnalytics ?? 1
        );

    });

    db.execSync("COMMIT");

}