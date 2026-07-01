import React, { useEffect, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useI18n } from "../i18n";
import {
    digitsOnly,
    formatNumberInput,
    MAX_TARGET_COUNT,
    parseFormattedNumberInput,
    validateNonNegativeInteger,
    validateTargetCount,
} from "../utils/numberUtils";

type Props = {
    visible: boolean;
    practiceName: string;
    total: number;
    targetCount: number;
    onClose: () => void;
    onSave: (nextTotal: number, nextTargetCount: number) => void;
};

export default function PracticeProgressEditor({
    visible,
    practiceName,
    total,
    targetCount,
    onClose,
    onSave,
}: Props) {
    const { locale, t } = useI18n();
    const [totalValue, setTotalValue] =
        useState(formatNumberInput(String(total), locale));
    const [targetValue, setTargetValue] =
        useState(formatNumberInput(String(targetCount), locale));

    useEffect(() => {
        if (!visible) return;

        setTotalValue(formatNumberInput(String(total), locale));
        setTargetValue(formatNumberInput(String(targetCount), locale));
    }, [visible, total, targetCount, locale]);

    function save() {
        const totalError =
            validateNonNegativeInteger(
                totalValue,
                t("form.totalCountSoFar")
            );

        if (totalError) {
            alert(totalError);
            return;
        }

        const targetError =
            validateTargetCount(targetValue);

        if (targetError) {
            alert(targetError);
            return;
        }

        onSave(
            parseFormattedNumberInput(totalValue),
            parseFormattedNumberInput(targetValue)
        );
        onClose();
    }

    function updateNumber(
        nextValue: string,
        setter: (value: string) => void
    ) {
        const clean = digitsOnly(nextValue);
        if (Number(clean) > MAX_TARGET_COUNT) return;
        setter(formatNumberInput(clean, locale));
    }

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <View style={styles.card}>
                    <Text style={styles.title}>
                        {t("practice.totalProgress")}
                    </Text>

                    <Text style={styles.subtitle}>
                        {practiceName}
                    </Text>

                    <Text style={styles.label}>
                        {t("form.totalCountSoFar")}
                    </Text>
                    <TextInput
                        value={totalValue}
                        onChangeText={(value) => {
                            updateNumber(value, setTotalValue);
                        }}
                        keyboardType="numeric"
                        returnKeyType="next"
                        style={styles.input}
                    />

                    <Text style={styles.label}>
                        {t("form.targetCount")}
                    </Text>
                    <TextInput
                        value={targetValue}
                        onChangeText={(value) => {
                            updateNumber(value, setTargetValue);
                        }}
                        keyboardType="numeric"
                        returnKeyType="done"
                        onSubmitEditing={save}
                        style={styles.input}
                    />

                    <View style={styles.buttons}>
                        <Pressable onPress={onClose}>
                            <Text>{t("common.cancel")}</Text>
                        </Pressable>

                        <Pressable onPress={save}>
                            <Text>{t("common.save")}</Text>
                        </Pressable>
                    </View>
                </View>
            </View>
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
        alignSelf: "center",
    },

    title: {
        fontSize: 18,
        fontWeight: "bold",
        marginBottom: 8,
    },

    subtitle: {
        fontSize: 14,
        color: "#666",
        marginBottom: 16,
    },

    label: {
        fontSize: 13,
        fontWeight: "600",
        marginBottom: 6,
    },

    input: {
        borderWidth: 1,
        borderColor: "#ccc",
        padding: 10,
        marginBottom: 16,
        borderRadius: 8,
        color: "black",
    },

    buttons: {
        flexDirection: "row",
        justifyContent: "flex-end",
        gap: 12,
    },
});
