import Constants from "expo-constants";
import { Stack } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";

export default function AboutScreen() {
    const version = Constants.expoConfig?.version ?? "1.0.0";

    return (
        <>
            <Stack.Screen options={{ title: "About" }} />

            <ScrollView contentContainerStyle={styles.container}>
                <Text style={styles.title}>108 Again</Text>

                <Text style={styles.version}>Version {version}</Text>

                <Text style={styles.section}>
                    108 Again is an offline-first app designed to help practitioners track and preserve their Ngöndro practice progress over time.
                </Text>

                <Text style={styles.section}>
                    Your practice data is stored locally on your device first, allowing the app to work reliably even without an internet connection.
                </Text>

                <Text style={styles.section}>
                    To help protect years of accumulated practice history, the app also supports backup import/export as well as optional cloud syncing, so you can restore your data on a new device or recover it if your previous device is lost or replaced.
                </Text>

                <Text style={styles.section}>
                    This app is not affiliated with any official organization.
                </Text>

                <Text style={styles.value}>
                    If you have any feedback, comments, or would like to report a bug, feel free to contact the developer using the information below:
                </Text>

                <View style={styles.separator} />


                <Text style={styles.label}>Developer</Text>
                <Text style={styles.value}>
                    Gian Piero Bandieramonte
                </Text>

                <Text style={styles.label}>Contact</Text>
                <Text style={styles.value}>
                    gian@bandieramonte.com
                </Text>
            </ScrollView>
        </>
    );
}

const styles = StyleSheet.create({
    container: {
        padding: 20,
        maxWidth: 700,
        alignSelf: "center",
        width: "100%",
    },

    title: {
        fontSize: 28,
        fontWeight: "700",
        marginBottom: 4,
    },

    version: {
        color: "#666",
        marginBottom: 20,
    },

    section: {
        marginBottom: 16,
        lineHeight: 20,
    },

    separator: {
        height: 1,
        backgroundColor: "#eee",
        marginVertical: 20,
    },

    label: {
        fontWeight: "600",
        marginTop: 12,
    },

    value: {
        color: "#444",
        marginTop: 4,
    },
});