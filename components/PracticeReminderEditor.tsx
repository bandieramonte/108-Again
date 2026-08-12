import * as Localization from "expo-localization";
import { useEffect, useRef, useState } from "react";
import {
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    useWindowDimensions,
    View,
} from "react-native";
import { useI18n } from "../i18n";
import { useAppTheme } from "../styles/theme";
import {
    buildReminderTimeOptions,
    formatReminderTimeForLocale,
    reminderTimeMatches,
    roundToNearestHalfHour,
    type ReminderTimeOption,
} from "../utils/reminderTime";

type Props = {
    visible: boolean;
    enabled: boolean;
    practiceName: string;
    initialHour: number;
    initialMinute: number;
    onClose: () => void;
    onDisable: () => void;
    onSave: (hour: number, minute: number) => void;
};

export default function PracticeReminderEditor({
    visible,
    enabled,
    practiceName,
    initialHour,
    initialMinute,
    onClose,
    onDisable,
    onSave,
}: Props) {
    const { colors } = useAppTheme();
    const { locale, t } = useI18n();
    const { fontScale } = useWindowDimensions();
    const usesLargeText = fontScale > 1;
    const scrollRef = useRef<ScrollView | null>(null);
    const [timeLocale, setTimeLocale] = useState(locale);
    const [uses24HourClock, setUses24HourClock] =
        useState<boolean | null>(null);
    const [timeOptions, setTimeOptions] =
        useState<ReminderTimeOption[]>(() => buildReminderTimeOptions());
    const [currentTime, setCurrentTime] = useState(
        () => roundToNearestHalfHour(new Date())
    );
    const [selectedTime, setSelectedTime] = useState({
        hour: initialHour,
        minute: initialMinute,
    });
    useEffect(() => {
        if (!visible) return;

        const openedAt = new Date();
        const nearestCurrentTime =
            roundToNearestHalfHour(openedAt);
        const nextOptions = buildReminderTimeOptions(openedAt);
        const savedOption = enabled
            ? nextOptions.find(option =>
                reminderTimeMatches(option, initialHour, initialMinute)
            )
            : null;
        const nextSelected = savedOption ?? nearestCurrentTime;

        setTimeOptions(nextOptions);
        setCurrentTime(nearestCurrentTime);
        setSelectedTime(nextSelected);
        setTimeLocale(
            Localization.getLocales()[0]?.languageTag ?? locale
        );
        setUses24HourClock(
            Localization.getCalendars()[0]?.uses24hourClock ?? null
        );

        const currentTimeIndex = nextOptions.findIndex(option =>
            reminderTimeMatches(
                option,
                nearestCurrentTime.hour,
                nearestCurrentTime.minute
            )
        );

        setTimeout(() => {
            if (currentTimeIndex < 0) return;

            scrollRef.current?.scrollTo({
                animated: false,
                y: Math.max(0, currentTimeIndex * 44 - 88),
            });
        }, 0);
    }, [visible, enabled, initialHour, initialMinute, locale]);

    function save() {
        onSave(selectedTime.hour, selectedTime.minute);
    }

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
                    onPress={() => { }}
                >
                    <Text style={[styles.title, { color: colors.textPrimary }]}>
                        {t("reminderEditor.title")}
                    </Text>

                    <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                        {practiceName}
                    </Text>

                    <Text style={[styles.description, { color: colors.textSecondary }]}>
                        {t("reminderEditor.description")}
                    </Text>

                    <Text style={[styles.label, { color: colors.textPrimary }]}>
                        {t("reminderEditor.reminderTime")}
                    </Text>

                    <ScrollView
                        ref={scrollRef}
                        style={[
                            styles.timeList,
                            {
                                backgroundColor: colors.inputBackground,
                                borderColor: colors.inputBorder,
                            },
                        ]}
                        contentContainerStyle={styles.timeListContent}
                    >
                        {timeOptions.map(option => {
                            const selected =
                                reminderTimeMatches(
                                    option,
                                    selectedTime.hour,
                                    selectedTime.minute
                                );
                            const closestToNow =
                                reminderTimeMatches(
                                    option,
                                    currentTime.hour,
                                    currentTime.minute
                                );

                            return (
                                <Pressable
                                    key={option.key}
                                    style={[
                                        styles.timeOption,
                                        closestToNow && {
                                            borderColor: colors.primary,
                                        },
                                        selected && {
                                            backgroundColor: colors.primary,
                                        },
                                    ]}
                                    accessibilityRole="button"
                                    accessibilityState={{ selected }}
                                    onPress={() => setSelectedTime({
                                        hour: option.hour,
                                        minute: option.minute,
                                    })}
                                >
                                    <Text
                                        style={[
                                            styles.timeOptionText,
                                            { color: colors.textPrimary },
                                            selected &&
                                                styles.timeOptionTextSelected,
                                        ]}
                                    >
                                        {formatReminderTimeForLocale(
                                            option.hour,
                                            option.minute,
                                            timeLocale,
                                            uses24HourClock
                                        )}
                                    </Text>
                                </Pressable>
                            );
                        })}
                    </ScrollView>

                    <View
                        style={[
                            styles.actions,
                            usesLargeText && styles.actionsLargeText,
                        ]}
                    >
                        {enabled && (
                            <Pressable
                                style={[
                                    styles.secondaryButton,
                                    usesLargeText &&
                                        styles.turnOffButtonLargeText,
                                ]}
                                onPress={onDisable}
                            >
                                <Text
                                    style={[
                                        styles.secondaryText,
                                        { color: colors.textSecondary },
                                    ]}
                                >
                                    {t("reminderEditor.turnOff")}
                                </Text>
                            </Pressable>
                        )}

                        <View
                            style={[
                                styles.actionSpacer,
                                usesLargeText &&
                                    styles.actionSpacerLargeText,
                            ]}
                        />

                        <View
                            style={[
                                styles.confirmationActions,
                                usesLargeText &&
                                    styles.confirmationActionsLargeText,
                            ]}
                        >
                            <Pressable
                                style={styles.secondaryButton}
                                onPress={onClose}
                            >
                                <Text
                                    style={[
                                        styles.secondaryText,
                                        { color: colors.textSecondary },
                                    ]}
                                >
                                    {t("common.cancel")}
                                </Text>
                            </Pressable>

                            <Pressable
                                style={[
                                    styles.primaryButton,
                                    { backgroundColor: colors.primary },
                                ]}
                                onPress={save}
                            >
                                <Text style={styles.primaryText}>
                                    {t("common.save")}
                                </Text>
                            </Pressable>
                        </View>
                    </View>
                </Pressable>
            </Pressable>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.25)",
        justifyContent: "center",
        alignItems: "center",
        padding: 20,
    },

    card: {
        width: "100%",
        maxWidth: 360,
        backgroundColor: "white",
        borderRadius: 12,
        padding: 20,
    },

    title: {
        fontSize: 18,
        fontWeight: "700",
        color: "#111",
        marginBottom: 6,
    },

    subtitle: {
        fontSize: 14,
        color: "#666",
        marginBottom: 12,
    },

    description: {
        fontSize: 14,
        color: "#333",
        lineHeight: 20,
        marginBottom: 16,
    },

    label: {
        fontSize: 13,
        fontWeight: "600",
        color: "#333",
        marginBottom: 6,
    },

    timeList: {
        borderWidth: 1,
        borderColor: "#ddd",
        borderRadius: 8,
        maxHeight: 224,
        marginBottom: 18,
    },

    timeListContent: {
        padding: 4,
    },

    timeOption: {
        minHeight: 44,
        borderWidth: 1,
        borderColor: "transparent",
        borderRadius: 6,
        justifyContent: "center",
        paddingHorizontal: 12,
    },

    timeOptionSelected: {
    },

    timeOptionText: {
        fontSize: 16,
        fontWeight: "600",
        color: "#111",
    },

    timeOptionTextSelected: {
        color: "white",
    },

    actions: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
    },

    actionsLargeText: {
        flexDirection: "column",
        alignItems: "stretch",
        gap: 6,
    },

    actionSpacer: {
        flex: 1,
    },

    actionSpacerLargeText: {
        display: "none",
    },

    confirmationActions: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
    },

    confirmationActionsLargeText: {
        alignSelf: "stretch",
        flexWrap: "wrap",
        justifyContent: "flex-end",
    },

    turnOffButtonLargeText: {
        alignSelf: "flex-start",
    },

    secondaryButton: {
        paddingVertical: 9,
        paddingHorizontal: 10,
    },

    secondaryText: {
        fontSize: 15,
        fontWeight: "600",
        color: "#666",
    },

    primaryButton: {
        paddingVertical: 9,
        paddingHorizontal: 16,
        borderRadius: 8,
        backgroundColor: "#1A5FCC",
    },

    primaryText: {
        fontSize: 15,
        fontWeight: "700",
        color: "white",
    },
});
