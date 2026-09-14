import { SyncMetadata } from "../types/sync";
import {
  formatCalendarDate,
  getCalendarDayDifference,
} from "../utils/calendarMonth";
import { getAppOperationEngine } from "./appOperationRuntime";
import { deleteLocalCustomPracticeImage } from "./customPracticeImageService";

export function getWriteSyncMetadata() : SyncMetadata {
    return getAppOperationEngine()
        .getWriteSyncMetadata();
}

export function createPractice(
    name: string,
    target: number,
    dailyTargetCount: number | null = null,
    defaultSessionCount: number = 108,
    imageKey: string | null = null,
    customImageUri: string | null = null
) {
    return getAppOperationEngine().createPractice(
        name,
        target,
        dailyTargetCount,
        defaultSessionCount,
        imageKey,
        customImageUri
    );
}

export function createSeedPractice(
    seedPracticeId: string,
    options: {
        targetCount?: number;
        defaultSessionCount?: number;
    } = {}
) {
    return getAppOperationEngine().createSeedPractice(
        seedPracticeId,
        options
    );
}

export function reorderPractices(orderedPracticeIds: string[]) {
    getAppOperationEngine().reorderPractices(orderedPracticeIds);
}

export function updatePractice(
    id: string,
    name: string,
    target: number,
    newTotal: number,
    imageKey?: string | null
) {
    getAppOperationEngine().updatePractice(
        id,
        name,
        target,
        newTotal,
        imageKey
    );
}

export function replaceCustomPracticeImage(
    id: string,
    customImageUri: string
) {
    const previousImageUri = getAppOperationEngine()
        .replaceCustomPracticeImage(id, customImageUri);

    if (previousImageUri && previousImageUri !== customImageUri) {
        deleteLocalCustomPracticeImage(previousImageUri);
    }
}

export function restoreOriginalPracticeImage(id: string) {
    const { imageKey, previousImageUri } = getAppOperationEngine()
        .restoreOriginalPracticeImage(id);
    deleteLocalCustomPracticeImage(previousImageUri);
    return imageKey;
}

export async function deletePractice(id: string) {
    const customImageUri = getAppOperationEngine()
        .getPractice(id)?.customImageUri;
    await getAppOperationEngine().deletePractice(id);
    deleteLocalCustomPracticeImage(customImageUri);
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

export function updatePracticeReminderSettings(
    id: string,
    enabled: boolean,
    hour: number,
    minute: number
) {
    getAppOperationEngine().updatePracticeReminderSettings(
        id,
        enabled,
        hour,
        minute
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
    const diffDays = getCalendarDayDifference(
        formatCalendarDate(targetDate),
        formatCalendarDate(today)
    );

    if (diffDays <= 0) return targetCount - total;

    const remaining = targetCount - total;

    if (remaining <= 0) return 0;

    return Math.ceil(remaining / diffDays);
}
