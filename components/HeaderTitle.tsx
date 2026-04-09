import { StyleSheet, Text, View } from "react-native";

type Props = {
    firstName?: string | null;
    isAuthenticated?: boolean;
};

export default function HeaderTitle({ firstName, isAuthenticated }: Props) {
    return (
        <View style={styles.container}>
            <Text style={styles.title}>Ngöndro Tracker</Text>

            <Text style={styles.subtitle}>
                {isAuthenticated
                    ? firstName
                        ? `Hi, ${firstName}`
                        : "Hi"
                    : " "}
            </Text>
        </View>
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
        textAlign: "center"
    },

    subtitle: {
        fontSize: 12,
        color: "#666",
        lineHeight: 14,
    },
});