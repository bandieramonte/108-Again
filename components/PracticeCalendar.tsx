import { FlashList, FlashListRef } from "@shopify/flash-list";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Dimensions, Pressable, StyleSheet, Text, TextInput, useWindowDimensions, View } from "react-native";
import { colors } from "../styles/theme";

type DayData = {
    date: string;
    count: number;
};

type Props = {
    data: DayData[];
    startDate: Date;
    endDate: Date;
    onEditDay: (date: string, value: number) => void;
};

const ARROW_HIT_SLOP = {
    top: 18,
    bottom: 18,
    left: 18,
    right: 18,
};

export default function PracticeCalendar({
    data,
    startDate,
    endDate,
    onEditDay
}: Props) {

    const { width } = useWindowDimensions();

    const WEEK_HEIGHT =
        width < 380 ? 44 :
            width > 700 ? 56 :
                50;
    const VISIBLE_WEEKS = 5;

    const dataMap = useMemo(() => {
        return new Map(data.map(d => [d.date, d.count]));
    }, [data]);

    const baseWeekStart = useMemo(() => {
        return getWeekStart(startDate);
    }, [startDate]);

    const effectiveEndDate = useMemo(() => {
        const d = new Date(endDate);

        let day = d.getDay();

        // Convert Sunday (0) → 7
        if (day === 0) day = 7;

        const daysUntilSunday = 7 - day;

        d.setDate(d.getDate() + daysUntilSunday);

        return d;
    }, [endDate]);

    const endWeekIndex = useMemo(() => {
        const diffDays =
            (effectiveEndDate.getTime() - baseWeekStart.getTime()) /
            (1000 * 60 * 60 * 24);

        return Math.floor(diffDays / 7);
    }, [effectiveEndDate, baseWeekStart]);

    const [visibleEndWeek, setVisibleEndWeek] = useState(endWeekIndex);
    const totalWeeks = visibleEndWeek + 1;

    const [visibleMonth, setVisibleMonth] = useState("");


    const [editingDate, setEditingDate] = useState<string | null>(null);
    const [editingValue, setEditingValue] = useState("");

    const handleScroll = useRef((event: any) => {

        const offsetY =
            event.nativeEvent.contentOffset.y;

        const firstVisibleIndex =
            Math.floor(offsetY / WEEK_HEIGHT);

        currentIndex.current = firstVisibleIndex;

        const dominantIndex =
            firstVisibleIndex +
            Math.floor(VISIBLE_WEEKS / 2);

        const month =
            getMonthFromWeek(dominantIndex);

        currentOffset.current =
            event.nativeEvent.contentOffset.y;


        setVisibleMonth(prev =>
            prev === month ? prev : month
        );

    }).current;

    const todayString = useMemo(() => {
        return formatDate(new Date());
    }, []);

    const endDateString = useMemo(() => {
        return formatDate(endDate);
    }, [endDate]);

    const weekIndexes = useMemo(
        () => Array.from({ length: totalWeeks }, (_, i) => i),
        [totalWeeks]
    );

    const listRef = useRef<FlashListRef<number>>(null);
    const currentOffset = useRef(0);
    const currentIndex = useRef(0);
    const hasInitialScroll = useRef(false);

    useEffect(() => {

        const dominantIndex =
            Math.floor(VISIBLE_WEEKS / 2);

        const month =
            getMonthFromWeek(dominantIndex);

        setVisibleMonth(month);

    }, [startDate]);

    useEffect(() => {
        setVisibleEndWeek(endWeekIndex);
    }, [endWeekIndex]);

    useEffect(() => {
        hasInitialScroll.current = false;
    }, [startDate]);

    function scrollToToday() {
        if (hasInitialScroll.current) return;
        if (!listRef.current) return;

        listRef.current?.scrollToIndex({
            index: Math.max(
                0,
                getTodayWeekIndex() - Math.floor(VISIBLE_WEEKS / 2)
            ),
            animated: false
        });

        hasInitialScroll.current = true;
    }

    function formatMonth(date: Date) {
        return date.toLocaleDateString(undefined, {
            month: "long",
            year: "numeric"
        });
    }

    function getMonthFromWeek(index: number) {

        const start = new Date(baseWeekStart);
        start.setUTCDate(start.getUTCDate() + index * 7);

        return formatMonth(start);
    }

    function getWeekStart(date: Date) {

        const d = new Date(date);
        const day = d.getDay();
        const adjusted = day === 0 ? 7 : day;
        d.setDate(d.getDate() - adjusted + 1);
        return d;
    }

    function getWeek(index: number) {

        const start = new Date(baseWeekStart);
        start.setUTCDate(start.getUTCDate() + index * 7);

        const week = [];

        for (let i = 0; i < 7; i++) {

            const d = new Date(start);
            d.setUTCDate(start.getUTCDate() + i);

            const date =
                d.getUTCFullYear() +
                "-" +
                String(d.getUTCMonth() + 1).padStart(2, "0") +
                "-" +
                String(d.getUTCDate()).padStart(2, "0");

            week.push({
                date,
                count: dataMap.get(date) ?? 0
            });
        }

        return week;
    }

    function isEditable(date: string) {
        const today = formatDate(new Date());
        return date <= today;
    }

    function formatDate(date: Date) {
        return (
            date.getUTCFullYear() +
            "-" +
            String(date.getUTCMonth() + 1).padStart(2, "0") +
            "-" +
            String(date.getUTCDate()).padStart(2, "0")
        );
    }

    function scrollByMonth(direction: 1 | -1) {

        const centerIndex =
            currentIndex.current +
            Math.floor(VISIBLE_WEEKS / 2);

        const centerDate = new Date(baseWeekStart);
        centerDate.setUTCDate(
            centerDate.getUTCDate() + centerIndex * 7
        );

        // move exactly one month
        const targetMonth = new Date(Date.UTC(
            centerDate.getUTCFullYear(),
            centerDate.getUTCMonth() + direction,
            1
        ));

        // find week start for that date
        const targetWeekStart = getWeekStart(targetMonth);

        const diffDays =
            (targetWeekStart.getTime() - baseWeekStart.getTime()) /
            (1000 * 60 * 60 * 24);

        const newIndex = Math.floor(diffDays / 7);

        listRef.current?.scrollToOffset({
            offset: newIndex * WEEK_HEIGHT,
            animated: true
        });
    }

    function scrollByYear(direction: 1 | -1) {

        const centerIndex =
            currentIndex.current +
            Math.floor(VISIBLE_WEEKS / 2);

        const centerDate = new Date(baseWeekStart);

        centerDate.setUTCDate(
            centerDate.getUTCDate() + centerIndex * 7
        );

        const targetMonth = new Date(Date.UTC(
            centerDate.getUTCFullYear() + direction,
            centerDate.getUTCMonth(),
            1
        ));

        const targetWeekStart =
            getWeekStart(targetMonth);

        const diffDays =
            (targetWeekStart.getTime() - baseWeekStart.getTime()) /
            (1000 * 60 * 60 * 24);

        const newIndex =
            Math.floor(diffDays / 7);

        listRef.current?.scrollToOffset({
            offset: newIndex * WEEK_HEIGHT,
            animated: true
        });
    }

    function getTodayWeekIndex() {

        const today = new Date();

        const diffDays =
            (today.getTime() - baseWeekStart.getTime()) /
            (1000 * 60 * 60 * 24);

        return Math.max(0, Math.floor(diffDays / 7));
    }

    return (
        <View style={styles.container}>
            <View
                style={{
                    maxWidth: 700,
                    alignSelf: "center",
                    width: "100%"
                }}
            >
                <View style={styles.monthHeaderRow}>

                    <View style={styles.arrowGroup}>

                        <Pressable
                            onPress={() => scrollByYear(-1)}
                            hitSlop={ARROW_HIT_SLOP}
                            style={styles.monthArrow}
                        >
                            <View style={styles.doubleArrow}>
                                <Text style={styles.fastArrowGlyph}>▲</Text>
                                <Text style={styles.fastArrowGlyph}>▲</Text>
                            </View>
                        </Pressable>

                        <Pressable
                            onPress={() => scrollByMonth(-1)}
                            hitSlop={ARROW_HIT_SLOP}
                            style={styles.monthArrow}
                        >
                            <Text style={styles.monthArrowText}>
                                ▲
                            </Text>
                        </Pressable>

                    </View>

                    <Text style={styles.monthHeader}>
                        {visibleMonth}
                    </Text>

                    <View style={styles.arrowGroup}>

                        <Pressable
                            onPress={() => scrollByMonth(1)}
                            hitSlop={ARROW_HIT_SLOP}
                            style={styles.monthArrow}
                        >
                            <Text style={styles.monthArrowText}>
                                ▼
                            </Text>
                        </Pressable>

                        <Pressable
                            onPress={() => scrollByYear(1)}
                            hitSlop={ARROW_HIT_SLOP}
                            style={styles.monthArrow}
                        >
                            <View style={styles.doubleArrow}>
                                <Text style={styles.fastArrowGlyph}>▼</Text>
                                <Text style={styles.fastArrowGlyph}>▼</Text>
                            </View>
                        </Pressable>

                    </View>

                </View>

                <View style={styles.weekHeader}>
                    {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
                        <Text key={i} style={styles.weekHeaderText}>
                            {d}
                        </Text>
                    ))}
                </View>

                <View style={{ height: WEEK_HEIGHT * VISIBLE_WEEKS }}>
                    <FlashList<number>
                        onContentSizeChange={() => {
                            scrollToToday();
                        }}
                        onScroll={handleScroll}
                        scrollEventThrottle={16}
                        nestedScrollEnabled
                        data={weekIndexes}
                        keyExtractor={(i) => String(i)}
                        snapToInterval={WEEK_HEIGHT}
                        disableIntervalMomentum
                        ref={listRef}
                        renderItem={({ item }) => {

                            const week = getWeek(item);

                            return (
                                <View
                                    style={[
                                        styles.weekRow,
                                        { height: WEEK_HEIGHT }
                                    ]}
                                >
                                    {week.map((day, index) => {

                                        const isToday = day.date === todayString;
                                        const isTargetDate = day.date === endDateString;

                                        const isFirstColumn = index === 0;
                                        const isFirstRow = item === 0;
                                        const editable = isEditable(day.date);
                                        return (
                                            <Pressable
                                                key={day.date}
                                                onPress={() => {
                                                    if (!isEditable(day.date)) return;

                                                    setEditingDate(day.date);
                                                    setEditingValue(String(day.count || ""));
                                                }}
                                                style={[
                                                    styles.day,
                                                    editable ? styles.editableDay : styles.futureDay,
                                                    isFirstColumn && styles.firstColumn,
                                                    isFirstRow && styles.firstRow,
                                                    isToday && styles.today,
                                                    isTargetDate && styles.targetDate
                                                ]}
                                            >
                                                {editable && <View style={styles.editableAccent} />}
                                                <Text
                                                    style={[
                                                        styles.dayNumber,
                                                        !editable && styles.futureDayText
                                                    ]}
                                                >
                                                    {day.date.slice(-2)}
                                                </Text>

                                                {editingDate === day.date ? (
                                                    <TextInput
                                                        value={editingValue}
                                                        onChangeText={setEditingValue}
                                                        keyboardType="numeric"
                                                        autoFocus
                                                        numberOfLines={1}
                                                        style={[
                                                            styles.dayCountInput,
                                                            editingValue.length >= 5 && styles.dayCountSmall,
                                                            editingValue.length >= 7 && styles.dayCountVerySmall
                                                        ]} onBlur={() => {
                                                            const value = Number(editingValue) || 0;
                                                            onEditDay(day.date, value);
                                                            setEditingDate(null);
                                                        }}
                                                    />
                                                ) : (
                                                    <Text
                                                        numberOfLines={1}
                                                        adjustsFontSizeToFit
                                                        minimumFontScale={0.6}
                                                        style={[
                                                            styles.dayCount,
                                                            day.count === 0 && styles.dayCountEmpty,
                                                            !editable && styles.futureDayText
                                                        ]}
                                                    >
                                                        {day.count}
                                                    </Text>
                                                )}
                                            </Pressable>
                                        );
                                    })}
                                </View>
                            );
                        }}

                        style={{
                            minHeight: WEEK_HEIGHT * VISIBLE_WEEKS
                        }}

                        showsVerticalScrollIndicator={false}
                    />
                </View>



            </View>
        </View>);
}

