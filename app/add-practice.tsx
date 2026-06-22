import { useRouter } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput } from "react-native";
import * as practiceService from "../services/practiceService";
import { colors } from "../styles/theme";
import { digitsOnly, MAX_PRACTICE_NAME, MAX_REPETITIONS_PER_DAY, MAX_TARGET_COUNT, validateRepetitionCount, validateTargetCount } from "../utils/numberUtils";

export default function AddPractice() {

    const router = useRouter();

    const [name, setName] = useState("");
    const [target, setTarget] = useState("");
    const [defaultSession, setDefaultSession] = useState("108");

    function savePractice() {

        if (!name.trim()) {
            alert("Please enter a practice name");
            return;
        }

        if (!target.trim()) {
            alert("Please enter a target count");
            return;
        }

        const targetError =
            validateTargetCount(target);

        if (targetError) {
            alert(targetError);
            return;
        }

        const defaultSessionError =
            validateRepetitionCount(
                defaultSession,
                "Default session count"
            );

        if (defaultSessionError) {
            alert(defaultSessionError);
            return;
        }

        try {
            practiceService.createPractice(
                name,
                Number(target),
                null,
                Number(defaultSession)
            );

            router.back();

        } catch (error: any) {
            alert(error.message);
        }
    }

    return (

        <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
            <ScrollView
                contentContainerStyle={styles.container}
                keyboardShouldPersistTaps="handled"
            >

                <Text style={styles.title}>Add Practice</Text>

                <TextInput
                    placeholder="Practice name"
                    placeholderTextColor="#999"
                    value={name}
                    onChangeText={(text) => setName(text.slice(0, MAX_PRACTICE_NAME))}
                    maxLength={25}
                    style={styles.input}
                />

                <TextInput
                    placeholder="Target count"
                    placeholderTextColor="#999"
                    value={target}
                    onChangeText={(v) => {
                        const clean = digitsOnly(v);
                        if (Number(clean) > MAX_TARGET_COUNT) return;
                        setTarget(clean);
                    }}
                    keyboardType="numeric"
                    style={styles.input}
                />

                <TextInput
                    placeholder="Default session count"
                    placeholderTextColor="#999"
                    value={defaultSession}
                    onChangeText={(v) => {
                        const clean = digitsOnly(v);
                        if (Number(clean) > MAX_REPETITIONS_PER_DAY) return;
                        setDefaultSession(clean);
                    }}
                    keyboardType="numeric"
                    style={styles.input}
                />

                <Pressable
                    style={styles.saveButton}
                    onPress={savePractice}
                >
                    <Text style={styles.saveButtonText}>
                        Save
                    </Text>
                </Pressable>

            </ScrollView>
        </KeyboardAvoidingView>

    );
}

const styles = StyleSheet.create({

    container: {
        flex: 1,
        padding: 20,
        marginTop: 60
    },

    title: {
        fontSize: 24,
        marginBottom: 20
    },

    input: {
        borderWidth: 1,
        borderColor: "#ccc",
        padding: 10,
        marginBottom: 15,
        color: "black"
    },

    saveButton: {
        backgroundColor: colors.primary,
        paddingVertical: 12,
        borderRadius: 10,
        alignItems: "center",
        marginTop: 10
    },

    saveButtonText: {
        color: "white",
        fontSize: 16,
        fontWeight: "600"
    }

});
