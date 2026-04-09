import React, { useEffect, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import * as practiceService from "../services/practiceService";
import { digitsOnly, validateRepetitionsPerSession } from "../utils/numberUtils";

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

    const [value, setValue] = useState(String(defaultValue));

    useEffect(() => {
        if (visible) {
            setValue(String(defaultValue));
        }
    }, [visible, defaultValue]);

    function save() {

        if (!practiceId) return;

        const error =
            validateRepetitionsPerSession(value);

        if (error) {
            alert(error);
            return;
        }

        const num = Number(value);

        practiceService.updatePracticeDefaultAddCount(
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
                        Edit repetitions per day
                    </Text>

                    <Text style={styles.subtitle}>
                        {practiceName}
                    </Text>

                    <TextInput
                        value={value}
                        onChangeText={(v) => setValue(digitsOnly(v))}
                        keyboardType="numeric"
                        style={styles.input}
                    />

                    <View style={styles.buttons}>
                        <Pressable onPress={onClose}>
                            <Text>Cancel</Text>
                        </Pressable>

                        <Pressable onPress={save}>
                            <Text>Save</Text>
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