import { useI18n } from "@/i18n";
import { useAppTheme } from "@/styles/theme";
import { router } from "expo-router";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";

type Props = {
    firstName?: string | null;
    isAuthenticated?: boolean;
};

const lightTitleImage = require("../assets/images/title-light.png");
const darkTitleImage = require("../assets/images/title-dark.png");

export default function HeaderTitle({ firstName, isAuthenticated }: Props) {
    const { colors, isDark } = useAppTheme();
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
                    accessibilityLabel="108 Again"
                    resizeMode="contain"
                    source={isDark ? darkTitleImage : lightTitleImage}
                    style={styles.titleImage}
                />
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
        paddingBottom: 10,
    },

    titleImage: {
        width: 105,
        height: 20,
    },

    subtitle: {
        position: "absolute",
        fontSize: 12,
        color: "#666",
        lineHeight: 14,
        bottom: -0,
    },
});
