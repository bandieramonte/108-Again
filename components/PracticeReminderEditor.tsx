import * as Localization from "expo-localization";
import { useEffect, useRef, useState } from "react";
import {
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { useI18n } from "../i18n";
import { colors } from "../styles/theme";
import {
    buildReminderTimeOptions,
    formatReminderTimeForLocale,
    reminderTimeMatches,
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
    const { locale, t } = useI18n();
    const timeLocale =
        Localization.getLocales()[0]?.languageTag ?? locale;
    const scrollRef = useRef<ScrollView | null>(null);
    const [timeOptions, setTimeOptions] =
        useState<ReminderTimeOption[]>(() => buildReminderTimeOptions());
    const [selectedTime, setSelectedTime] = useState({
        hour: initialHour,
        minute: initialMinute,
    });
    useEffect(() => {
        if (!visible) return;

        const nextOptions = buildReminderTimeOptions();
        const savedOption = enabled
            ? nextOptions.find(option =>
                reminderTimeMatches(option, initialHour, initialMinute)
            )
            : null;
        const nextSelected = savedOption ?? {
            hour: nextOptions[0].hour,
            minute: nextOptions[0].minute,
        };

        setTimeOptions(nextOptions);
        setSelectedTime(nextSelected);

        const nextSelectedIndex = nextOptions.findIndex(option =>
            reminderTimeMatches(
                option,
                nextSelected.hour,
                nextSelected.minute
            )
        );

        setTimeout(() => {
            if (nextSelectedIndex < 0) return;

            scrollRef.current?.scrollTo({
                animated: false,
                y: Math.max(0, nextSelectedIndex * 44 - 44),
            });
        }, 0);
    }, [visible, enabled, initialHour, initialMinute]);

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
                style={styles.overlay}
                onPress={onClose}
            >
                <Pressable
                    style={styles.card}
                    onPress={() => { }}
                >
                    <Text style={styles.title}>
                        {t("reminderEditor.title")}
                    </Text>

                    <Text style={styles.subtitle}>
                        {practiceName}
                    </Text>

                    <Text style={styles.description}>
                        {t("reminderEditor.description")}
                    </Text>

                    <Text style={styles.label}>
                        {t("reminderEditor.reminderTime")}
                    </Text>

                    <ScrollView
                        ref={scrollRef}
                        style={styles.timeList}
                        contentContainerStyle={styles.timeListContent}
                    >
                        {timeOptions.map(option => {
                            const selected =
                                reminderTimeMatches(
                                    option,
                                    selectedTime.hour,
                                    selectedTime.minute
                                );

                            return (
                                <Pressable
                                    key={option.key}
                                    style={[
                                        styles.timeOption,
                                        selected && styles.timeOptionSelected,
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
                                            selected &&
                                                styles.timeOptionTextSelected,
                                        ]}
                                    >
                                        {formatReminderTimeForLocale(
                                            option.hour,
                                            option.minute,
                                            timeLocale
                                        )}
                                    </Text>
                                </Pressable>
                            );
                        })}
                    </ScrollView>

                    <View style={styles.actions}>
                        {enabled && (
                            <Pressable
                                style={styles.secondaryButton}
                                onPress={onDisable}
                            >
                                <Text style={styles.secondaryText}>
                                    {t("reminderEditor.turnOff")}
                                </Text>
                            </Pressable>
                        )}

                        <View style={styles.actionSpacer} />

                        <Pressable
                            style={styles.secondaryButton}
                            onPress={onClose}
                        >
                            <Text style={styles.secondaryText}>
                                {t("common.cancel")}
                            </Text>
                        </Pressable>

                        <Pressable
                            style={styles.primaryButton}
                            onPress={save}
                        >
                            <Text style={styles.primaryText}>
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
        borderRadius: 6,
        justifyContent: "center",
        paddingHorizontal: 12,
    },

    timeOptionSelected: {
        backgroundColor: colors.primary,
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

    actionSpacer: {
        flex: 1,
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
        backgroundColor: colors.primary,
    },

    primaryText: {
        fontSize: 15,
        fontWeight: "700",
        color: "white",
    },
});
