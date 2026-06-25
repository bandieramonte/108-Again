import Constants from "expo-constants";
import { Stack } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useI18n } from "../i18n";

export default function AboutScreen() {
    const { t } = useI18n();
    const version = Constants.expoConfig?.version ?? "1.0.0";

    return (
        <>
            <Stack.Screen options={{ title: t("menu.about") }} />

            <ScrollView contentContainerStyle={styles.container}>
                <Text style={styles.title}>108 Again</Text>

                <Text style={styles.version}>
                    {t("about.version", { version })}
                </Text>

                <Text style={styles.section}>
                    {t("about.text1")}
                </Text>

                <Text style={styles.section}>
                    {t("about.text2")}
                </Text>

                <Text style={styles.section}>
                    {t("about.text3")}
                </Text>

                <Text style={styles.section}>
                    {t("about.text4")}
                </Text>

                <Text style={styles.value}>
                    {t("about.feedback")}
                </Text>

                <View style={styles.separator} />

                <Text style={styles.label}>{t("about.developer")}</Text>
                <Text style={styles.value}>
                    Gian Piero Bandieramonte
                </Text>

                <Text style={styles.label}>{t("about.contact")}</Text>
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
