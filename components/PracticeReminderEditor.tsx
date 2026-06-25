import { useEffect, useState } from "react";
import {
    Modal,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import { useI18n } from "../i18n";
import { colors } from "../styles/theme";

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

function formatTime(hour: number, minute: number) {
    return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function parseTime(value: string) {
    const match = value.trim().match(/^([01]?\d|2[0-3]):([0-5]\d)$/);

    if (!match) return null;

    return {
        hour: Number(match[1]),
        minute: Number(match[2]),
    };
}

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
    const { t } = useI18n();
    const [time, setTime] = useState(formatTime(initialHour, initialMinute));

    useEffect(() => {
        if (!visible) return;

        setTime(formatTime(initialHour, initialMinute));
    }, [visible, initialHour, initialMinute]);

    function save() {
        const parsed = parseTime(time);

        if (!parsed) {
            alert(t("reminderEditor.invalidTime"));
            return;
        }

        onSave(parsed.hour, parsed.minute);
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

                    <TextInput
                        value={time}
                        onChangeText={setTime}
                        keyboardType="numbers-and-punctuation"
                        returnKeyType="done"
                        onSubmitEditing={save}
                        placeholder="20:00"
                        placeholderTextColor="#999"
                        style={styles.input}
                        maxLength={5}
                        autoFocus
                    />

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

    input: {
        borderWidth: 1,
        borderColor: "#ddd",
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 10,
        fontSize: 16,
        color: "#111",
        marginBottom: 18,
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
