import { randomUUID } from "expo-crypto";
import * as sessionRepo from "../repositories/sessionRepo";

export function addSession(practiceId: string, count: number) {

    sessionRepo.insertSession(
        randomUUID(),
        practiceId,
        count,
        Date.now(),
        0,  // isAdjustment
        1 // affectsAnalytics
    );

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

        const match = rows.find(r => r.day === dayString);

        result.push({
            date: dayString,
            total: match?.total ?? 0
        });

    }

    return result;
}

export function adjustDayTotal(
    practiceId: string,
    date: string,
    newTotal: number
) {
    const rows = sessionRepo.getDailyTotals(practiceId);
    const current = rows.find(r => r.day === date)?.total ?? 0;

    const difference = newTotal - current;

    if (difference === 0) return;

    // convert YYYY-MM-DD → timestamp
    const timestamp = new Date(date + "T00:00:00Z").getTime();
    sessionRepo.insertSession(
        randomUUID(),
        practiceId,
        difference,
        timestamp,
        1, // adjustment
        1, // affects analytics
    );
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

        const match = rows.find(r => r.day === dayString);

        result.push({
            date: dayString,
            total: match?.total ?? 0
        });
    }

    return result;
}