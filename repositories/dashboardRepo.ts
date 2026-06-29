import { db } from "../database/db";

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
        WHEN date(s.createdAt/1000,'unixepoch') = date('now')
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
