import { useEffect, useState } from "react";

const MIDNIGHT_SETTLE_MS = 50;

function millisecondsUntilNextLocalDay(now: Date) {
    const nextDay = new Date(now);
    nextDay.setHours(24, 0, 0, MIDNIGHT_SETTLE_MS);

    return Math.max(1, nextDay.getTime() - now.getTime());
}

export function useCurrentLocalDate(active = true) {
    const [currentDate, setCurrentDate] = useState(
        () => new Date()
    );

    useEffect(() => {
        if (!active) return;

        let timer: ReturnType<typeof setTimeout>;

        function refreshAtMidnight() {
            const now = new Date();
            setCurrentDate(now);
            timer = setTimeout(
                refreshAtMidnight,
                millisecondsUntilNextLocalDay(now)
            );
        }

        refreshAtMidnight();

        return () => clearTimeout(timer);
    }, [active]);

    return currentDate;
}
