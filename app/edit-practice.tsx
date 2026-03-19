import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Button, StyleSheet, Text, TextInput, View } from "react-native";
import * as practiceService from "../services/practiceService";

export default function EditPractice() {

    const { id } = useLocalSearchParams();
    const router = useRouter();

    const [name, setName] = useState("");
    const [target, setTarget] = useState("");
    const [total, setTotal] = useState("");
    const [defaultAdd, setDefaultAdd] = useState("");

    useEffect(() => {
        const data = practiceService.getPracticeEditData(id as string);
        setName(data.name);
        setTarget(String(data.targetCount));
        setTotal(String(data.total));
        setDefaultAdd(String(data.defaultAddCount ?? 108));
    }, []);

    function save() {

        if (!name.trim()) {
            alert("Practice name required");
            return;
        }

        practiceService.updatePractice(
            id as string,
            name,
            Number(target),
            Number(total)
        );

        practiceService.updatePracticeDefaultAddCount(
            id as string,
            Number(defaultAdd) || 108
        );

        router.back();
    }

    return (

        <View style={styles.container}>

            <Text style={styles.title}>Edit Practice</Text>

            <Text>Name</Text>
            <TextInput
                value={name}
                onChangeText={setName}
                style={styles.input}
            />

            <Text>Target</Text>
            <TextInput
                value={target}
                onChangeText={setTarget}
                keyboardType="numeric"
                style={styles.input}
            />

            <Text>Total Count</Text>
            <TextInput
                value={total}
                onChangeText={setTotal}
                keyboardType="numeric"
                style={styles.input}
            />

            <Text>Repetitions per session</Text>
            <TextInput
                value={defaultAdd}
                onChangeText={setDefaultAdd}
                keyboardType="numeric"
                style={styles.input}
            />

            <Button title="Save" onPress={save} />

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
        marginBottom: 20
    }

});