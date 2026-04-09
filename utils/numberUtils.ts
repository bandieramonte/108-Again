export const MAX_PRACTICE_COUNT = 10;
export const MAX_TARGET_COUNT = 1_111_111;
export const MAX_REPETITIONS_PER_DAY = 1_111_111;
export const MAX_PRACTICE_NAME = 25;

export function validateRepetitionsPerSession(
    value: string
): string | null {

    const baseError = validateNonNegativeInteger(
        value,
        "Repetitions per day"
    );

    if (baseError) return baseError;

    const num = Number(value);

    if (num > MAX_REPETITIONS_PER_DAY) {
        return `Repetitions per day cannot exceed ${MAX_REPETITIONS_PER_DAY.toLocaleString()}`;
    }

    return null;
}

export function digitsOnly(value: string) {
    return value.replace(/[^0-9]/g, "");
}

export function parsePositiveInt(value: string): number {
    const num = Number(value);

    if (!Number.isFinite(num)) return 0;
    if (!Number.isInteger(num)) return 0;
    if (num < 0) return 0;

    return num;
}

export function validateNonNegativeInteger(
    value: string,
    label: string
): string | null {

    if (!value.trim()) {
        return `${label} is required`;
    }

    const num = Number(value);

    if (!Number.isFinite(num)) {
        return `${label} must be a number`;
    }

    if (!Number.isInteger(num)) {
        return `${label} must be a whole number`;
    }

    if (num < 0) {
        return `${label} cannot be negative`;
    }

    return null;
}

export function validateTargetCount(value: string): string | null {

    const baseError = validateNonNegativeInteger(value, "Target count");
    if (baseError) return baseError;

    const num = Number(value);

    if (num > MAX_TARGET_COUNT) {
        return `Target count cannot exceed ${MAX_TARGET_COUNT.toLocaleString()}`;
    }

    return null;
}

export function formatNumber(value: number | string): string {
    const num =
        typeof value === "string"
            ? Number(value)
            : value;

    if (!Number.isFinite(num)) return String(value);

    return new Intl.NumberFormat().format(num);
}