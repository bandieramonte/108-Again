import { MAX_PRACTICE_COUNT, MAX_REPETITIONS_PER_DAY, MAX_TARGET_COUNT } from "../utils/numberUtils";
import { getAppOperationEngine } from "./appOperationRuntime";

const BACKUP_APP_ID = "app108again";

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

export function getBackupData() {
    return getAppOperationEngine().getBackupData();
}

export async function restoreBackupData(data: any) {
    await getAppOperationEngine().restoreBackupData(data);
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

    if (data.practices.length > MAX_PRACTICE_COUNT) {
        throw new Error("Too many practices in backup");
    }

    if (data.sessions.length > 10000) {
        throw new Error("Too many sessions in backup");
    }

    if (data.practices.length === 0) {
        throw new Error("Backup contains no practices");
    }

    for (const p of data.practices) {

        if (!p.id || typeof p.id !== "string") {
            throw new Error("Invalid practice id");
        }

        if (!p.name || typeof p.name !== "string") {
            throw new Error("Invalid practice name");
        }

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
    }

    const orderIndexes = new Set();

    for (const p of data.practices) {

        if (orderIndexes.has(p.orderIndex)) {
            throw new Error("Duplicate practice order index");
        }

        orderIndexes.add(p.orderIndex);

    }
    
}
