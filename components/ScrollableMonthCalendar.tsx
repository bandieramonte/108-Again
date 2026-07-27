import React, {
    ReactNode,
    useCallback,
    useEffect,
    useImperativeHandle,
    useMemo,
    useRef,
    useState,
} from "react";
import {
    InteractionManager,
    StyleSheet,
    Text,
    useWindowDimensions,
    View,
} from "react-native";
import PagerView, {
    type PageScrollStateChangedNativeEvent,
    type PagerViewOnPageSelectedEvent,
} from "react-native-pager-view";
import { useI18n } from "../i18n";
import { useAppTheme } from "../styles/theme";
import {
    buildCalendarMonthDays,
    clampCalendarMonthIndex,
    formatCalendarMonthLabel,
    getCalendarLoadedMonthIndexes,
    getCalendarMonthDate,
    getCalendarMonthIndex,
    getCalendarPagerMonthIndexes,
    type CalendarMonthDay,
} from "../utils/calendarMonth";
import CalendarNavigationHeader from "./CalendarNavigationHeader";

export type CalendarDayRenderContext = CalendarMonthDay & {
    isOutsideMonth: boolean;
    pageMonthIndex: number;
};

type Props = {
    headerAccessory?: ReactNode;
    initialMonth: Date;
    maximumMonth: Date;
    minimumMonth: Date;
    onFocusedMonthChange?: (month: Date) => void;
    onRenderDay: (day: CalendarDayRenderContext) => ReactNode;
};

export type ScrollableMonthCalendarHandle = {
    focusMonth: (month: Date) => void;
};

type MonthPageProps = {
    backgroundColor: string;
    borderColor: string;
    dayHeight: number;
    onRenderDay: Props["onRenderDay"];
    pageHeight: number;
    pageMonthIndex: number;
    shouldRenderDays: boolean;
};

const COLUMN_COUNT = 7;
const PAGER_MONTH_RADIUS = 12;

const CalendarMonthPage = React.memo(function CalendarMonthPage({
    backgroundColor,
    borderColor,
    dayHeight,
    onRenderDay,
    pageHeight,
    pageMonthIndex,
    shouldRenderDays,
}: MonthPageProps) {
    const days = useMemo(
        () => shouldRenderDays
            ? buildCalendarMonthDays(pageMonthIndex)
            : [],
        [pageMonthIndex, shouldRenderDays]
    );

    return (
        <View
            collapsable={false}
            style={[
                styles.monthPage,
                {
                    height: pageHeight,
                    backgroundColor,
                },
            ]}
        >
            {days.map((day, index) => (
                <View
                    key={`${pageMonthIndex}-${day.dateString}`}
                    style={[
                        styles.daySlot,
                        {
                            height: dayHeight,
                            borderColor,
                        },
                        index < COLUMN_COUNT && styles.firstRow,
                        index % COLUMN_COUNT === 0 &&
                            styles.firstColumn,
                    ]}
                >
                    {onRenderDay({
                        ...day,
                        isOutsideMonth:
                            day.monthIndex !== pageMonthIndex,
                        pageMonthIndex,
                    })}
                </View>
            ))}
        </View>
    );
});

const ScrollableMonthCalendar = React.forwardRef<
    ScrollableMonthCalendarHandle,
    Props
