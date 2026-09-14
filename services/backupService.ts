import { MAX_PRACTICE_COUNT, MAX_REPETITIONS_PER_DAY, MAX_TARGET_COUNT } from "../utils/numberUtils";
import { isCalendarDateString } from "../utils/calendarMonth";
import {
    CUSTOM_PRACTICE_IMAGE_KEY,
    CUSTOM_PRACTICE_IMAGE_HEIGHT,
    CUSTOM_PRACTICE_IMAGE_WIDTH,
} from "../constants/customPracticeImages";
import { getAppOperationEngine } from "./appOperationRuntime";

const BACKUP_APP_ID = "app108again";
const MAX_BACKUP_IMAGE_BASE64_LENGTH = 1_400_000;

declare const require: {
    (path: string): any;
};

function validateOptionalCount(
    value: unknown,
    label: string,
    minimum = 0
) {
    if (value == null) return;

    if (
        typeof value !== "number" ||
        !Number.isInteger(value) ||
        value < minimum ||
        value > MAX_REPETITIONS_PER_DAY
    ) {
        throw new Error(`Invalid ${label}`);
    }
}

function isValidReminderTime(hour: unknown, minute: unknown) {
    return (
        Number.isInteger(hour) &&
        Number.isInteger(minute) &&
        typeof hour === "number" &&
        typeof minute === "number" &&
        hour >= 0 &&
        hour <= 23 &&
        minute >= 0 &&
        minute <= 59
    );
}

function getPracticeReminderService() {
    return require("./practiceReminderService");
}

function getPracticeReminderRefreshService() {
    return require("./practiceReminderRefreshService");
}

function mergePracticeReminderRows(
    rows: any[],
    fallbackRows: any[]
) {
    const byPracticeId = new Map<string, any>();

    for (const row of fallbackRows) {
        if (row?.practiceId) {
            byPracticeId.set(row.practiceId, row);
        }
    }

    for (const row of rows) {
        if (row?.practiceId) {
            byPracticeId.set(row.practiceId, row);
        }
    }

    return Array.from(byPracticeId.values());
}

export async function getBackupData() {
    const data = getAppOperationEngine().getBackupData();
    const practiceReminderService = getPracticeReminderService();
    const storedPracticeReminders =
        await practiceReminderService.getPracticeReminderBackupData();

    return {
        ...data,
        practiceReminders: mergePracticeReminderRows(
            data.practiceReminders ?? [],
            storedPracticeReminders
        ),
    };
}

export async function restoreBackupData(data: any) {
    const practiceReminderService = getPracticeReminderService();

    await practiceReminderService.restorePracticeReminderBackupData(
        [],
        new Set<string>()
    );

    await getAppOperationEngine().restoreBackupData(data);

    const practiceIds = new Set<string>(
        Array.isArray(data?.practices)
            ? data.practices.map((practice: any) => practice.id)
            : []
    );

    await practiceReminderService.restorePracticeReminderBackupData(
        Array.isArray(data?.practiceReminders)
            ? data.practiceReminders
            : [],
        practiceIds
    );

    getPracticeReminderRefreshService()
        .queueRefreshAllPracticeReminders();
}

