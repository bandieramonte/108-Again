import { useEffect, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useI18n } from "../i18n";
import { useAppTheme } from "../styles/theme";
import {
    digitsOnly,
    formatNumberInput,
    MAX_REPETITIONS_PER_DAY,
    parseFormattedNumberInput,
    validateRepetitionCount,
} from "../utils/numberUtils";

type Props = {
    visible: boolean;
    practiceName?: string;
    initialValue?: number | string | null;
    onClose: () => void;
    onSave: (dailyTargetCount: number) => void;
};

export default function DailyTargetEditor({
    visible,
    practiceName,
    initialValue,
    onClose,
    onSave,
}: Props) {
    const { colors } = useAppTheme();
    const { locale, t } = useI18n();
    const [input, setInput] = useState("");

    useEffect(() => {
        if (!visible) return;

        setInput(
            initialValue == null || initialValue === ""
                ? ""
                : formatNumberInput(String(initialValue), locale)
        );
    }, [visible, initialValue, locale]);

    function save() {
        const error =
            validateRepetitionCount(
                input,
                t("dashboard.dailyTarget")
            );

        if (error) {
            alert(error);
            return;
        }

        const value = parseFormattedNumberInput(input);

        if (value <= 0) {
            alert(t("dashboard.dailyTargetPositive"));
            return;
        }

        try {
            onSave(value);
            onClose();
        } catch (error: any) {
            alert(error?.message ?? t("common.unknownError"));
        }
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
                        {t("dashboard.setDailyTarget")}
                    </Text>

                    {practiceName ? (
                        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                            {practiceName}
                        </Text>
                    ) : null}

                    <TextInput
                        value={input}
                        onChangeText={(value) => {
                            const clean = digitsOnly(value);
                            if (Number(clean) > MAX_REPETITIONS_PER_DAY) return;
                            setInput(formatNumberInput(clean, locale));
                        }}
                        keyboardType="numeric"
                        returnKeyType="done"
                        onSubmitEditing={save}
                        placeholder={t("dashboard.dailyTarget")}
                        placeholderTextColor={colors.inputPlaceholder}
                        style={[
                            styles.input,
                            {
                                backgroundColor: colors.inputBackground,
                                borderColor: colors.inputBorder,
                                color: colors.inputText,
                            },
                        ]}
                        autoFocus
                    />

                    <View style={styles.actions}>
                        <Pressable
                            style={styles.cancelButton}
                            onPress={onClose}
                        >
                            <Text
                                style={[
                                    styles.cancelText,
                                    { color: colors.textSecondary },
                                ]}
                            >
                                {t("common.cancel")}
                            </Text>
                        </Pressable>

                        <Pressable
                            style={[
                                styles.saveButton,
                                { backgroundColor: colors.primary },
                            ]}
                            onPress={save}
                        >
                            <Text style={styles.saveText}>
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
        marginBottom: 8,
    },

    subtitle: {
        fontSize: 14,
        color: "#666",
        marginBottom: 16,
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
        justifyContent: "flex-end",
        alignItems: "center",
        gap: 12,
    },

    cancelButton: {
        paddingHorizontal: 12,
        paddingVertical: 8,
    },

    cancelText: {
        fontSize: 15,
        fontWeight: "600",
        color: "#666",
    },

    saveButton: {
        paddingHorizontal: 16,
        paddingVertical: 9,
        borderRadius: 8,
    },

    saveText: {
        fontSize: 15,
        fontWeight: "700",
        color: "white",
    },
});
