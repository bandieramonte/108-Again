import { useRouter } from "expo-router";
import { useState } from "react";
import { Button, StyleSheet, Text, TextInput, View } from "react-native";
import { db } from "../database/db";
import * as practiceService from "../services/practiceService";

export default function AddPractice() {

    const router = useRouter();

    const [name, setName] = useState("");
    const [target, setTarget] = useState("111111");
    const [defaultAdd, setDefaultAdd] = useState("108");

    function savePractice() {

        if (!name.trim()) {
            alert("Please enter a practice name");
            return;
        }

        const orderResult = db.getAllSync(`
        SELECT MAX(orderIndex) as maxOrder FROM practices
        `) as { maxOrder: number }[];

        practiceService.createPractice(
            name,
            Number(target),
            Number(defaultAdd) || 108
        );
        router.back();
    }

    return (

        <View style={styles.container}>

            <Text style={styles.title}>Add Practice</Text>

            <TextInput
                placeholder="Practice name"
                value={name}
                onChangeText={setName}
                style={styles.input}
            />

            <TextInput
                placeholder="Target count"
                value={target}
                onChangeText={setTarget}
                keyboardType="numeric"
                style={styles.input}
            />

            <TextInput
                placeholder="Repetitions per sessions"
                value={defaultAdd}
                onChangeText={setDefaultAdd}
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
        marginBottom: 15
    }

});