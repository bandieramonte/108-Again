import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput } from "react-native";
import * as practiceService from "../services/practiceService";
import { colors } from "../styles/theme";
import { digitsOnly, MAX_PRACTICE_NAME, MAX_REPETITIONS_PER_DAY, MAX_TARGET_COUNT, validateNonNegativeInteger, validateRepetitionCount, validateTargetCount } from "../utils/numberUtils";

export default function EditPractice() {

    const { id } = useLocalSearchParams();
    const router = useRouter();

    const [name, setName] = useState("");
    const [target, setTarget] = useState("");
    const [total, setTotal] = useState("");
    const [dailyTarget, setDailyTarget] = useState("");
    const [defaultSession, setDefaultSession] = useState("");

    useEffect(() => {
        const data = practiceService.getPracticeEditData(id as string);
        setName(data.name);
        setTarget(String(data.targetCount));
        setTotal(String(data.total));
        setDailyTarget(
            data.dailyTargetCount == null
                ? ""
                : String(data.dailyTargetCount)
        );
        setDefaultSession(String(data.defaultSessionCount ?? 108));
    }, []);

    function save() {

        if (!name.trim()) {
            alert("Please enter a practice name");
            return;
        }

        const targetError =
            validateTargetCount(target);

        if (targetError) {
            alert(targetError);
            return;
        }

        const totalError =
            validateNonNegativeInteger(total, "Total count");

        if (totalError) {
            alert(totalError);
            return;
        }

        const dailyTargetError =
            dailyTarget.trim()
                ? validateRepetitionCount(
                    dailyTarget,
                    "Daily target"
                )
                : null;

        if (dailyTargetError) {
            alert(dailyTargetError);
            return;
        }

        if (dailyTarget.trim() && Number(dailyTarget) <= 0) {
            alert("Daily target must be greater than 0");
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
            practiceService.updatePractice(
                id as string,
                name,
                Number(target),
                Number(total)
            );
            practiceService.updatePracticeDailyTargetCount(
                id as string,
                dailyTarget.trim()
                    ? Number(dailyTarget)
                    : null
            );
            practiceService.updatePracticeDefaultSessionCount(
                id as string,
                Number(defaultSession)
            );
        } catch (error: any) {
            alert(error.message);
            return;
        }

        router.back();
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
                <Text style={styles.title}>Edit Practice</Text>

                <Text>Name</Text>
                <TextInput
                    value={name}
                    onChangeText={(text) => setName(text.slice(0, MAX_PRACTICE_NAME))}
                    maxLength={25}
                    style={styles.input}
                />

                <Text>Target count</Text>
                <TextInput
                    value={target}
                    onChangeText={(v) => {
                        const clean = digitsOnly(v);
                        if (Number(clean) > MAX_TARGET_COUNT) return;
                        setTarget(clean);
                    }}
                    keyboardType="numeric"
                    style={styles.input}
                />

                <Text>Total count so far</Text>
                <TextInput
                    value={total}
                    onChangeText={(v) => {
                        const clean = digitsOnly(v);
                        if (Number(clean) > MAX_TARGET_COUNT) return;
                        setTotal(clean);
                    }}
                    keyboardType="numeric"
                    style={styles.input}
                />

                <Text>Daily target (optional)</Text>
                <TextInput
                    value={dailyTarget}
                    onChangeText={(v) => {
                        const clean = digitsOnly(v);
                        if (Number(clean) > MAX_REPETITIONS_PER_DAY) return;
                        setDailyTarget(clean);
                    }}
                    keyboardType="numeric"
                    placeholder="Disabled"
                    placeholderTextColor="#999"
                    style={styles.input}
                />

                <Text>Default session count</Text>
                <TextInput
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
                    onPress={save}
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
        marginBottom: 20,
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
