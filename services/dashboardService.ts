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
    const rows = dashboardRepo.getDashboardPracticeRows();

    return rows.map(row => {
        const totalResult = sessionRepo.getPracticeTotal(row.id);

        return {
            ...row,
            total: totalResult.total
        };
    });
}

export function getCurrentStreak(): number {

    const rows = sessionRepo.getSessionDays();

    let currentStreak = 0;

    const today = new Date();

    let checkDate = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate()
    );

    const todayString =
        checkDate.getFullYear() +
        "-" +
        String(checkDate.getMonth() + 1).padStart(2, "0") +
        "-" +
        String(checkDate.getDate()).padStart(2, "0");

    // If no practice today, start from yesterday
    if (rows.length === 0 || rows[0].day !== todayString) {
        checkDate.setDate(checkDate.getDate() - 1);
    }

    for (let i = 0; i < rows.length; i++) {

        const expectedDay =
            checkDate.getFullYear() +
            "-" +
            String(checkDate.getMonth() + 1).padStart(2, "0") +
            "-" +
            String(checkDate.getDate()).padStart(2, "0");

        if (rows[i].day === expectedDay) {
            currentStreak++;
            checkDate.setDate(checkDate.getDate() - 1);
        } else {
            break;
        }
    }

    return currentStreak;
}