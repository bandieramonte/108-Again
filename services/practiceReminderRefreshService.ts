import { getRuntimeI18n } from "../i18n";
import type { TranslationKey } from "../i18n/locales/en";
import { getPracticeDisplayName } from "../i18n/practiceNames";
import { createPracticeReminderText } from "../i18n/reminderText";
import * as appMetaRepo from "../repositories/appMetaRepo";
import * as practiceRepo from "../repositories/practiceRepo";
import * as sessionRepo from "../repositories/sessionRepo";
import { getPracticeReminderBackupRowFromPractice } from "../utils/practiceReminderState";
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
const REMINDER_DB_MIGRATION_KEY =
    "practiceReminderSettingsDbMigrationApplied";

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

function getReminderRowsFromPracticeRows() {
    return practiceRepo
        .getAllPractices()
        .map(getPracticeReminderBackupRowFromPractice)
        .filter((row): row is {
            practiceId: string;
            enabled: boolean;
            hour: number;
            minute: number;
        } => row !== null);
}

async function syncStoredReminderSettingsFromPracticeRows() {
    const practices = practiceRepo.getAllPractices();

    await practiceReminderService.restorePracticeReminderBackupData(
        getReminderRowsFromPracticeRows(),
        new Set(practices.map(practice => practice.id))
    );
}

async function syncStoredReminderSettingsFromPractice(
    practice: ReturnType<typeof practiceRepo.getPracticeById>
) {
    if (!practice) return;

    await practiceReminderService.restorePracticeReminderBackupRow(
        practice.id,
        getPracticeReminderBackupRowFromPractice(practice)
    );
}

export async function migrateStoredPracticeReminderSettingsToDatabase() {
    if (appMetaRepo.getMeta(REMINDER_DB_MIGRATION_KEY) === "true") return;

    const rows =
        await practiceReminderService.getPracticeReminderBackupData();
    const migratedAt = Date.now();

    for (const row of rows) {
        const practice = practiceRepo.getPracticeById(row.practiceId);

        if (!practice) continue;

        const userId = practice.userId ?? null;

        practiceRepo.updatePracticeReminderSettings(
            row.practiceId,
            row.enabled,
            row.hour,
            row.minute,
            {
                userId,
                updatedAt: migratedAt,
                syncStatus: userId ? "pending" : "synced",
                lastSyncedAt: userId ? null : migratedAt,
            }
        );
    }

    appMetaRepo.setMeta(REMINDER_DB_MIGRATION_KEY, "true");
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
    const practice = practiceRepo.getPracticeById(practiceId);

    if (!practice) {
        return practiceReminderService.disablePracticeReminder(practiceId);
    }

    await syncStoredReminderSettingsFromPractice(practice);

    const currentSettings =
        await practiceReminderService.getPracticeReminderSettings(practiceId);

    if (!currentSettings.enabled) return currentSettings;

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
    await syncStoredReminderSettingsFromPracticeRows();

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
