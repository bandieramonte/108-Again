import { useI18n } from "@/i18n";
import { useAppTheme } from "@/styles/theme";
import { router } from "expo-router";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";

type Props = {
    firstName?: string | null;
    isAuthenticated?: boolean;
};

export default function HeaderTitle({ firstName, isAuthenticated }: Props) {
    const { colors } = useAppTheme();
    const { t } = useI18n();

    return (
        <Pressable
            onPress={() => {
                if (router.canGoBack()) {
                    router.dismissAll();
                }
                router.navigate("/");
            }}
            style={styles.container}
        >
            <View style={styles.titleRow}>
                <Image
                    source={require("../assets/images/icon.png")}
                    style={styles.logo}
                    resizeMode="cover"
                />
                <Text style={[styles.title, { color: colors.textPrimary }]}>
                    108 Again
                </Text>
            </View>

            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                {isAuthenticated
                    ? firstName
                        ? t("header.greetingWithName", { name: firstName })
                        : t("header.greeting")
                    : " "}
            </Text>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    container: {
        alignItems: "center",
        justifyContent: "center",
        minWidth: 200,
        minHeight: 40,
        paddingVertical: 2
    },

    titleRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 7,
        paddingBottom: 10,
    },

    logo: {
        width: 22,
        height: 22,
        borderRadius: 6,
    },

    title: {
        fontSize: 17,
        fontWeight: "700",
        lineHeight: 20,
        textAlign: "center",
    },

    subtitle: {
        position: "absolute",
        fontSize: 12,
        color: "#666",
        lineHeight: 14,
        bottom: -0,
    },
});
