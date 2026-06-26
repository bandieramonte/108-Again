import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { formatNumber } from "../utils/numberUtils";

const STORAGE_KEY_PREFIX = "practiceReminder:";
const CHANNEL_ID = "practice-reminders";
const DAYS_TO_SCHEDULE = 14;
const DEFAULT_HOUR = 20;
const DEFAULT_MINUTE = 0;

export type ScheduledPracticeReminder = {
    date: string;
    id: string;
    body: string;
};

export type PracticeReminderSettings = {
    enabled: boolean;
    hour: number;
    minute: number;
    scheduledNotifications: ScheduledPracticeReminder[];
};

type ReminderScheduleContext = {
    practiceId: string;
    practiceName: string;
    todayCount: number;
    dailyTargetCount: number | null;
    reminderText?: PracticeReminderText;
};

type SavePracticeReminderInput = ReminderScheduleContext & {
    hour: number;
    minute: number;
};

type PracticeReminderResponseHandler = (practiceId: string) => void;

export type PracticeReminderText = {
    channelName: string;
    dailyTargetRequiredMessage: string;
    invalidTimeMessage: string;
    notificationBody: (remainingCount: number) => string;
    notificationTitle: (practiceName: string) => string;
    permissionDeniedMessage: string;
    unavailableOnWebMessage: string;
};

let notificationHandlerRegistered = false;

export function initializePracticeReminderNotifications() {
    if (notificationHandlerRegistered) return;

    Notifications.setNotificationHandler({
        handleNotification: async () => ({
            shouldShowBanner: true,
            shouldShowList: true,
            shouldPlaySound: true,
            shouldSetBadge: false,
            priority: Notifications.AndroidNotificationPriority.DEFAULT,
        }),
    });

    notificationHandlerRegistered = true;
}

function getStorageKey(practiceId: string) {
    return `${STORAGE_KEY_PREFIX}${practiceId}`;
}

function getDefaultSettings(): PracticeReminderSettings {
    return {
        enabled: false,
        hour: DEFAULT_HOUR,
        minute: DEFAULT_MINUTE,
        scheduledNotifications: [],
    };
}

function isValidTime(hour: number, minute: number) {
    return (
        Number.isInteger(hour) &&
        Number.isInteger(minute) &&
        hour >= 0 &&
        hour <= 23 &&
        minute >= 0 &&
        minute <= 59
    );
}

function formatDateKey(date: Date) {
    return (
        date.getUTCFullYear() +
        "-" +
        String(date.getUTCMonth() + 1).padStart(2, "0") +
        "-" +
        String(date.getUTCDate()).padStart(2, "0")
    );
}

function getDefaultReminderText(): PracticeReminderText {
    return {
        channelName: "Practice reminders",
        dailyTargetRequiredMessage: "Set a daily target before enabling reminders.",
        invalidTimeMessage: "Reminder time must be between 00:00 and 23:59.",
        notificationBody: (remainingCount) =>
            `You need ${formatNumber(remainingCount)} more to complete today's goal.`,
        notificationTitle: (practiceName) =>
            `${practiceName}: today's goal`,
        permissionDeniedMessage:
            "Notifications are disabled. Enable notifications for 108 Again to receive practice reminders.",
        unavailableOnWebMessage:
            "Practice reminders are available on iOS and Android.",
    };
}

function getReminderText(
    reminderText?: PracticeReminderText
): PracticeReminderText {
    return reminderText ?? getDefaultReminderText();
}

function getPracticeIdFromNotificationResponse(
    response: Notifications.NotificationResponse
) {
    const data = response.notification.request.content.data;

    if (
        data?.type !== "practice-reminder" ||
        typeof data.practiceId !== "string"
    ) {
        return null;
    }

    return data.practiceId;
}

