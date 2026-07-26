import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
    Modal,
    Pressable,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { useI18n } from "../i18n";
import * as practiceService from "../services/practiceService";
import { useAppTheme } from "../styles/theme";
import { formatCalendarDate } from "../utils/calendarMonth";
import ScrollableMonthCalendar, {
    type CalendarDayRenderContext,
} from "./ScrollableMonthCalendar";

type Props = {
    visible: boolean;
    targetCount: number;
    total: number;
    currentTargetDate: Date | null;
    onClose: () => void;
    onSave: (newDailyCount: number, selectedDate: string) => void;
};

function dateFromString(dateString: string) {
    const [year, month, day] = dateString
        .split("-")
        .map(value => Number.parseInt(value, 10));

    return new Date(Date.UTC(year, month - 1, day));
}

function getMaximumTargetMonth(
    today: Date,
    currentTargetDate: Date | null
) {
    const maximum = new Date(today);
    maximum.setUTCFullYear(maximum.getUTCFullYear() + 100);

    if (
        currentTargetDate &&
        currentTargetDate.getTime() > maximum.getTime()
    ) {
        maximum.setTime(currentTargetDate.getTime());
        maximum.setUTCFullYear(maximum.getUTCFullYear() + 1);
    }

    return maximum;
}

export default function TargetDateEditor({
    visible,
    targetCount,
    total,
    currentTargetDate,
    onClose,
    onSave,
}: Props) {
    const { colors } = useAppTheme();
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
    const dateLabelCache = useMemo(
        () => ({
            locale,
            values: new Map<string, string>(),
        }),
        [locale]
    );
    const getLocalizedDateLabel = useCallback((
        dateString: string
    ) => {
        const cached = dateLabelCache.values.get(dateString);
        if (cached) return cached;

        const formatted = dateFormatter.format(
            dateFromString(dateString)
        );
        dateLabelCache.values.set(dateString, formatted);

        return formatted;
    }, [dateFormatter, dateLabelCache]);
    const today = useMemo(() => new Date(), []);
    const todayString = useMemo(
        () => formatCalendarDate(today),
        [today]
    );
    const [selectedDate, setSelectedDate] = useState(
        currentTargetDate
            ? formatCalendarDate(currentTargetDate)
            : todayString
    );
    const maximumMonth = useMemo(
        () => getMaximumTargetMonth(today, currentTargetDate),
        [currentTargetDate, today]
    );

    useEffect(() => {
        if (!visible) return;

        setSelectedDate(
            currentTargetDate
                ? formatCalendarDate(currentTargetDate)
                : todayString
        );
    }, [currentTargetDate, todayString, visible]);

    function save() {
        const required =
            practiceService.calculateRequiredDailyCount(
                targetCount,
                total,
                dateFromString(selectedDate)
            );

        onSave(required, selectedDate);
        onClose();
    }

    const renderDay = useCallback((day: CalendarDayRenderContext) => {
        const disabled = day.dateString < todayString;
        const selected = day.dateString === selectedDate;
        const isToday = day.dateString === todayString;

        return (
            <Pressable
                accessibilityLabel={getLocalizedDateLabel(
                    day.dateString
                )}
                accessibilityRole="button"
                accessibilityState={{ disabled, selected }}
                focusable={!disabled}
                onPress={() => {
                    if (!disabled) setSelectedDate(day.dateString);
                }}
                style={({ pressed }) => [
                    styles.day,
                    {
                        backgroundColor: colors.surfaceElevated,
                    },
                    day.isOutsideMonth && styles.outsideMonth,
                    disabled && styles.disabledDay,
                    pressed && !disabled && styles.pressed,
                ]}
            >
                <View
                    style={[
                        styles.dayNumberCircle,
                        isToday && [
                            styles.today,
                            { borderColor: colors.primary },
                        ],
                        selected && {
                            backgroundColor: colors.primary,
                            borderColor: colors.primary,
                        },
                    ]}
                >
                    <Text
                        style={[
                            styles.dayNumber,
                            { color: colors.textPrimary },
                            (disabled || day.isOutsideMonth) && {
                                color: colors.inputPlaceholder,
                            },
                            isToday && {
                                color: colors.primary,
                                fontWeight: "700",
                            },
                            selected && styles.selectedDayNumber,
                        ]}
                    >
                        {day.day}
                    </Text>
                </View>
            </Pressable>
        );
    }, [
        colors,
        getLocalizedDateLabel,
        selectedDate,
        todayString,
    ]);

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
        >
            <Pressable
                style={[
                    styles.overlay,
                    { backgroundColor: colors.overlay },
                ]}
                onPress={onClose}
            >
                <Pressable
                    style={[
                        styles.card,
                        { backgroundColor: colors.surfaceElevated },
                    ]}
                    onPress={() => {}}
                >
                    <Text
                        style={[
                            styles.title,
                            { color: colors.textPrimary },
                        ]}
                    >
                        {t("targetDateEditor.title")}
                    </Text>

                    <ScrollableMonthCalendar
                        initialMonth={dateFromString(selectedDate)}
                        maximumMonth={maximumMonth}
                        minimumMonth={today}
                        onRenderDay={renderDay}
                    />

                    <View style={styles.buttons}>
                        <Pressable
                            onPress={onClose}
                            style={styles.actionButton}
                        >
                            <Text
                                style={{
                                    color: colors.textSecondary,
                                }}
                            >
                                {t("common.cancel")}
                            </Text>
                        </Pressable>

                        <Pressable
                            onPress={save}
                            style={styles.actionButton}
                        >
                            <Text style={{ color: colors.primary }}>
                                {t("common.save")}
                            </Text>
                        </Pressable>
                    </View>
                </Pressable>
            </Pressable>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        padding: 16,
    },

    card: {
        width: "100%",
        maxWidth: 420,
        maxHeight: "94%",
        padding: 16,
        borderRadius: 12,
        alignSelf: "center",
    },

    title: {
        marginBottom: 4,
        fontSize: 18,
        fontWeight: "600",
    },

    day: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
    },

    outsideMonth: {
        opacity: 0.38,
    },

    disabledDay: {
        opacity: 0.5,
    },

    dayNumberCircle: {
        width: 34,
        height: 34,
        borderWidth: 1,
        borderColor: "transparent",
        borderRadius: 17,
        alignItems: "center",
        justifyContent: "center",
    },

    dayNumber: {
        fontSize: 15,
        fontWeight: "500",
        includeFontPadding: false,
    },

    today: {
        borderWidth: 2,
    },

    selectedDayNumber: {
        color: "#fff",
        fontWeight: "700",
    },

    buttons: {
        marginTop: 12,
        flexDirection: "row",
        justifyContent: "flex-end",
        gap: 4,
    },

    actionButton: {
        minHeight: 40,
        minWidth: 64,
        paddingHorizontal: 12,
        alignItems: "center",
        justifyContent: "center",
    },

    pressed: {
        opacity: 0.65,
    },
});
