import { colors } from "@/styles/theme";
import { Modal, Pressable, StyleSheet, Text } from "react-native";

type Props = {
    visible: boolean;
    onClose: () => void;
};

export default function WelcomeModal({
    visible,
    onClose,
}: Props) {
    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
        >
            <Pressable
                style={styles.overlay}
                onPress={onClose}
            >
                <Pressable
                    style={styles.modal}
                    onPress={() => { }}
                >
                    <Text style={styles.title}>
                        Welcome to 108 Again
                    </Text>

                    <Text style={styles.text}>
                        This app helps you track your Ngöndro practice over time.
                    </Text>

                    <Text style={styles.text}>
                        It is built offline first, so your daily practice remains available even without internet access.
                    </Text>

                    <Text style={styles.text}>
                        To safely preserve your progress throughout the years and across devices, you can create a free account for cloud sync and backup.
                    </Text>

                    <Text style={styles.text}>
                        You can also export and import backups manually at any time.
                    </Text>

                    <Text style={styles.text}>
                        Enjoy!
                    </Text>

                    <Pressable
                        style={styles.button}
                        onPress={onClose}
                    >
                        <Text style={styles.buttonText}>
                            Begin Practice
                        </Text>
                    </Pressable>
                </Pressable>
            </Pressable>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.35)",
        justifyContent: "center",
        alignItems: "center",
        padding: 20,
    },

    modal: {
        width: "100%",
        maxWidth: 420,
        backgroundColor: "white",
        borderRadius: 16,
        padding: 24,
    },

    title: {
        fontSize: 22,
        fontWeight: "700",
        marginBottom: 16,
        textAlign: "center",
    },

    text: {
        fontSize: 15,
        color: "#333",
        lineHeight: 22,
        marginBottom: 12,
    },

    button: {
        marginTop: 10,
        alignSelf: "center",
        backgroundColor: colors.primary,
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: 10,
    },

    buttonText: {
        color: "white",
        fontSize: 15,
        fontWeight: "600",
    },
});