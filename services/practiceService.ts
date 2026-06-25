import { SyncMetadata } from "../types/sync";
import { getAppOperationEngine } from "./appOperationRuntime";

export function getWriteSyncMetadata() : SyncMetadata {
    return getAppOperationEngine()
        .getWriteSyncMetadata();
}

export function createPractice(
    name: string,
    target: number,
    dailyTargetCount: number | null = null,
    defaultSessionCount: number = 108
) {
    return getAppOperationEngine().createPractice(
        name,
        target,
        dailyTargetCount,
        defaultSessionCount
    );
}

export function updatePractice(
    id: string,
    name: string,
    target: number,
    newTotal: number
) {
    getAppOperationEngine().updatePractice(
        id,
        name,
        target,
        newTotal
    );
}

export async function deletePractice(id: string) {
    await getAppOperationEngine().deletePractice(id);
}

export function getPracticeEditData(id: string) {
    return getAppOperationEngine().getPracticeEditData(id);
}

export function getPracticeName(id: string) {
    return getAppOperationEngine().getPracticeName(id);
}

export function getPractice(id: string) {
    return getAppOperationEngine().getPractice(id);
}

export function getAllPractices() {
    return getAppOperationEngine().getAllPractices();
}

export function updatePracticeDailyTargetCount(
    id: string,
    dailyTargetCount: number | null
) {
    getAppOperationEngine().updatePracticeDailyTargetCount(
        id,
        dailyTargetCount,
    );
}

export function updatePracticeDefaultSessionCount(
    id: string,
    defaultSessionCount: number
) {
    getAppOperationEngine().updatePracticeDefaultSessionCount(
        id,
        defaultSessionCount,
    );
}

export function getExpectedTargetDate(
  targetCount: number,
  total: number,
  dailyTargetCount?: number | null
): Date | null {

  const dailyAmount = dailyTargetCount;

  if (
    dailyAmount == null ||
    !Number.isFinite(dailyAmount) ||
    dailyAmount <= 0
  ) {
    return null;
  }

  const remaining = targetCount - total;

  if (remaining <= 0) {
    return new Date();
  }

  const daysNeeded =
    Math.ceil(remaining / dailyAmount);

  const targetDate = new Date();

  targetDate.setDate(
    targetDate.getDate() + daysNeeded
  );

  return targetDate;
}

export function calculateRequiredDailyCount(
    targetCount: number,
    total: number,
    targetDate: Date
) {
    const today = new Date();

    const diffDays = Math.ceil(
        (targetDate.getTime() - today.getTime()) /
        (1000 * 60 * 60 * 24)
    );

    if (diffDays <= 0) return targetCount - total;

    const remaining = targetCount - total;

    if (remaining <= 0) return 0;

    return Math.ceil(remaining / diffDays);
}
