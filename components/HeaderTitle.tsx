import { StyleSheet, Text, View } from "react-native";

type Props = {
    firstName: string | null;
    isAuthenticated: boolean;
};

export default function HeaderTitle({ firstName, isAuthenticated }: Props) {
    return (
        <View style={styles.container}>
            <Text style={styles.title}>Ngöndro Tracker</Text>

            {isAuthenticated && (
                <Text style={styles.subtitle}>
                    {firstName ? `Hi, ${firstName}` : "Hi"}
                </Text>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        alignItems: "center",
        justifyContent: "center",
    },

    title: {
        fontSize: 17,
        fontWeight: "700",
    },

    subtitle: {
        fontSize: 12,
        color: "#666",
        marginTop: 1,
    },
});