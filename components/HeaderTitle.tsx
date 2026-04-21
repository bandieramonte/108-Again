import { router } from "expo-router";
import { Pressable, StyleSheet, Text } from "react-native";

type Props = {
    firstName?: string | null;
    isAuthenticated?: boolean;
};

export default function HeaderTitle({ firstName, isAuthenticated }: Props) {
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
            <Text style={styles.title}>108 Again</Text>

            <Text style={styles.subtitle}>
                {isAuthenticated
                    ? firstName
                        ? `Hi, ${firstName}`
                        : "Hi"
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

    title: {
        fontSize: 17,
        fontWeight: "700",
        lineHeight: 20,
        textAlign: "center",
        paddingBottom: 10
    },

    subtitle: {
        position: "absolute",
        fontSize: 12,
        color: "#666",
        lineHeight: 14,
        bottom: -0,
    },
});