export function validateBackup(data: any) {

    if (!data || typeof data !== "object") {
        throw new Error("Invalid backup format");
    }

    if (data.app !== BACKUP_APP_ID) {
        throw new Error("Invalid backup file");
    }

    if (!Array.isArray(data.practices)) {
        throw new Error("Invalid practices data");
    }

    if (!Array.isArray(data.sessions)) {
        throw new Error("Invalid sessions data");
    }

    if (
        data.practiceReminders != null &&
        !Array.isArray(data.practiceReminders)
    ) {
        throw new Error("Invalid practice reminders data");
    }

    if (data.practices.length > MAX_PRACTICE_COUNT) {
        throw new Error("Too many practices in backup");
    }

    if (data.sessions.length > 10000) {
        throw new Error("Too many sessions in backup");
    }

    if (data.practices.length === 0) {
        throw new Error("Backup contains no practices");
    }

    if (
        Array.isArray(data.practiceReminders) &&
        data.practiceReminders.length > MAX_PRACTICE_COUNT
    ) {
        throw new Error("Too many practice reminders in backup");
    }

    const practiceIds = new Set<string>();

    for (const p of data.practices) {

        if (!p.id || typeof p.id !== "string") {
            throw new Error("Invalid practice id");
        }

        if (!p.name || typeof p.name !== "string") {
            throw new Error("Invalid practice name");
        }

        if (practiceIds.has(p.id)) {
            throw new Error("Duplicate practice id");
        }

        practiceIds.add(p.id);

        if (
            typeof p.targetCount !== "number" ||
            p.targetCount < 0 ||
            p.targetCount > MAX_TARGET_COUNT
        ) {
            throw new Error("Invalid target count");
        }

        if (
            typeof p.orderIndex !== "number" ||
            p.orderIndex < 0 ||
            p.orderIndex > MAX_PRACTICE_COUNT + 1
        ) {
            throw new Error("Invalid order index");
        }

        validateOptionalCount(
            p.dailyTargetCount,
            "daily target count",
            1
        );
        validateOptionalCount(
            p.defaultSessionCount,
            "default session count"
        );
        validateOptionalCount(
            p.defaultAddCount,
            "default add count"
        );

        if (
            p.calendarStartDate != null &&
            (
                typeof p.calendarStartDate !== "number" ||
                !Number.isFinite(p.calendarStartDate) ||
                p.calendarStartDate < 0 ||
                p.calendarStartDate >
                    Date.now() + 1000 * 60 * 60 * 24 * 365 * 10
            )
        ) {
            throw new Error("Invalid calendar start date");
        }

        if (p.customImageUri != null) {
            throw new Error("Backup contains a device-local image path");
        }

        if (
            p.originalImageKey != null &&
            (typeof p.originalImageKey !== "string" ||
                !/^[a-z0-9-]{1,64}$/.test(p.originalImageKey) ||
                p.originalImageKey === CUSTOM_PRACTICE_IMAGE_KEY)
        ) {
            throw new Error("Invalid original practice image");
        }

        if (p.imageKey === CUSTOM_PRACTICE_IMAGE_KEY) {
            const image = p.customImage;

            if (
                !image ||
                image.mimeType !== "image/jpeg" ||
                image.width !== CUSTOM_PRACTICE_IMAGE_WIDTH ||
                image.height !== CUSTOM_PRACTICE_IMAGE_HEIGHT ||
                typeof image.data !== "string" ||
                image.data.length === 0 ||
                image.data.length > MAX_BACKUP_IMAGE_BASE64_LENGTH ||
                !/^[A-Za-z0-9+/]+={0,2}$/.test(image.data)
            ) {
                throw new Error("Invalid custom practice image");
            }
        } else if (p.customImage != null) {
            throw new Error("Unexpected custom practice image");
        }
    }

    if (Array.isArray(data.practiceReminders)) {
        const reminderPracticeIds = new Set<string>();

        for (const reminder of data.practiceReminders) {
            if (
                !reminder ||
                typeof reminder !== "object" ||
                typeof reminder.practiceId !== "string" ||
                !practiceIds.has(reminder.practiceId)
            ) {
                throw new Error("Invalid practice reminder practice id");
            }

            if (reminderPracticeIds.has(reminder.practiceId)) {
                throw new Error("Duplicate practice reminder");
            }

            reminderPracticeIds.add(reminder.practiceId);

            if (typeof reminder.enabled !== "boolean") {
                throw new Error("Invalid practice reminder enabled flag");
            }

            if (!isValidReminderTime(reminder.hour, reminder.minute)) {
                throw new Error("Invalid practice reminder time");
            }
        }
    }

    for (const s of data.sessions) {

        if (typeof s.count !== "number" || s.count < 0 || s.count > MAX_REPETITIONS_PER_DAY) {
            throw new Error("Invalid session count");
        }

        if (typeof s.createdAt !== "number") {
            throw new Error("Invalid session date");
        }

        if (!s.practiceId || typeof s.practiceId !== "string") {
            throw new Error("Invalid session practiceId");
        }

        if (
            typeof s.createdAt !== "number" ||
            s.createdAt < 0 ||
            s.createdAt > Date.now() + 1000 * 60 * 60 * 24 * 365 * 10
        ) {
            throw new Error("Invalid session date");
        }

        if (
            s.localDate != null &&
            !isCalendarDateString(s.localDate)
        ) {
            throw new Error("Invalid session local date");
        }
    }

    const orderIndexes = new Set();

    for (const p of data.practices) {

        if (orderIndexes.has(p.orderIndex)) {
            throw new Error("Duplicate practice order index");
        }

        orderIndexes.add(p.orderIndex);

    }
    
}
