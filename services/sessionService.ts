import { getAppOperationEngine } from "./appOperationRuntime";

export type AddedSessionResult = {
    id: string;
    practiceId: string;
    count: number;
    createdAt: number;
};

export function addSession(practiceId: string, count: number) {
    getAppOperationEngine().addSession(practiceId, count);
}

export function getSessionsForPractice(practiceId: string) {
    return getAppOperationEngine().getSessionsForPractice(practiceId);
}

export function getDailyPracticeData(practiceId: string, days: number) {
    return getAppOperationEngine().getDailyPracticeData(practiceId, days);
}

export function adjustDayTotal(
    practiceId: string,
    date: string,
    newTotal: number
) {
    getAppOperationEngine().adjustDayTotal(
        practiceId,
        date,
        newTotal
    );
}

export function getDailyPracticeDataWithAdjustments(
    practiceId: string,
    days: number
) {
    return getAppOperationEngine()
        .getDailyPracticeDataWithAdjustments(practiceId, days);
}

export function getPracticeTotal(practiceId: string) {
    return getAppOperationEngine().getPracticeTotal(practiceId);
}

export function getCalendarDailyData(practiceId: string) {
    return getAppOperationEngine().getCalendarDailyData(practiceId);
}

export function getPracticeLifetimeStats(
    practiceId: string
) {
    return getAppOperationEngine().getPracticeLifetimeStats(practiceId);
}

export function getPracticeAverageSessionSize(
    practiceId: string,
    days: number
) {
    return getAppOperationEngine().getPracticeAverageSessionSize(
        practiceId,
        days
    );
}
