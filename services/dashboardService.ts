import * as dashboardRepo from "../repositories/dashboardRepo";
import * as sessionRepo from "../repositories/sessionRepo";

type DashboardPracticeRow = {
    id: string;
    name: string;
    targetCount: number;
    total: number;
    today: number;
    imageKey?: string | null;
    defaultAddCount?: number | null;
};

export function getDashboardPractices(): DashboardPracticeRow[] {
    return dashboardRepo.getDashboardPracticeRows();
}

export function getCurrentStreak(): number {

    const rows = sessionRepo.getSessionDays();

    let currentStreak = 0;

    const today = new Date();
    let checkDate = new Date(Date.UTC(
        today.getUTCFullYear(),
        today.getUTCMonth(),
        today.getUTCDate()
    ));

    for (let i = 0; i < rows.length; i++) {

        const expectedDay =
            checkDate.getUTCFullYear() +
            "-" +
            String(checkDate.getUTCMonth() + 1).padStart(2, "0") +
            "-" +
            String(checkDate.getUTCDate()).padStart(2, "0");

        if (rows[i].day === expectedDay) {
            currentStreak++;
            checkDate.setUTCDate(checkDate.getUTCDate() - 1);
        } else {
            break;
        }
    }

    return currentStreak;
}