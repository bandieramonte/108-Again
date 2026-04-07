import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Button, StyleSheet, Text, TextInput, View } from "react-native";
import * as practiceService from "../services/practiceService";
import { digitsOnly, MAX_TARGET_COUNT, validateNonNegativeInteger, validateRepetitionsPerSession, validateTargetCount } from "../utils/numberUtils";

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

        const defaultError =
            validateRepetitionsPerSession(defaultAdd);

        if (defaultError) {
            alert(defaultError);
            return;
        }

        try {
            practiceService.updatePractice(
                id as string,
                name,
                Number(target),
                Number(total)
            );
        } catch (error: any) {
            alert(error.message);
            return;
        }

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

            <Text>Total count</Text>
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

            <Text>Repetitions per day</Text>
            <TextInput
                value={defaultAdd}
                onChangeText={(v) => {
                    const clean = digitsOnly(v);
                    if (Number(clean) > 108000) return;
                    setDefaultAdd(clean);
                }}
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
        marginBottom: 20,
        color: "black"
    }

});