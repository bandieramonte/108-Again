export type CalendarMonthDay = {
    dateString: string;
    day: number;
    monthIndex: number;
};

const DAYS_PER_WEEK = 7;
const WEEKS_PER_PAGE = 6;

export function getCalendarMonthIndex(date: Date) {
    return date.getFullYear() * 12 + date.getMonth();
}

export function getCalendarMonthDate(monthIndex: number) {
    const year = Math.floor(monthIndex / 12);
    const month = monthIndex - year * 12;

    return new Date(year, month, 1);
}

export function clampCalendarMonthIndex(
    monthIndex: number,
    minimumMonthIndex: number,
    maximumMonthIndex: number
) {
    return Math.min(
        Math.max(monthIndex, minimumMonthIndex),
        maximumMonthIndex
    );
}

export function getCalendarPagerMonthIndexes(
    focusedMonthIndex: number,
    minimumMonthIndex: number,
    maximumMonthIndex: number,
    radius = 12
) {
    const boundedFocusedMonthIndex = clampCalendarMonthIndex(
        focusedMonthIndex,
        minimumMonthIndex,
        maximumMonthIndex
    );
    const firstMonthIndex = Math.max(
        minimumMonthIndex,
        boundedFocusedMonthIndex - radius
    );
    const lastMonthIndex = Math.min(
        maximumMonthIndex,
        boundedFocusedMonthIndex + radius
    );

    return Array.from(
        { length: lastMonthIndex - firstMonthIndex + 1 },
        (_, index) => firstMonthIndex + index
    );
}

export function getCalendarLoadedMonthIndexes(
    focusedMonthIndex: number,
    minimumMonthIndex: number,
    maximumMonthIndex: number
) {
    return getCalendarPagerMonthIndexes(
        focusedMonthIndex,
        minimumMonthIndex,
        maximumMonthIndex,
        1
    );
}

export function formatCalendarDate(date: Date) {
    return (
        date.getFullYear() +
        "-" +
        String(date.getMonth() + 1).padStart(2, "0") +
        "-" +
        String(date.getDate()).padStart(2, "0")
    );
}

export function getCalendarDateFromString(dateString: string) {
    const [year, month, day] = dateString
        .split("-")
        .map(value => Number.parseInt(value, 10));

    return new Date(year, month - 1, day);
}

export function isPracticeCalendarDateEditable(
    dateString: string,
    startDateString: string,
    todayString: string
) {
    return (
        dateString >= startDateString &&
        dateString <= todayString
    );
}

export function formatCalendarMonthLabel(
    monthIndex: number,
    locale: string
) {
    return getCalendarMonthDate(monthIndex).toLocaleDateString(locale, {
        month: "long",
        year: "numeric",
    });
}

export function buildCalendarMonthDays(
    monthIndex: number
): CalendarMonthDay[] {
    const firstOfMonth = getCalendarMonthDate(monthIndex);
    const mondayBasedWeekday =
        (firstOfMonth.getDay() + 6) % DAYS_PER_WEEK;
    const firstVisibleDate = new Date(firstOfMonth);

    firstVisibleDate.setDate(
        firstVisibleDate.getDate() - mondayBasedWeekday
    );

    return Array.from(
        { length: DAYS_PER_WEEK * WEEKS_PER_PAGE },
        (_, index) => {
            const date = new Date(firstVisibleDate);
            date.setDate(firstVisibleDate.getDate() + index);

            return {
                dateString: formatCalendarDate(date),
                day: date.getDate(),
                monthIndex: getCalendarMonthIndex(date),
            };
        }
    );
}
