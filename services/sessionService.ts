import { randomUUID } from "expo-crypto";
import * as practiceRepo from "../repositories/practiceRepo";
import * as sessionRepo from "../repositories/sessionRepo";
import * as appService from "../services/appService";
import * as authService from "../services/authService";
import * as syncService from "../services/syncService";
import { SyncMetadata } from "../types/sync";
import { emitDataChanged } from "../utils/events";
import { MAX_TARGET_COUNT } from "../utils/numberUtils";
import * as practiceService from "./practiceService";

function getWriteSyncMetadata() : SyncMetadata  {
    const userId = authService.getCurrentUserId();
    const now = Date.now();

    return {
        userId,
        updatedAt: now,
        syncStatus: userId ? ("pending" as const) : ("synced" as const),
        lastSyncedAt: userId ? null : now,
    };
}

export type AddedSessionResult = {
    id: string;
    practiceId: string;
    count: number;
    createdAt: number;
};

export function addSession(practiceId: string, count: number) {

    const practice = practiceService.getPracticeEditData(practiceId);

    if (!practice) {
        throw new Error("Practice not found");
    }

    const newTotal = practice.total + count;

    if (newTotal > MAX_TARGET_COUNT) {
        throw new Error(
            `Total count cannot exceed ${MAX_TARGET_COUNT.toLocaleString()}`
        );
    }

    const syncMetadata = getWriteSyncMetadata();
    const today = new Date();
    const dayString =
        today.getUTCFullYear() +
        "-" +
        String(today.getUTCMonth() + 1).padStart(2, "0") +
        "-" +
        String(today.getUTCDate()).padStart(2, "0");

    const existing = sessionRepo.getSessionForDay(
        practiceId,
        dayString
    );

    if (existing) {
        const newCount = existing.count + count;

        sessionRepo.updateSessionCount(
            existing.id,
            newCount,
            syncMetadata
        );
    } else {
        
        const deleted = sessionRepo.getDeletedSessionForDay(practiceId, dayString);

        if (deleted) {
            sessionRepo.reviveSession(
                deleted.id,
                count,
                syncMetadata
            );
        } else {
            sessionRepo.insertSession(
                randomUUID(),
                practiceId,
                count,
                Date.now(),
                syncMetadata
            );    
        }
    }

    emitDataChanged();
    appService.markActive();
    void syncService.requestSync(syncMetadata.userId);
}

export function getSessionsForPractice(practiceId: string) {
    return sessionRepo.getSessionsByPractice(practiceId);
}

export function getDailyPracticeData(practiceId: string, days: number) {
    const rows = sessionRepo.getDailyTotals(practiceId);
    const today = new Date();
    const result: { date: string; total: number }[] = [];

    for (let i = days - 1; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);

        const dayString =
            d.getUTCFullYear() +
            "-" +
            String(d.getUTCMonth() + 1).padStart(2, "0") +
            "-" +
            String(d.getUTCDate()).padStart(2, "0");

        const match = rows.find((r) => r.day === dayString);

        result.push({
            date: dayString,
            total: match?.total ?? 0,
        });
    }

    return result;
}

export function adjustDayTotal(
    practiceId: string,
    date: string,
    newTotal: number
) {
    const syncMetadata = getWriteSyncMetadata();

    const existing = sessionRepo.getSessionForDay(practiceId, date);
    const oldTotal = existing?.count ?? 0;

    if (oldTotal === newTotal) return;

   // Update session
    if (existing) {
        sessionRepo.updateSessionCount(
            existing.id,
            newTotal,
            syncMetadata
        );
    } else {
        if (newTotal > 0) {
            sessionRepo.insertSession(
                randomUUID(),
                practiceId,
                newTotal,
                new Date(date + "T00:00:00Z").getTime(),
                syncMetadata
            );
        }
    }

    // If total becomes zero → reset offset
    const total = sessionRepo.getPracticeTotal(practiceId).total;

    if (total === 0) {
        const practice = practiceRepo.getPracticeById(practiceId);
        const offset = practice?.totalOffset ?? 0;

        if (offset !== 0) {
            practiceRepo.updatePracticeTotalOffset(
                practiceId,
                0,
                syncMetadata
            );
        }
    }

    appService.markActive();
    emitDataChanged();
    void syncService.requestSync(syncMetadata.userId);
}

export function getDailyPracticeDataWithAdjustments(
    practiceId: string,
    days: number
) {
    const rows = sessionRepo.getDailyTotals(practiceId);
    const today = new Date();
    const result: { date: string; total: number }[] = [];

    for (let i = days - 1; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);

        const dayString =
            d.getUTCFullYear() +
            "-" +
            String(d.getUTCMonth() + 1).padStart(2, "0") +
            "-" +
            String(d.getUTCDate()).padStart(2, "0");

        const match = rows.find((r) => r.day === dayString);

        result.push({
            date: dayString,
            total: match?.total ?? 0,
        });
    }

    return result;
}

export function getPracticeTotal(practiceId: string) {
    return sessionRepo.getPracticeTotal(practiceId);
}

export function getCalendarDailyData(practiceId: string) {
    const rows = sessionRepo.getDailyTotals(practiceId);

    return rows.map(r => ({
        date: r.day,
        count: r.total
    }));
}