>(function ScrollableMonthCalendar({
    headerAccessory,
    initialMonth,
    maximumMonth,
    minimumMonth,
    onFocusedMonthChange,
    onRenderDay,
}, ref) {
    const { colors } = useAppTheme();
    const { locale, t } = useI18n();
    const { width } = useWindowDimensions();
    const dayHeight =
        width < 380 ? 44 :
            width > 700 ? 56 :
                50;
    const pageHeight = dayHeight * 6;
    const minimumMonthIndex = getCalendarMonthIndex(minimumMonth);
    const maximumMonthIndex = Math.max(
        minimumMonthIndex,
        getCalendarMonthIndex(maximumMonth)
    );
    const requestedInitialMonthIndex = clampCalendarMonthIndex(
        getCalendarMonthIndex(initialMonth),
        minimumMonthIndex,
        maximumMonthIndex
    );
    const lastRequestedInitialMonthIndex = useRef(
        requestedInitialMonthIndex
    );
    const [pagerAnchorMonthIndex, setPagerAnchorMonthIndex] =
        useState(requestedInitialMonthIndex);
    const [focusedMonthIndex, setFocusedMonthIndex] =
        useState(requestedInitialMonthIndex);
    const focusedMonthIndexRef = useRef(
        requestedInitialMonthIndex
    );
    const pendingRecenterMonthIndexRef =
        useRef<number | null>(null);
    const [pagerGeneration, setPagerGeneration] = useState(0);
    const [loadedMonthIndexes, setLoadedMonthIndexes] = useState(
        () => new Set([requestedInitialMonthIndex])
    );
    const weekDayLabels = useMemo(
        () => [
            t("calendar.mondayShort"),
            t("calendar.tuesdayShort"),
            t("calendar.wednesdayShort"),
            t("calendar.thursdayShort"),
            t("calendar.fridayShort"),
            t("calendar.saturdayShort"),
            t("calendar.sundayShort"),
        ],
        [t]
    );
    const pageMonthIndexes = useMemo(
        () => getCalendarPagerMonthIndexes(
            pagerAnchorMonthIndex,
            minimumMonthIndex,
            maximumMonthIndex,
            PAGER_MONTH_RADIUS
        ),
        [
            maximumMonthIndex,
            minimumMonthIndex,
            pagerAnchorMonthIndex,
        ]
    );
    const anchorPageIndex = pageMonthIndexes.indexOf(
        pagerAnchorMonthIndex
    );
    const focusedMonthLabel = useMemo(
        () => formatCalendarMonthLabel(
            focusedMonthIndex,
            locale
        ),
        [focusedMonthIndex, locale]
    );

    const loadMonthAndNeighbors = useCallback((
        targetMonthIndex: number
    ) => {
        setLoadedMonthIndexes(current => {
            const next = new Set(
                getCalendarLoadedMonthIndexes(
                    targetMonthIndex,
                    minimumMonthIndex,
                    maximumMonthIndex
                )
            );

            const unchanged =
                next.size === current.size &&
                [...next].every(monthIndex =>
                    current.has(monthIndex)
                );

            return unchanged ? current : next;
        });
    }, [maximumMonthIndex, minimumMonthIndex]);

    const rebuildPager = useCallback((targetMonthIndex: number) => {
        const clampedMonthIndex = clampCalendarMonthIndex(
            targetMonthIndex,
            minimumMonthIndex,
            maximumMonthIndex
        );

        setLoadedMonthIndexes(new Set([clampedMonthIndex]));
        setPagerAnchorMonthIndex(clampedMonthIndex);
        focusedMonthIndexRef.current = clampedMonthIndex;
        setFocusedMonthIndex(clampedMonthIndex);
        setPagerGeneration(current => current + 1);
    }, [maximumMonthIndex, minimumMonthIndex]);

    useImperativeHandle(ref, () => ({
        focusMonth(month: Date) {
            rebuildPager(getCalendarMonthIndex(month));
        },
    }), [rebuildPager]);

    useEffect(() => {
        onFocusedMonthChange?.(
            getCalendarMonthDate(focusedMonthIndex)
        );
    }, [focusedMonthIndex, onFocusedMonthChange]);

    useEffect(() => {
        if (
            lastRequestedInitialMonthIndex.current ===
            requestedInitialMonthIndex
        ) {
            return;
        }

        lastRequestedInitialMonthIndex.current =
            requestedInitialMonthIndex;
        rebuildPager(requestedInitialMonthIndex);
    }, [rebuildPager, requestedInitialMonthIndex]);

    useEffect(() => {
        const task = InteractionManager.runAfterInteractions(() => {
            loadMonthAndNeighbors(focusedMonthIndexRef.current);
        });

        return () => task.cancel();
    }, [
        loadMonthAndNeighbors,
        pagerAnchorMonthIndex,
        pagerGeneration,
    ]);

    const handlePageSelected = useCallback((
        event: PagerViewOnPageSelectedEvent
    ) => {
        const selectedPageIndex = event.nativeEvent.position;
        const selectedMonthIndex =
            pageMonthIndexes[selectedPageIndex];

        if (
            typeof selectedMonthIndex === "number" &&
            selectedMonthIndex !== focusedMonthIndexRef.current
        ) {
            focusedMonthIndexRef.current = selectedMonthIndex;
            setFocusedMonthIndex(selectedMonthIndex);

            const reachedFirstPage =
                selectedPageIndex === 0 &&
                selectedMonthIndex > minimumMonthIndex;
            const reachedLastPage =
                selectedPageIndex === pageMonthIndexes.length - 1 &&
                selectedMonthIndex < maximumMonthIndex;

            if (reachedFirstPage || reachedLastPage) {
                pendingRecenterMonthIndexRef.current =
                    selectedMonthIndex;
            }
        }
    }, [
        maximumMonthIndex,
        minimumMonthIndex,
        pageMonthIndexes,
    ]);

    const handlePageScrollStateChanged = useCallback((
        event: PageScrollStateChangedNativeEvent
    ) => {
        if (event.nativeEvent.pageScrollState !== "idle") return;

        const pendingRecenterMonthIndex =
            pendingRecenterMonthIndexRef.current;

        if (pendingRecenterMonthIndex != null) {
            pendingRecenterMonthIndexRef.current = null;
            rebuildPager(pendingRecenterMonthIndex);
            return;
        }

        loadMonthAndNeighbors(focusedMonthIndexRef.current);
    }, [loadMonthAndNeighbors, rebuildPager]);

    return (
        <View style={styles.container}>
            <CalendarNavigationHeader
                canGoBack={focusedMonthIndex > minimumMonthIndex}
                canGoForward={focusedMonthIndex < maximumMonthIndex}
                label={focusedMonthLabel}
                onPreviousYear={() =>
                    rebuildPager(focusedMonthIndex - 12)
                }
                onPreviousMonth={() =>
                    rebuildPager(focusedMonthIndex - 1)
                }
                onNextMonth={() =>
                    rebuildPager(focusedMonthIndex + 1)
                }
                onNextYear={() =>
                    rebuildPager(focusedMonthIndex + 12)
                }
            />

            {headerAccessory}

            <View style={styles.weekHeader}>
                {weekDayLabels.map((label, index) => (
                    <Text
                        key={`${label}-${index}`}
                        style={[
                            styles.weekHeaderText,
                            { color: colors.textSecondary },
                        ]}
                    >
                        {label}
                    </Text>
                ))}
            </View>

            <PagerView
                key={`${pagerAnchorMonthIndex}-${pagerGeneration}`}
                initialPage={anchorPageIndex}
                offscreenPageLimit={1}
                onPageSelected={handlePageSelected}
                onPageScrollStateChanged={
                    handlePageScrollStateChanged
                }
                orientation="horizontal"
                overScrollMode="never"
                scrollEnabled={pageMonthIndexes.length > 1}
                style={{ height: pageHeight }}
            >
                {pageMonthIndexes.map(pageMonthIndex => (
                    <CalendarMonthPage
                        key={String(pageMonthIndex)}
                        backgroundColor={colors.background}
                        borderColor={colors.borderSubtle}
                        dayHeight={dayHeight}
                        onRenderDay={onRenderDay}
                        pageHeight={pageHeight}
                        pageMonthIndex={pageMonthIndex}
                        shouldRenderDays={
                            loadedMonthIndexes.has(pageMonthIndex)
                        }
                    />
                ))}
            </PagerView>
        </View>
    );
});

export default ScrollableMonthCalendar;

const styles = StyleSheet.create({
    container: {
        width: "100%",
        maxWidth: 700,
        alignSelf: "center",
    },

    weekHeader: {
        height: 34,
        flexDirection: "row",
        alignItems: "center",
    },

    weekHeaderText: {
        flex: 1,
        textAlign: "center",
        fontWeight: "600",
    },

    monthPage: {
        width: "100%",
        flexDirection: "row",
        flexWrap: "wrap",
    },

    daySlot: {
        width: `${100 / COLUMN_COUNT}%`,
        borderRightWidth: StyleSheet.hairlineWidth,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },

    firstColumn: {
        borderLeftWidth: StyleSheet.hairlineWidth,
    },

    firstRow: {
        borderTopWidth: StyleSheet.hairlineWidth,
    },
});
