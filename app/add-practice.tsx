import { useRouter } from "expo-router";
import { useState } from "react";
import { Button, StyleSheet, Text, TextInput, View } from "react-native";
import * as practiceService from "../services/practiceService";
import { digitsOnly, MAX_TARGET_COUNT, validateRepetitionsPerSession, validateTargetCount } from "../utils/numberUtils";

export default function AddPractice() {

    const router = useRouter();

    const [name, setName] = useState("");
    const [target, setTarget] = useState("");
    const [defaultAdd, setDefaultAdd] = useState("");

    function savePractice() {

        if (!name.trim()) {
            alert("Please enter a practice name");
            return;
        }

        if (!target.trim()) {
            alert("Please enter a target count");
            return;
        }

        if (!defaultAdd.trim()) {
            alert("Please enter amount of repetitions per day");
            return;
        }

        const targetError =
            validateTargetCount(target);

        if (targetError) {
            alert(targetError);
            return;
        }

        const defaultError =
            validateRepetitionsPerSession(defaultAdd);

        if (defaultError) {
            alert(defaultError);
            return;
        }

        try {
            practiceService.createPractice(
                name,
                Number(target),
                Number(defaultAdd) || 108
            );

            router.back();

        } catch (error: any) {
            alert(error.message);
        }
    }

    return (

        <View style={styles.container}>

            <Text style={styles.title}>Add Practice</Text>

            <TextInput
                placeholder="Practice name"
                placeholderTextColor="#999"
                value={name}
                onChangeText={setName}
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
                placeholder="Repetitions per day"
                placeholderTextColor="#999"
                value={defaultAdd}
                onChangeText={(v) => {
                    const clean = digitsOnly(v);
                    if (Number(clean) > 108000) return;
                    setDefaultAdd(clean);
                }}
                keyboardType="numeric"
                style={styles.input}
            />

            <Button
                title="Save"
                onPress={savePractice}
            />

        </View>

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
    }

});