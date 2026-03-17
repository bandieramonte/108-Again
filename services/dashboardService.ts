import * as dashboardRepo from "../repositories/dashboardRepo";
import * as sessionRepo from "../repositories/sessionRepo";

type DashboardPracticeRow = {
    id: string;
    name: string;
    targetCount: number;
    total: number;
    today: number;
    imageKey?: string | null;
};

export function getDashboardPractices(): DashboardPracticeRow[] {
    return dashboardRepo.getDashboardPracticeRows();
}

export function getCurrentStreak(): number {

    const rows = sessionRepo.getSessionDays();

    let currentStreak = 0;

    const today = new Date();
    let checkDate = new Date(today);

    for (let i = 0; i < rows.length; i++) {

        const rowDate = new Date(rows[i].day);

        if (rowDate.toDateString() === checkDate.toDateString()) {
            currentStreak++;
            checkDate.setDate(checkDate.getDate() - 1);
        } else {
            break;
        }
    }

    return currentStreak;
}