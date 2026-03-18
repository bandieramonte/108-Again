import { db } from "../database/db";

type SessionRow = {
    id: string;
    practiceId: string;
    count: number;
    createdAt: number;
};

type PracticeTotalRow = {
    total: number;
};

export function insertSession(
    id: string,
    practiceId: string,
    count: number,
    createdAt: number,
    isAdjustment: number = 0,
    affectsAnalytics: number = 1
) {
    db.runSync(
        `INSERT INTO sessions (id, practiceId, count, createdAt, isAdjustment, affectsAnalytics)
     VALUES (?, ?, ?, ?, ?, ?)`,
        id,
        practiceId,
        count,
        createdAt,
        isAdjustment,
        affectsAnalytics
    );
}

export function getSessionsByPractice(practiceId: string): SessionRow[] {
    return db.getAllSync(
        `SELECT id, practiceId, count, createdAt
     FROM sessions
     WHERE practiceId = ?
     ORDER BY createdAt DESC`,
        practiceId
    ) as SessionRow[];
}

export function deleteSessionsByPractice(practiceId: string): void {
    db.runSync(`DELETE FROM sessions WHERE practiceId = ?`, practiceId);
}

export function getPracticeTotal(practiceId: string): PracticeTotalRow {
    return db.getAllSync(
        `SELECT COALESCE(SUM(count),0) as total
         FROM sessions
         WHERE practiceId=?`,
        practiceId
    )[0] as PracticeTotalRow;
}

export function getDailyTotals(practiceId: string) {
    return db.getAllSync(`
    SELECT
    date(createdAt/1000,'unixepoch') as day,
    SUM(CASE WHEN affectsAnalytics = 1 THEN count ELSE 0 END) as total
    FROM sessions
    WHERE practiceId = ?
    GROUP BY day
  `, practiceId) as { day: string; total: number }[];
}

export function getSessionsForBackup() {
    return db.getAllSync(`
    SELECT
      s.count,
      s.createdAt,
      s.isAdjustment,
      s.affectsAnalytics,
      p.name AS practiceName,
      p.orderIndex
    FROM sessions s
    JOIN practices p
    ON s.practiceId = p.id
  `);
}

export function deleteAllSessions() {
    db.execSync(`DELETE FROM sessions`);
}

export function getSessionDays() {
    return db.getAllSync(`
    SELECT
      date(createdAt/1000,'unixepoch') as day
    FROM sessions
    WHERE COALESCE(affectsAnalytics,1) = 1
    GROUP BY date(createdAt/1000,'unixepoch')
    HAVING COALESCE(SUM(count), 0) > 0
    ORDER BY day DESC
  `) as { day: string }[];
}

export function getDailyTotalsWithAdjustments(practiceId: string) {
    return db.getAllSync(`
    SELECT
    date(createdAt/1000,'unixepoch') as day,
    SUM(CASE WHEN affectsAnalytics = 1 THEN count ELSE 0 END) as total
    FROM sessions
    WHERE practiceId = ?
    GROUP BY day
  `, practiceId) as { day: string; total: number }[];
}