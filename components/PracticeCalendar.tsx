import { MaterialIcons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    Dimensions,
    FlatList,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    useWindowDimensions,
    View,
} from "react-native";
import { useI18n } from "../i18n";
import { useAppTheme } from "../styles/theme";
import {
    formatNumber,
    formatNumberInput,
    parseFormattedNumberInput,
} from "../utils/numberUtils";

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

function getMonthLabel(baseWeekStart: Date, index: number, locale: string) {
    const start = new Date(baseWeekStart);
    start.setUTCDate(start.getUTCDate() + index * 7);

    return start.toLocaleDateString(locale, {
        month: "long",
        year: "numeric"
    });
}

function getDateLabel(dateString: string, locale: string) {
    const [year, month, day] = dateString
        .split("-")
        .map(value => Number.parseInt(value, 10));
    const date = new Date(Date.UTC(year, month - 1, day));

    return date.toLocaleDateString(locale, {
        day: "numeric",
        month: "long",
        year: "numeric",
    });
}

export default function PracticeCalendar({
    data,
    startDate,
    endDate,
    onEditDay
}: Props) {

    const { colors, isDark } = useAppTheme();
    const { locale, t } = useI18n();
    const { width } = useWindowDimensions();
    const editableDayBackground = isDark
        ? colors.background
        : colors.inputBackground;
    const futureDayBackground = isDark
        ? colors.inputReadOnlyBackground
        : colors.surface;

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

    const totalWeeks = endWeekIndex + 1;

    const initialScrollIndex = useMemo(() => {
        const diffDays =
            (Date.now() - baseWeekStart.getTime()) /
            (1000 * 60 * 60 * 24);
        const todayWeekIndex = Math.max(0, Math.floor(diffDays / 7));

        return Math.max(
            0,
            todayWeekIndex - Math.floor(VISIBLE_WEEKS / 2)
        );
    }, [baseWeekStart]);

    const [visibleMonth, setVisibleMonth] = useState(() =>
        getMonthLabel(
            baseWeekStart,
            initialScrollIndex + Math.floor(VISIBLE_WEEKS / 2),
            locale
        )
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


    const [editingDate, setEditingDate] = useState<string | null>(null);
    const [editingValue, setEditingValue] = useState("");
    const listRef = useRef<FlatList<number>>(null);
    const currentIndex = useRef(initialScrollIndex);
    const inputRef = useRef<TextInput>(null);

    const handleScroll = useCallback((event: any) => {

        const offsetY =
            event.nativeEvent.contentOffset.y;

        const firstVisibleIndex =
            Math.floor(offsetY / WEEK_HEIGHT);

        currentIndex.current = firstVisibleIndex;

        const dominantIndex =
            firstVisibleIndex +
            Math.floor(VISIBLE_WEEKS / 2);

        const month = getMonthLabel(baseWeekStart, dominantIndex, locale);

        setVisibleMonth(prev =>
            prev === month ? prev : month
        );

    }, [baseWeekStart, locale, WEEK_HEIGHT]);

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

    useEffect(() => {
        const dominantIndex =
            initialScrollIndex + Math.floor(VISIBLE_WEEKS / 2);

        const month = getMonthLabel(baseWeekStart, dominantIndex, locale);

        setVisibleMonth(month);
        currentIndex.current = initialScrollIndex;
    }, [baseWeekStart, initialScrollIndex, locale, WEEK_HEIGHT]);

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

    const commitEdit = useCallback(() => {
        if (!editingDate) return;

        const value = parseFormattedNumberInput(editingValue);

        onEditDay(editingDate, value);
        setEditingDate(null);
        setEditingValue("");
    }, [editingDate, editingValue, onEditDay]);

    function startEditing(day: DayData) {
        if (!isEditable(day.date)) return;

        if (editingDate && editingDate !== day.date) {
            const value = parseFormattedNumberInput(editingValue);
            onEditDay(editingDate, value);
        }

        setEditingDate(day.date);
        setEditingValue(
            day.count
                ? formatNumberInput(String(day.count), locale)
                : ""
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
                                <Text style={[styles.fastArrowGlyph, { color: colors.iconMuted }]}>▲</Text>
                                <Text style={[styles.fastArrowGlyph, { color: colors.iconMuted }]}>▲</Text>
                            </View>
                        </Pressable>

                        <Pressable
                            onPress={() => scrollByMonth(-1)}
                            hitSlop={ARROW_HIT_SLOP}
                            style={styles.monthArrow}
                        >
                            <Text style={[styles.monthArrowText, { color: colors.iconMuted }]}>
                                ▲
                            </Text>
                        </Pressable>

                    </View>

                    <Text style={[styles.monthHeader, { color: colors.textPrimary }]}>
                        {visibleMonth}
                    </Text>

                    <View style={styles.arrowGroup}>

                        <Pressable
                            onPress={() => scrollByMonth(1)}
                            hitSlop={ARROW_HIT_SLOP}
                            style={styles.monthArrow}
                        >
                            <Text style={[styles.monthArrowText, { color: colors.iconMuted }]}>
                                ▼
                            </Text>
                        </Pressable>

                        <Pressable
                            onPress={() => scrollByYear(1)}
                            hitSlop={ARROW_HIT_SLOP}
                            style={styles.monthArrow}
                        >
                            <View style={styles.doubleArrow}>
                                <Text style={[styles.fastArrowGlyph, { color: colors.iconMuted }]}>▼</Text>
                                <Text style={[styles.fastArrowGlyph, { color: colors.iconMuted }]}>▼</Text>
                            </View>
                        </Pressable>

                    </View>

                </View>

                {editingDate ? (
                    <View
                        style={[
                            styles.editorBar,
                            {
                                backgroundColor: colors.surfaceElevated,
                                borderColor: colors.borderSubtle,
                            },
                        ]}
                    >
                        <Text
                            numberOfLines={1}
                            style={[
                                styles.editorDate,
                                { color: colors.textPrimary },
                            ]}
                        >
                            {getDateLabel(editingDate, locale)}
                        </Text>

                        <TextInput
                            ref={inputRef}
                            key={editingDate}
                            value={editingValue}
                            onChangeText={(value) => {
                                setEditingValue(
                                    formatNumberInput(value, locale)
                                );
                            }}
                            keyboardType="numeric"
                            autoFocus
                            selectTextOnFocus
                            returnKeyType="done"
                            blurOnSubmit
                            onBlur={commitEdit}
                            numberOfLines={1}
                            underlineColorAndroid="transparent"
                            accessibilityLabel={t("practice.enterAmount")}
                            style={[
                                styles.editorInput,
                                {
                                    backgroundColor: colors.inputBackground,
                                    borderColor: colors.inputBorder,
                                    color: colors.inputText,
                                },
                            ]}
                            placeholder="0"
                            placeholderTextColor={colors.inputPlaceholder}
                        />

                        <Pressable
                            onPress={() => {
                                if (inputRef.current?.isFocused()) {
                                    inputRef.current.blur();
                                    return;
                                }

                                commitEdit();
                            }}
                            accessibilityRole="button"
                            accessibilityLabel={t("common.save")}
                            hitSlop={8}
                            style={({ pressed }) => [
                                styles.editorSaveButton,
                                { backgroundColor: colors.primary },
                                pressed && styles.pressed,
                            ]}
                        >
                            <MaterialIcons
                                name="check"
                                size={20}
                                color={colors.background}
                            />
                        </Pressable>
                    </View>
                ) : null}

                <View style={styles.weekHeader}>
                    {weekDayLabels.map((d, i) => (
                        <Text
                            key={i}
                            style={[
                                styles.weekHeaderText,
                                { color: colors.textSecondary },
                            ]}
                        >
                            {d}
                        </Text>
                    ))}
                </View>

                <View style={{ height: WEEK_HEIGHT * VISIBLE_WEEKS }}>
                    <FlatList<number>
                        getItemLayout={(_, index) => ({
                            index,
                            length: WEEK_HEIGHT,
                            offset: WEEK_HEIGHT * index,
                        })}
                        initialScrollIndex={initialScrollIndex}
                        initialNumToRender={VISIBLE_WEEKS}
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
                                                    startEditing(day);
                                                }}
                                                style={[
                                                    styles.day,
                                                    { borderColor: colors.borderSubtle },
                                                    editable
                                                        ? {
                                                            backgroundColor:
                                                                editableDayBackground,
                                                        }
                                                        : [
                                                            !isDark &&
                                                            styles.futureDay,
                                                            {
                                                                backgroundColor:
                                                                    futureDayBackground,
                                                            },
                                                        ],
                                                    isFirstColumn && styles.firstColumn,
                                                    isFirstRow && styles.firstRow,
                                                    isToday && [
                                                        styles.today,
                                                        { borderColor: colors.primary },
                                                    ],
                                                    isTargetDate && [
                                                        styles.targetDate,
                                                        {
                                                            borderColor:
                                                                colors.warning,
                                                            backgroundColor:
                                                                colors.surfaceSelected,
                                                        },
                                                    ],
                                                    editingDate === day.date && [
                                                        styles.selectedDay,
                                                        {
                                                            borderColor:
                                                                colors.primary,
                                                            backgroundColor:
                                                                colors.surfaceSelected,
                                                        },
                                                    ],
                                                ]}
                                            >
                                                {editable && (
                                                    <View
                                                        style={[
                                                            styles.editableAccent,
                                                            {
                                                                backgroundColor:
                                                                    colors.primary,
                                                            },
                                                        ]}
                                                    />
                                                )}
                                                <Text
                                                    style={[
                                                        styles.dayNumber,
                                                        {
                                                            color:
                                                                colors.textSecondary,
                                                        },
                                                        !editable && {
                                                            color:
                                                                colors.inputPlaceholder,
                                                        },
                                                    ]}
                                                >
                                                    {day.date.slice(-2)}
                                                </Text>

                                                <Text
                                                    numberOfLines={1}
                                                    adjustsFontSizeToFit
                                                    minimumFontScale={0.6}
                                                    style={[
                                                        styles.dayCount,
                                                        { color: colors.primary },
                                                        day.count === 0 && {
                                                            color:
                                                                colors.inputPlaceholder,
                                                        },
                                                        !editable && {
                                                            color:
                                                                colors.inputPlaceholder,
                                                        },
                                                    ]}
                                                >
                                                    {formatNumber(day.count, locale)}
                                                </Text>
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

    editorBar: {
        minHeight: 48,
        marginHorizontal: 4,
        marginTop: 2,
        marginBottom: 8,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderWidth: 1,
        borderRadius: 8,
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
    },

    editorDate: {
        flex: 1,
        minWidth: 0,
        fontSize: 14,
        fontWeight: "600",
    },

    editorInput: {
        width: 112,
        height: 38,
        borderWidth: 1,
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 0,
        textAlign: "center",
        textAlignVertical: "center",
        fontSize: 16,
        fontWeight: "600",
        includeFontPadding: false,
    },

    editorSaveButton: {
        width: 38,
        height: 38,
        borderRadius: 8,
        alignItems: "center",
        justifyContent: "center",
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
        color: "#1A5FCC"
    },

    monthHeader: {
        fontSize: 18,
        fontWeight: "600",
        marginBottom: 8,
        textAlign: "center",
        width: 150
    },

    today: {
        borderColor: "#1A5FCC",
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

    selectedDay: {
        borderTopWidth: borderWidth,
        borderBottomWidth: borderWidth,
        borderRightWidth: borderWidth,
        borderLeftWidth: borderWidth,
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
        color: "#1A5FCC"
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
        backgroundColor: "#1A5FCC",
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

    pressed: {
        opacity: 0.65,
    },
});
