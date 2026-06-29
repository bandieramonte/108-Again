export type ReminderTimeOption = {
    hour: number;
    key: string;
    minute: number;
};

const HALF_HOUR_MINUTES = 30;
const DAY_MINUTES = 24 * 60;

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

export function buildReminderTimeOptions(
    startDate = new Date(),
    count = DAY_MINUTES / HALF_HOUR_MINUTES
): ReminderTimeOption[] {
    const start = roundUpToNextHalfHour(startDate);
    const startMinutes = start.hour * 60 + start.minute;

    return Array.from({ length: count }, (_, index) => {
        const minutes =
            (startMinutes + index * HALF_HOUR_MINUTES) % DAY_MINUTES;
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
    locale?: string | null
) {
    const date = new Date(2000, 0, 1, hour, minute, 0, 0);

    try {
        return new Intl.DateTimeFormat(locale || undefined, {
            hour: "numeric",
            minute: "2-digit",
        }).format(date);
    } catch {
        return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
    }
}
