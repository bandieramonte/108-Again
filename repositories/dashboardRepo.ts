import { db } from "../database/db";

const DAY_MS = 1000 * 60 * 60 * 24;
const SESSION_DAY_SQL = `
  CASE
    WHEN (s.createdAt % ${DAY_MS}) = 0
    THEN date(s.createdAt/1000,'unixepoch')
    ELSE date(s.createdAt/1000,'unixepoch','localtime')
  END
`;

export type DashboardPracticeRow = {
  id: string;
  name: string;
  targetCount: number;
  total: number;
  today: number;
  imageKey?: string | null;
  dailyTargetCount?: number | null;
  defaultSessionCount?: number | null;
};

export function getDashboardPracticeRows(): DashboardPracticeRow[] {

  return db.getAllSync(`
    SELECT
    p.id,
    p.name,
    p.targetCount,
    MAX(p.imageKey) as imageKey,
    0 as total,
    COALESCE(SUM(
      CASE
        WHEN ${SESSION_DAY_SQL} = date('now','localtime')
        THEN s.count
        ELSE 0
      END
    ),0) as today,
  MAX(p.dailyTargetCount) as dailyTargetCount,
  COALESCE(MAX(p.defaultSessionCount), 108) as defaultSessionCount
  FROM practices p
  LEFT JOIN sessions s
    ON p.id = s.practiceId

  GROUP BY p.id
  ORDER BY p.orderIndex
  `) as DashboardPracticeRow[];

}
