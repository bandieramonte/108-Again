import { randomUUID } from "expo-crypto";
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

export type AddedSessionResult = {
    id: string;
    practiceId: string;
    count: number;
    createdAt: number;
};

export function addSession(practiceId: string, count: number) {
    const sync = getWriteSyncMetadata();

    sessionRepo.insertSession(
        randomUUID(),
        practiceId,
        count,
        Date.now(),
        0,
        1,
        sync.userId,
        sync.updatedAt,
        sync.syncStatus,
        sync.lastSyncedAt
    );

    emitDataChanged();
    void syncService.requestSync(sync.userId);
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
    const rows = sessionRepo.getDailyTotalsWithAdjustments(practiceId);
    const current = rows.find(r => r.day === date)?.total ?? 0;

    const difference = newTotal - current;

    if (difference === 0) return;

    const sync = getWriteSyncMetadata();
    const timestamp = new Date(date + "T00:00:00Z").getTime();

    sessionRepo.insertSession(
        randomUUID(),
        practiceId,
        difference,
        timestamp,
        1,
        1,
        sync.userId,
        sync.updatedAt,
        sync.syncStatus,
        sync.lastSyncedAt
    );

    emitDataChanged();
    void syncService.requestSync(sync.userId);
}

export function getDailyPracticeDataWithAdjustments(
    practiceId: string,
    days: number
) {
    const rows = sessionRepo.getDailyTotalsWithAdjustments(practiceId);
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