export function formatReminderTime(hour: number, minute: number) {
    return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function parseSettings(value: string | null): PracticeReminderSettings {
    if (!value) return getDefaultSettings();

    try {
        const parsed = JSON.parse(value) as Partial<PracticeReminderSettings>;
        const hour =
            typeof parsed.hour === "number"
                ? parsed.hour
                : DEFAULT_HOUR;
        const minute =
            typeof parsed.minute === "number"
                ? parsed.minute
                : DEFAULT_MINUTE;

        return {
            enabled: parsed.enabled === true,
            hour: isValidTime(hour, minute) ? hour : DEFAULT_HOUR,
            minute: isValidTime(hour, minute) ? minute : DEFAULT_MINUTE,
            scheduledNotifications: Array.isArray(parsed.scheduledNotifications)
                ? parsed.scheduledNotifications
                    .filter(
                        (item) =>
                            typeof item?.date === "string" &&
                            typeof item?.id === "string"
                    )
                    .map(item => ({
                        date: item.date,
                        id: item.id,
                        body:
                            typeof item.body === "string"
                                ? item.body
                                : "",
                    }))
                : [],
        };
    } catch {
        return getDefaultSettings();
    }
}

async function saveSettings(
    practiceId: string,
    settings: PracticeReminderSettings
) {
    await AsyncStorage.setItem(
        getStorageKey(practiceId),
        JSON.stringify(settings)
    );
}

async function cancelScheduledNotifications(
    settings: PracticeReminderSettings
) {
    await Promise.all(
        settings.scheduledNotifications.map(async (notification) => {
            try {
                await Notifications.cancelScheduledNotificationAsync(
                    notification.id
                );
            } catch {
                // A missing notification is harmless; the local preference is
                // the source of truth for what should exist next.
            }
        })
    );
}

async function ensureNotificationPermission(
    reminderText?: PracticeReminderText
) {
    const text = getReminderText(reminderText);

    initializePracticeReminderNotifications();

    if (Platform.OS === "web") {
        throw new Error(text.unavailableOnWebMessage);
    }

    if (Platform.OS === "android") {
        await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
            name: text.channelName,
            importance: Notifications.AndroidImportance.DEFAULT,
        });
    }

    const existing = await Notifications.getPermissionsAsync();
    let finalStatus = existing.status;

    if (finalStatus !== "granted") {
        const requested = await Notifications.requestPermissionsAsync();
        finalStatus = requested.status;
    }

    if (finalStatus !== "granted") {
        throw new Error(text.permissionDeniedMessage);
    }
}

function getDesiredReminderDates({
    hour,
    minute,
    todayCount,
    dailyTargetCount,
    reminderText,
}: PracticeReminderSettings & ReminderScheduleContext) {
    const now = new Date();
    const todayKey = formatDateKey(now);
    const isTodayFinished =
        dailyTargetCount != null &&
        dailyTargetCount > 0 &&
        todayCount >= dailyTargetCount;
    const desired: { date: string; scheduledAt: Date; body: string }[] = [];

    for (let offset = 0; offset < DAYS_TO_SCHEDULE; offset++) {
        const scheduledAt = new Date(now);
        scheduledAt.setDate(now.getDate() + offset);
        scheduledAt.setHours(hour, minute, 0, 0);

        if (scheduledAt.getTime() <= now.getTime()) continue;

        const date = formatDateKey(scheduledAt);

        if (date === todayKey && isTodayFinished) continue;

        const remainingCount =
            date === todayKey
                ? Math.max((dailyTargetCount ?? 0) - todayCount, 0)
                : dailyTargetCount ?? 0;

        desired.push({
            date,
            scheduledAt,
            body: getReminderText(reminderText)
                .notificationBody(remainingCount),
        });
    }

    return desired;
}

function hasSameScheduledDates(
    settings: PracticeReminderSettings,
    desired: { date: string; body: string }[]
) {
    if (settings.scheduledNotifications.length !== desired.length) {
        return false;
    }

    return settings.scheduledNotifications.every(
        (notification, index) =>
            notification.date === desired[index]?.date &&
            notification.body === desired[index]?.body
    );
}

