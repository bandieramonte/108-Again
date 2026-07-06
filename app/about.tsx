import Constants from "expo-constants";
import { Stack } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useI18n } from "../i18n";
import { useAppTheme, useGlobalStyles } from "../styles/theme";

export default function AboutScreen() {
    const insets = useSafeAreaInsets();
    const globalStyles = useGlobalStyles();
    const { colors } = useAppTheme();
    const { t } = useI18n();
    const version = Constants.expoConfig?.version ?? "1.0.0";
    const bottomPadding = Math.max(24, insets.bottom + 20);

    return (
        <>
            <Stack.Screen options={{ title: t("menu.about") }} />

            <ScrollView
                contentContainerStyle={[
                    globalStyles.sidePadding,
                    styles.container,
                    {
                        backgroundColor: colors.background,
                        paddingBottom: bottomPadding,
                    },
                ]}
            >
                <Text style={[styles.title, { color: colors.textPrimary }]}>
                    108 Again
                </Text>

                <Text style={[styles.version, { color: colors.textSecondary }]}>
                    {t("about.version", { version })}
                </Text>

                <Text style={[styles.section, { color: colors.textPrimary }]}>
                    {t("about.text1")}
                </Text>

                <Text style={[styles.section, { color: colors.textPrimary }]}>
                    {t("about.text2")}
                </Text>

                <Text style={[styles.section, { color: colors.textPrimary }]}>
                    {t("about.text3")}
                </Text>

                <Text style={[styles.section, { color: colors.textPrimary }]}>
                    {t("about.text4")}
                </Text>

                <Text style={[styles.value, { color: colors.textSecondary }]}>
                    {t("about.feedback")}
                </Text>

                <View
                    style={[
                        styles.separator,
                        { backgroundColor: colors.borderSubtle },
                    ]}
                />

                <Text style={[styles.label, { color: colors.textPrimary }]}>
                    {t("about.developer")}
                </Text>
                <Text style={[styles.value, { color: colors.textSecondary }]}>
                    Gian Piero Bandieramonte
                </Text>

                <Text style={[styles.label, { color: colors.textPrimary }]}>
                    {t("about.contact")}
                </Text>
                <Text style={[styles.value, { color: colors.textSecondary }]}>
                    gian@bandieramonte.com
                </Text>
            </ScrollView>
        </>
    );
}

const styles = StyleSheet.create({
    container: {
        paddingVertical: 14,
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
