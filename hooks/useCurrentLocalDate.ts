import { useEffect, useRef, useState } from "react";
import { AppState } from "react-native";

const MIDNIGHT_SETTLE_MS = 50;
const TIMEZONE_CHECK_MS = 60 * 1000;

function getLocalClockSignature(date: Date) {
    return [
        date.getFullYear(),
        date.getMonth(),
        date.getDate(),
        date.getTimezoneOffset(),
    ].join(":");
}

function millisecondsUntilNextLocalDay(now: Date) {
    const nextDay = new Date(now);
    nextDay.setHours(24, 0, 0, MIDNIGHT_SETTLE_MS);

    return Math.max(1, nextDay.getTime() - now.getTime());
}

export function useCurrentLocalDate(active = true) {
    const [currentDate, setCurrentDate] = useState(
        () => new Date()
    );
    const clockSignatureRef = useRef(
        getLocalClockSignature(currentDate)
    );

    useEffect(() => {
        if (!active) return;

        let timer: ReturnType<typeof setTimeout> | null = null;
        let timezoneCheck: ReturnType<typeof setInterval> | null = null;

        function refreshAndScheduleMidnight() {
            const now = new Date();

            clockSignatureRef.current = getLocalClockSignature(now);
            setCurrentDate(now);

            if (timer) {
                clearTimeout(timer);
            }

            timer = setTimeout(
                refreshAndScheduleMidnight,
                millisecondsUntilNextLocalDay(now)
            );
        }

        refreshAndScheduleMidnight();
        timezoneCheck = setInterval(() => {
            const now = new Date();

            if (
                getLocalClockSignature(now) !==
                clockSignatureRef.current
            ) {
                refreshAndScheduleMidnight();
            }
        }, TIMEZONE_CHECK_MS);

        const subscription = AppState.addEventListener(
            "change",
            nextState => {
                if (nextState === "active") {
                    // Recompute both the date and the next midnight after a
                    // timezone or daylight-saving change while backgrounded.
                    refreshAndScheduleMidnight();
                }
            }
        );

        return () => {
            if (timer) clearTimeout(timer);
            if (timezoneCheck) clearInterval(timezoneCheck);
            subscription.remove();
        };
    }, [active]);

    return currentDate;
}