async function scheduleNotifications(
    settings: PracticeReminderSettings,
    context: ReminderScheduleContext
): Promise<ScheduledPracticeReminder[]> {
    const desired = getDesiredReminderDates({
        ...settings,
        ...context,
    });

    if (hasSameScheduledDates(settings, desired)) {
        return settings.scheduledNotifications;
    }

    await cancelScheduledNotifications(settings);

    const scheduledNotifications: ScheduledPracticeReminder[] = [];

    for (const reminder of desired) {
        const id = await Notifications.scheduleNotificationAsync({
            identifier: `${STORAGE_KEY_PREFIX}${context.practiceId}:${reminder.date}`,
            content: {
                title: getReminderText(context.reminderText)
                    .notificationTitle(context.practiceName),
                body: reminder.body,
                data: {
                    practiceId: context.practiceId,
                    type: "practice-reminder",
                },
            },
            trigger: {
                type: Notifications.SchedulableTriggerInputTypes.DATE,
                date: reminder.scheduledAt,
                channelId: CHANNEL_ID,
            },
        });

        scheduledNotifications.push({
            date: reminder.date,
            id,
            body: reminder.body,
        });
    }

    return scheduledNotifications;
}

export async function getPracticeReminderSettings(
    practiceId: string
): Promise<PracticeReminderSettings> {
    const value = await AsyncStorage.getItem(getStorageKey(practiceId));

    return parseSettings(value);
}

export function subscribePracticeReminderResponses(
    onPracticeReminder: PracticeReminderResponseHandler
) {
    initializePracticeReminderNotifications();

    return Notifications.addNotificationResponseReceivedListener(
        response => {
            const practiceId =
                getPracticeIdFromNotificationResponse(response);

            if (practiceId) {
                onPracticeReminder(practiceId);
            }
        }
    );
}

export function consumeLastPracticeReminderResponse(
    onPracticeReminder: PracticeReminderResponseHandler
) {
    initializePracticeReminderNotifications();

    const response = Notifications.getLastNotificationResponse();
    const practiceId = response
        ? getPracticeIdFromNotificationResponse(response)
        : null;

    if (!practiceId) return;

    onPracticeReminder(practiceId);
    Notifications.clearLastNotificationResponse();
}

export async function savePracticeReminderSettings({
    practiceId,
    practiceName,
    todayCount,
    dailyTargetCount,
    reminderText,
    hour,
    minute,
}: SavePracticeReminderInput): Promise<PracticeReminderSettings> {
    const text = getReminderText(reminderText);

    if (!isValidTime(hour, minute)) {
        throw new Error(text.invalidTimeMessage);
    }

    if (dailyTargetCount == null || dailyTargetCount <= 0) {
        throw new Error(text.dailyTargetRequiredMessage);
    }

    await ensureNotificationPermission(text);

    const current = await getPracticeReminderSettings(practiceId);
    const next: PracticeReminderSettings = {
        enabled: true,
        hour,
        minute,
        scheduledNotifications: current.scheduledNotifications,
    };

    next.scheduledNotifications = await scheduleNotifications(next, {
        practiceId,
        practiceName,
        todayCount,
        dailyTargetCount,
        reminderText,
    });

    await saveSettings(practiceId, next);

    return next;
}

export async function disablePracticeReminder(
    practiceId: string
): Promise<PracticeReminderSettings> {
    const current = await getPracticeReminderSettings(practiceId);
    const next: PracticeReminderSettings = {
        ...current,
        enabled: false,
        scheduledNotifications: [],
    };

    await cancelScheduledNotifications(current);
    await saveSettings(practiceId, next);

    return next;
}

export async function refreshPracticeReminderSchedule(
    context: ReminderScheduleContext
): Promise<PracticeReminderSettings> {
    const current = await getPracticeReminderSettings(context.practiceId);

    if (!current.enabled) return current;

    if (
        context.dailyTargetCount == null ||
        context.dailyTargetCount <= 0
    ) {
        return disablePracticeReminder(context.practiceId);
    }

    const next: PracticeReminderSettings = {
        ...current,
        scheduledNotifications: await scheduleNotifications(
            current,
            context
        ),
    };

    await saveSettings(context.practiceId, next);

    return next;
}
