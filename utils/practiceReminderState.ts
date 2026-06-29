export type PracticeReminderPracticeRow = {
    id?: string;
    reminderEnabled?: boolean | number | null;
    reminderHour?: number | null;
    reminderMinute?: number | null;
} | null | undefined;

export type PracticeReminderBackupLikeRow = {
    enabled: boolean;
    hour: number;
    minute: number;
    practiceId: string;
};

export type PracticeReminderSettingsLike = {
    enabled: boolean;
    hour: number;
    minute: number;
    scheduledNotifications: [];
};

export function isPracticeReminderEnabledValue(value: unknown) {
    return value === true || value === 1;
}

export function getPracticeReminderSettingsFromPractice(
    practice: PracticeReminderPracticeRow
): PracticeReminderSettingsLike {
    return {
        enabled: isPracticeReminderEnabledValue(practice?.reminderEnabled),
        hour: practice?.reminderHour ?? 20,
        minute: practice?.reminderMinute ?? 0,
        scheduledNotifications: [],
    };
}

export function getPracticeReminderBackupRowFromPractice(
    practice: PracticeReminderPracticeRow
): PracticeReminderBackupLikeRow | null {
    if (!practice?.id) return null;

    const settings = getPracticeReminderSettingsFromPractice(practice);

    if (
        !settings.enabled &&
        settings.hour === 20 &&
        settings.minute === 0
    ) {
        return null;
    }

    return {
        practiceId: practice.id,
        enabled: settings.enabled,
        hour: settings.hour,
        minute: settings.minute,
    };
}
