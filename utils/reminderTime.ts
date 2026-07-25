export type ReminderTimeOption = {
    hour: number;
    key: string;
    minute: number;
};

const HALF_HOUR_MINUTES = 30;
const DAY_MINUTES = 24 * 60;

function normalizeMinutes(minutes: number) {
    return ((minutes % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES;
}

export function roundUpToNextHalfHour(date: Date) {
    const minutes =
        date.getHours() * 60 +
        date.getMinutes() +
        (date.getSeconds() > 0 || date.getMilliseconds() > 0 ? 1 : 0);
    const rounded =
        Math.ceil(minutes / HALF_HOUR_MINUTES) * HALF_HOUR_MINUTES;
    const normalized = rounded % DAY_MINUTES;

    return {
        hour: Math.floor(normalized / 60),
        minute: normalized % 60,
    };
}

export function roundToNearestHalfHour(date: Date) {
    const minutes =
        date.getHours() * 60 +
        date.getMinutes() +
        date.getSeconds() / 60 +
        date.getMilliseconds() / 60000;
    const rounded = normalizeMinutes(
        Math.round(minutes / HALF_HOUR_MINUTES) * HALF_HOUR_MINUTES
    );

    return {
        hour: Math.floor(rounded / 60),
        minute: rounded % 60,
    };
}

export function buildReminderTimeOptions(
    anchorDate = new Date(),
    count = DAY_MINUTES / HALF_HOUR_MINUTES
): ReminderTimeOption[] {
    const anchor = roundToNearestHalfHour(anchorDate);
    const anchorMinutes = anchor.hour * 60 + anchor.minute;
    const optionsBeforeAnchor = Math.floor(count / 2);
    const startMinutes =
        anchorMinutes - optionsBeforeAnchor * HALF_HOUR_MINUTES;

    return Array.from({ length: count }, (_, index) => {
        const minutes = normalizeMinutes(
            startMinutes + index * HALF_HOUR_MINUTES
        );
        const hour = Math.floor(minutes / 60);
        const minute = minutes % 60;

        return {
            hour,
            key: `${index}-${hour}-${minute}`,
            minute,
        };
    });
}

export function reminderTimeMatches(
    option: { hour: number; minute: number },
    hour: number,
    minute: number
) {
    return option.hour === hour && option.minute === minute;
}

export function formatReminderTimeForLocale(
    hour: number,
    minute: number,
    locale?: string | null,
    uses24HourClock?: boolean | null
) {
    const date = new Date(2000, 0, 1, hour, minute, 0, 0);
    const options: Intl.DateTimeFormatOptions = {
        hour: "numeric",
        minute: "2-digit",
    };

    if (uses24HourClock != null) {
        options.hour12 = !uses24HourClock;
    }

    try {
        return new Intl.DateTimeFormat(
            locale || undefined,
            options
        ).format(date);
    } catch {
        return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
    }
}
