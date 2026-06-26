import { getRuntimeI18n } from "../i18n";
import type { TranslationKey } from "../i18n/locales/en";
import { getPracticeDisplayName } from "../i18n/practiceNames";
import { createPracticeReminderText } from "../i18n/reminderText";
import * as practiceRepo from "../repositories/practiceRepo";
import * as sessionRepo from "../repositories/sessionRepo";
import * as practiceReminderService from "./practiceReminderService";
import type {
    PracticeReminderSettings,
    PracticeReminderText,
} from "./practiceReminderService";

type TranslationParams = Record<string, number | string | null | undefined>;
type Translate = (
    key: TranslationKey,
    params?: TranslationParams
) => string;
type Logger = Pick<Console, "warn">;
type TimerHandle = ReturnType<typeof setTimeout>;

type RefreshReminderOptions = {
    logger?: Logger;
    reminderText?: PracticeReminderText;
    t?: Translate;
};

const pendingPracticeRefreshes = new Set<string>();
let practiceRefreshTimer: TimerHandle | null = null;
let allRefreshTimer: TimerHandle | null = null;

function formatDateKey(date: Date) {
    return (
        date.getUTCFullYear() +
        "-" +
        String(date.getUTCMonth() + 1).padStart(2, "0") +
        "-" +
        String(date.getUTCDate()).padStart(2, "0")
    );
}

function getTodayCount(practiceId: string) {
    const todayKey = formatDateKey(new Date());
    const todayRow =
        sessionRepo.getDailyTotals(practiceId)
            .find(row => row.day === todayKey);

    return todayRow?.total ?? 0;
}

async function resolveReminderText(options?: RefreshReminderOptions) {
    if (options?.t) {
        return {
            reminderText:
                options.reminderText ??
                createPracticeReminderText(options.t),
            t: options.t,
        };
    }

    const runtimeI18n = await getRuntimeI18n();

    return {
        reminderText:
            options?.reminderText ??
            createPracticeReminderText(runtimeI18n.t),
        t: runtimeI18n.t,
    };
}

function warnRefreshFailed(
    logger: Logger | undefined,
    message: string,
    error: unknown
) {
    (logger ?? console).warn(message, error);
}

export async function refreshReminderForPractice(
    practiceId: string,
    options?: RefreshReminderOptions
): Promise<PracticeReminderSettings> {
    const currentSettings =
        await practiceReminderService.getPracticeReminderSettings(practiceId);

    if (!currentSettings.enabled) return currentSettings;

    const practice = practiceRepo.getPracticeById(practiceId);

    if (!practice) {
        return practiceReminderService.disablePracticeReminder(practiceId);
    }

    const { reminderText, t } = await resolveReminderText(options);
    const practiceName =
        getPracticeDisplayName(practice.id, practice.name, t);

    return practiceReminderService.refreshPracticeReminderSchedule({
        practiceId,
        practiceName,
        todayCount: getTodayCount(practiceId),
        dailyTargetCount: practice.dailyTargetCount ?? null,
        reminderText,
    });
}

async function refreshPracticeReminderIds(
    practiceIds: string[],
    options?: RefreshReminderOptions
) {
    const { reminderText, t } = await resolveReminderText(options);

    await Promise.all(
        practiceIds.map(async (practiceId) => {
            try {
                await refreshReminderForPractice(practiceId, {
                    ...options,
                    reminderText,
                    t,
                });
            } catch (error) {
                warnRefreshFailed(
                    options?.logger,
                    "Failed to refresh practice reminder",
                    error
                );
            }
        })
    );
}

export async function refreshAllPracticeReminders(
    options?: RefreshReminderOptions
) {
    const practiceIds =
        await practiceReminderService.getPracticeIdsWithEnabledReminders();

    if (practiceIds.length === 0) return;

    await refreshPracticeReminderIds(practiceIds, options);
}

export function queueRefreshReminderForPractice(
    practiceId: string,
    options?: RefreshReminderOptions
) {
    pendingPracticeRefreshes.add(practiceId);

    if (practiceRefreshTimer) return;

    practiceRefreshTimer = setTimeout(() => {
        const practiceIds = Array.from(pendingPracticeRefreshes);

        pendingPracticeRefreshes.clear();
        practiceRefreshTimer = null;

        void refreshPracticeReminderIds(practiceIds, options);
    }, 0);
}

export function queueRefreshAllPracticeReminders(
    options?: RefreshReminderOptions
) {
    if (allRefreshTimer) return;

    allRefreshTimer = setTimeout(() => {
        if (practiceRefreshTimer) {
            clearTimeout(practiceRefreshTimer);
            practiceRefreshTimer = null;
        }

        pendingPracticeRefreshes.clear();
        allRefreshTimer = null;

        void refreshAllPracticeReminders(options)
            .catch(error => {
                warnRefreshFailed(
                    options?.logger,
                    "Failed to refresh practice reminders",
                    error
                );
            });
    }, 0);
}