const isSmallScreen = Dimensions.get("window").width < 360;
const borderWidth = isSmallScreen ? 1 : 2
const fontSize = isSmallScreen ? 13 : 16

const styles = StyleSheet.create({

    container: {
        marginTop: 20
    },

    weekHeader: {
        flexDirection: "row",
        marginBottom: 10,
        marginTop: 8
    },

    weekHeaderText: {
        flex: 1,
        textAlign: "center",
        fontWeight: "600",
    },

    weekRow: {
        flexDirection: "row",
    },

    day: {
        flex: 1,
        paddingHorizontal: 1,
        paddingTop: 15,
        justifyContent: "center",
        alignItems: "center",
        borderRightWidth: borderWidth,
        borderBottomWidth: borderWidth,
        borderColor: "#e5e7eb"
    },

    dayNumber: {
        position: "absolute",
        top: 4,
        left: 6,
        fontSize: 11,
        fontWeight: "700",
        color: "#555"
    },

    dayCount: {
        fontSize: fontSize,
        textAlign: "center",
        width: "100%",
        includeFontPadding: false,
        color: colors.primary
    },

    monthHeader: {
        fontSize: 18,
        fontWeight: "600",
        marginBottom: 8,
        textAlign: "center",
        width: 150
    },

    today: {
        borderColor: colors.primary,
        borderLeftWidth: borderWidth,
        borderTopWidth: borderWidth,
        borderBottomWidth: borderWidth,
        borderRightWidth: borderWidth,
    },

    targetDate: {
        borderTopWidth: borderWidth,
        borderBottomWidth: borderWidth,
        borderRightWidth: borderWidth,
        borderLeftWidth: borderWidth,
        borderColor: "#f59e0b",
        backgroundColor: "rgba(245,158,11,0.08)"
    },

    dayCountEmpty: {
        color: "#bbb",
    },

    firstColumn: {
        borderLeftWidth: borderWidth,
    },

    firstRow: {
        borderTopWidth: borderWidth,
    },

    dayCountInput: {
        fontSize: fontSize,
        fontWeight: "600",
        textAlign: "center",
        width: "100%",
        minHeight: 32,
        textAlignVertical: "center",
        paddingVertical: 0,
        includeFontPadding: false,
        color: colors.primary
    },

    dayCountSmall: {
        fontSize: 13
    },

    dayCountVerySmall: {
        fontSize: 11
    },

    monthHeaderRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        paddingVertical: 8,
        marginVertical: -8,
    },

    monthArrow: {
        // paddingHorizontal: 14,
        paddingVertical: 10,
    },

    monthArrowText: {
        fontSize: 20,
        fontWeight: "600",
        color: "#555"
    },

    editableDay: {
        backgroundColor: "rgba(59,130,246,0.04)",
    },

    futureDay: {
        backgroundColor: "#fafafa",
        opacity: 0.65,
    },

    futureDayText: {
        color: "#c5c5c5",
    },
    editHint: {
        position: "absolute",
        top: 4,
        right: 6,
        fontSize: 10,
        color: "#9ca3af",
        fontWeight: "600",
    },
    editableAccent: {
        position: "absolute",
        bottom: 4,
        width: 18,
        height: 2,
        borderRadius: 2,
        backgroundColor: colors.primary,
        opacity: 0.35,
    },

    arrowGroup: {
        flexDirection: "row",
        alignItems: "center",
        gap: 20,
    },

    doubleArrow: {
        alignItems: "center",
        justifyContent: "center",
        gap: -8,
    },

    fastArrowGlyph: {
        fontSize: 16,
        fontWeight: "700",
        color: "#555",
        lineHeight: 11,
    },
});
