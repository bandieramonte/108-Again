function getDatePart(
    parts: Intl.DateTimeFormatPart[],
    type: Intl.DateTimeFormatPartTypes
) {
    return parts.find(part => part.type === type)?.value;
}

function fallbackMonthDayYear(date: Date, locale?: string | null) {
    const month = new Intl.DateTimeFormat(locale || undefined, {
        month: "long",
    }).format(date);
    const day = String(date.getDate()).padStart(2, "0");
    const year = String(date.getFullYear());

    return `${month} ${day}, ${year}`;
}

export function formatMonthDayYear(
    date: Date,
    locale?: string | null
) {
    try {
        const formatter = new Intl.DateTimeFormat(locale || undefined, {
            day: "2-digit",
            month: "long",
            year: "numeric",
        });
        const parts = formatter.formatToParts(date);
        const day = getDatePart(parts, "day");
        const month = getDatePart(parts, "month");
        const year = getDatePart(parts, "year");

        if (!day || !month || !year) {
            return fallbackMonthDayYear(date, locale);
        }

        return `${month} ${day}, ${year}`;
    } catch {
        return fallbackMonthDayYear(date, locale);
    }
}
