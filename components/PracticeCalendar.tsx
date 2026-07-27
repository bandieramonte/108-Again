import { MaterialIcons } from "@expo/vector-icons";
import React, {
    useCallback,
    useMemo,
    useRef,
    useState,
} from "react";
import {
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import { useI18n } from "../i18n";
import { useAppTheme } from "../styles/theme";
import {
    formatCalendarDate,
    getCalendarMonthIndex,
    isPracticeCalendarDateEditable,
    type CalendarMonthDay,
} from "../utils/calendarMonth";
import {
    formatNumberInput,
    parseFormattedNumberInput,
} from "../utils/numberUtils";
import ScrollableMonthCalendar, {
    type CalendarDayRenderContext,
    type ScrollableMonthCalendarHandle,
} from "./ScrollableMonthCalendar";

type DayData = {
    date: string;
    count: number;
};

type Props = {
    data: DayData[];
    startDate: Date;
    endDate: Date;
    targetDate?: Date | null;
    onEditDay: (date: string, value: number) => void;
};

function getDateFromString(dateString: string) {
    const [year, month, day] = dateString
        .split("-")
        .map(value => Number.parseInt(value, 10));

    return new Date(Date.UTC(year, month - 1, day));
}

function laterDate(first: Date, second: Date) {
    return first.getTime() >= second.getTime() ? first : second;
}

export default function PracticeCalendar({
    data,
    startDate,
    endDate,
    targetDate = null,
    onEditDay,
}: Props) {
    const { colors, isDark } = useAppTheme();
    const { locale, t } = useI18n();
    const dateFormatter = useMemo(
        () => new Intl.DateTimeFormat(locale, {
            day: "numeric",
            month: "long",
            timeZone: "UTC",
            year: "numeric",
        }),
        [locale]
    );
    const numberFormatter = useMemo(
        () => new Intl.NumberFormat(locale),
        [locale]
    );
    const dateLabelCache = useMemo(
        () => ({
            locale,
            values: new Map<string, string>(),
        }),
        [locale]
    );
    const numberLabelCache = useMemo(
        () => ({
            locale,
            values: new Map<number, string>(),
        }),
        [locale]
    );
    const getLocalizedDateLabel = useCallback((
        dateString: string
    ) => {
        const cached = dateLabelCache.values.get(dateString);
        if (cached) return cached;

        const formatted = dateFormatter.format(
            getDateFromString(dateString)
        );
        dateLabelCache.values.set(dateString, formatted);

        return formatted;
    }, [dateFormatter, dateLabelCache]);
    const getLocalizedNumber = useCallback((value: number) => {
        const cached = numberLabelCache.values.get(value);
        if (cached) return cached;

        const formatted = numberFormatter.format(value);
        numberLabelCache.values.set(value, formatted);

        return formatted;
    }, [numberFormatter, numberLabelCache]);
    const dataMap = useMemo(
        () => new Map(data.map(day => [day.date, day.count])),
        [data]
    );
    const today = useMemo(() => new Date(), []);
    const todayMonthIndex = useMemo(
        () => getCalendarMonthIndex(today),
        [today]
    );
    const todayString = useMemo(
        () => formatCalendarDate(today),
        [today]
    );
    const startDateString = useMemo(
        () => formatCalendarDate(startDate),
        [startDate]
    );
    const targetDateString = useMemo(
        () => targetDate ? formatCalendarDate(targetDate) : null,
        [targetDate]
    );
    const targetMonthIndex = useMemo(
        () => targetDate
            ? getCalendarMonthIndex(targetDate)
            : null,
        [targetDate]
    );
    const maximumMonth = useMemo(
        () => laterDate(endDate, today),
        [endDate, today]
    );
    const [editingDate, setEditingDate] =
        useState<string | null>(null);
    const [editingValue, setEditingValue] = useState("");
    const [focusedMonthIndex, setFocusedMonthIndex] =
        useState(todayMonthIndex);
    const calendarRef =
        useRef<ScrollableMonthCalendarHandle>(null);
    const inputRef = useRef<TextInput>(null);
    const commitInProgressRef = useRef(false);

    const commitEdit = useCallback(() => {
        if (!editingDate || commitInProgressRef.current) return;

        const committedDate = editingDate;
        const committedValue =
            parseFormattedNumberInput(editingValue);

        commitInProgressRef.current = true;
        setEditingDate(null);
        setEditingValue("");

        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                try {
                    onEditDay(committedDate, committedValue);
                } finally {
                    commitInProgressRef.current = false;
                }
            });
        });
    }, [editingDate, editingValue, onEditDay]);

    const startEditing = useCallback((day: CalendarMonthDay) => {
        if (!isPracticeCalendarDateEditable(
            day.dateString,
            startDateString,
            todayString
        )) {
            return;
        }

        if (editingDate && editingDate !== day.dateString) {
            onEditDay(
                editingDate,
                parseFormattedNumberInput(editingValue)
            );
        }

        const count = dataMap.get(day.dateString) ?? 0;

        setEditingDate(day.dateString);
        setEditingValue(
            count
                ? formatNumberInput(String(count), locale)
                : ""
        );
    }, [
        dataMap,
        editingDate,
        editingValue,
        locale,
        onEditDay,
        startDateString,
        todayString,
    ]);

    const renderDay = useCallback((day: CalendarDayRenderContext) => {
        const count = dataMap.get(day.dateString) ?? 0;
        const editable = isPracticeCalendarDateEditable(
            day.dateString,
            startDateString,
            todayString
        );
        const isToday = day.dateString === todayString;
        const isTargetDate =
            targetDateString != null &&
            day.dateString === targetDateString;
        const selected = editingDate === day.dateString;
        const defaultBackground = day.isOutsideMonth
            ? isDark
                ? colors.inputReadOnlyBackground
                : colors.surface
            : isDark
                ? colors.background
                : colors.inputBackground;

        return (
            <Pressable
                accessibilityLabel={`${getLocalizedDateLabel(
                    day.dateString
                )}: ${getLocalizedNumber(count)}`}
                accessibilityRole="button"
                accessibilityState={{ disabled: !editable }}
                focusable={editable}
                onPress={() => {
                    if (editable) startEditing(day);
                }}
                style={({ pressed }) => [
                    styles.day,
                    { backgroundColor: defaultBackground },
                    day.isOutsideMonth && styles.outsideMonth,
                    isToday && [
                        styles.today,
                        {
                            backgroundColor: colors.surfaceSelected,
                            borderColor: colors.primary,
                        },
                    ],
                    isTargetDate && [
                        styles.targetDate,
                        {
                            backgroundColor: colors.surfaceSelected,
                            borderColor: colors.warning,
                        },
                    ],
                    selected && [
                        styles.selectedDay,
                        {
                            backgroundColor: colors.surfaceSelected,
                            borderColor: colors.primary,
                        },
                    ],
                    pressed && editable && styles.pressed,
                ]}
            >
                <View
                    style={[
                        styles.dayNumberBadge,
                        isToday && {
                            backgroundColor: colors.primary,
                        },
                    ]}
                >
                    <Text
                        style={[
                            styles.dayNumber,
                            { color: colors.textSecondary },
                            day.isOutsideMonth && {
                                color: colors.inputPlaceholder,
                            },
                            !editable && {
                                color: colors.inputPlaceholder,
                            },
                            isToday && styles.todayNumber,
                        ]}
                    >
                        {String(day.day).padStart(2, "0")}
                    </Text>
                </View>

                <Text
                    adjustsFontSizeToFit
                    minimumFontScale={0.6}
                    numberOfLines={1}
                    style={[
                        styles.dayCount,
                        { color: colors.primary },
                        count === 0 && {
                            color: colors.inputPlaceholder,
                        },
                        (!editable || day.isOutsideMonth) && {
                            color: colors.inputPlaceholder,
                        },
                    ]}
                >
                    {getLocalizedNumber(count)}
                </Text>

                {editable ? (
                    <View
                        style={[
                            styles.editableAccent,
                            { backgroundColor: colors.primary },
                        ]}
                    />
                ) : null}
            </Pressable>
        );
    }, [
        colors,
        dataMap,
        editingDate,
        isDark,
        getLocalizedDateLabel,
        getLocalizedNumber,
        startEditing,
        startDateString,
        targetDateString,
        todayString,
    ]);
    const handleFocusedMonthChange = useCallback((month: Date) => {
        const monthIndex = getCalendarMonthIndex(month);

        setFocusedMonthIndex(current =>
            current === monthIndex ? current : monthIndex
        );
    }, []);

    const editor = editingDate ? (
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
                {getLocalizedDateLabel(editingDate)}
            </Text>

            <TextInput
                ref={inputRef}
                key={editingDate}
                value={editingValue}
                onChangeText={value => {
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
                    commitEdit();
                    inputRef.current?.blur();
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
                    color="#fff"
                />
            </Pressable>
        </View>
    ) : null;

    return (
        <View style={styles.container}>
            <ScrollableMonthCalendar
                ref={calendarRef}
                headerAccessory={editor}
                initialMonth={today}
                maximumMonth={maximumMonth}
                minimumMonth={startDate}
                onFocusedMonthChange={handleFocusedMonthChange}
                onRenderDay={renderDay}
            />

            {targetDate && targetMonthIndex != null ? (
                <View style={styles.jumpControls}>
                    <CalendarJumpButton
                        disabled={
                            focusedMonthIndex === todayMonthIndex
                        }
                        icon="today"
                        label={t("common.today")}
                        onPress={() =>
                            calendarRef.current?.focusMonth(today)
                        }
                    />

                    <CalendarJumpButton
                        accentColor={colors.warning}
                        disabled={
                            focusedMonthIndex === targetMonthIndex
                        }
                        icon="flag"
                        label={t("practice.targetDate")}
                        onPress={() =>
                            calendarRef.current?.focusMonth(
                                targetDate
                            )
                        }
                    />
                </View>
            ) : null}
        </View>
    );
}

type CalendarJumpButtonProps = {
    accentColor?: string;
    disabled: boolean;
    icon: React.ComponentProps<typeof MaterialIcons>["name"];
    label: string;
    onPress: () => void;
};

function CalendarJumpButton({
    accentColor,
    disabled,
    icon,
    label,
    onPress,
}: CalendarJumpButtonProps) {
    const { colors } = useAppTheme();
    const buttonColor = accentColor ?? colors.primary;

    return (
        <Pressable
            accessibilityLabel={label}
            accessibilityRole="button"
            accessibilityState={{ disabled }}
            disabled={disabled}
            onPress={onPress}
            style={({ pressed }) => [
                styles.jumpButton,
                {
                    backgroundColor: colors.surfaceElevated,
                    borderColor:
                        accentColor ?? colors.borderSubtle,
                },
                disabled && styles.jumpButtonDisabled,
                pressed && styles.pressed,
            ]}
        >
            <MaterialIcons
                name={icon}
                size={17}
                color={buttonColor}
            />
            <Text
                numberOfLines={1}
                style={[
                    styles.jumpButtonText,
                    { color: buttonColor },
                ]}
            >
                {label}
            </Text>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    container: {
        marginTop: 8,
    },

    jumpControls: {
        marginTop: 8,
        paddingHorizontal: 8,
        flexDirection: "row",
        justifyContent: "center",
        gap: 8,
    },

    jumpButton: {
        minWidth: 0,
        maxWidth: 180,
        minHeight: 36,
        paddingHorizontal: 12,
        borderWidth: 1,
        borderRadius: 8,
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
    },

    jumpButtonDisabled: {
        opacity: 0.45,
    },

    jumpButtonText: {
        minWidth: 0,
        fontSize: 13,
        fontWeight: "600",
    },

    editorBar: {
        minHeight: 48,
        marginHorizontal: 4,
        marginBottom: 4,
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
        paddingTop: 17,
        alignItems: "center",
        justifyContent: "center",
    },

    outsideMonth: {
        opacity: 0.42,
    },

    dayNumberBadge: {
        minWidth: 20,
        height: 18,
        paddingHorizontal: 3,
        position: "absolute",
        top: 2,
        left: 3,
        borderRadius: 9,
        alignItems: "center",
        justifyContent: "center",
    },

    dayNumber: {
        fontSize: 10,
        fontWeight: "700",
        includeFontPadding: false,
    },

    todayNumber: {
        color: "#fff",
    },

    dayCount: {
        width: "100%",
        fontSize: 16,
        textAlign: "center",
        includeFontPadding: false,
    },

    editableAccent: {
        position: "absolute",
        bottom: 3,
        width: 18,
        height: 2,
        borderRadius: 2,
        opacity: 0.35,
    },

    today: {
        borderWidth: 2,
    },

    targetDate: {
        borderWidth: 2,
    },

    selectedDay: {
        borderWidth: 2,
    },

    pressed: {
        opacity: 0.65,
    },
});
