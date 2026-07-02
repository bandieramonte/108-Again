import { useI18n } from "@/i18n";
import { useAppTheme } from "@/styles/theme";
import { Modal, Pressable, StyleSheet, Text } from "react-native";

type Props = {
    visible: boolean;
    onClose: () => void;
};

export default function WelcomeModal({
    visible,
    onClose,
}: Props) {
    const { colors } = useAppTheme();
    const { t } = useI18n();

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
        >
            <Pressable
                style={[
                    styles.overlay,
                    { backgroundColor: colors.overlay },
                ]}
                onPress={onClose}
            >
                <Pressable
                    style={[
                        styles.modal,
                        { backgroundColor: colors.surfaceElevated },
                    ]}
                    onPress={() => { }}
                >
                    <Text style={[styles.title, { color: colors.textPrimary }]}>
                        {t("welcome.title")}
                    </Text>

                    <Text style={[styles.text, { color: colors.textSecondary }]}>
                        {t("welcome.text1")}
                    </Text>

                    <Text style={[styles.text, { color: colors.textSecondary }]}>
                        {t("welcome.text2")}
                    </Text>

                    <Text style={[styles.text, { color: colors.textSecondary }]}>
                        {t("welcome.text3")}
                    </Text>

                    <Text style={[styles.text, { color: colors.textSecondary }]}>
                        {t("welcome.text4")}
                    </Text>

                    <Text style={[styles.text, { color: colors.textSecondary }]}>
                        {t("welcome.enjoy")}
                    </Text>

                    <Pressable
                        style={[
                            styles.button,
                            { backgroundColor: colors.primary },
                        ]}
                        onPress={onClose}
                    >
                        <Text style={styles.buttonText}>
                            {t("welcome.begin")}
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
