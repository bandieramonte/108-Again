import React, { useEffect, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useI18n } from "../i18n";
import * as practiceService from "../services/practiceService";
import {
    digitsOnly,
    formatNumberInput,
    MAX_REPETITIONS_PER_DAY,
    parseFormattedNumberInput,
    validateRepetitionCount,
} from "../utils/numberUtils";

type Props = {
    visible: boolean;
    practiceId: string | null;
    practiceName: string;
    defaultValue: number;
    onClose: () => void;
};

export default function QuickAddEditor({
    visible,
    practiceId,
    practiceName,
    defaultValue,
    onClose
}: Props) {

    const { locale, t } = useI18n();
    const [value, setValue] =
        useState(formatNumberInput(String(defaultValue), locale));

    useEffect(() => {
        if (visible) {
            setValue(formatNumberInput(String(defaultValue), locale));
        }
    }, [visible, defaultValue, locale]);

    function save() {

        if (!practiceId) return;

        const error =
            validateRepetitionCount(
                value,
                t("quickAddEditor.defaultSessionCount")
            );

        if (error) {
            alert(error);
            return;
        }

        const num = parseFormattedNumberInput(value);

        practiceService.updatePracticeDefaultSessionCount(
            practiceId,
            num
        );

        onClose();
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
                        {t("quickAddEditor.title")}
                    </Text>

                    <Text style={styles.subtitle}>
                        {practiceName}
                    </Text>

                    <TextInput
                        value={value}
                        onChangeText={(v) => {
                            const clean = digitsOnly(v);
                            if (Number(clean) > MAX_REPETITIONS_PER_DAY) return;
                            setValue(formatNumberInput(clean, locale));
                        }}
                        keyboardType="numeric"
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
        padding: 20
    },

    card: {
        width: "100%",
        maxWidth: 360,
        backgroundColor: "white",
        borderRadius: 12,
        padding: 20,
        alignSelf: "center"
    },

    title: {
        fontSize: 18,
        fontWeight: "bold",
        marginBottom: 8
    },

    subtitle: {
        fontSize: 14,
        color: "#666",
        marginBottom: 16
    },

    input: {
        borderWidth: 1,
        borderColor: "#ccc",
        padding: 10,
        marginBottom: 16,
        borderRadius: 8,
        color: "black"
    },

    buttons: {
        flexDirection: "row",
        justifyContent: "flex-end",
        gap: 12
    }
});
