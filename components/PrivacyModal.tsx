import React from "react";
import {
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { useI18n } from "../i18n";
import { useAppTheme } from "../styles/theme";
import { PrivacyContent } from "../utils/privacyText";

type Props = {
    visible: boolean;
    onClose: () => void;
};

export default function PrivacyModal({ visible, onClose }: Props) {
    const { colors } = useAppTheme();
    const { t } = useI18n();

    return (
        <Modal
            visible={visible}
            animationType="slide"
            presentationStyle="pageSheet"
        >
            <View
                style={[
                    styles.container,
                    { backgroundColor: colors.background },
                ]}
            >

                {/* Content */}
                <ScrollView
                    style={styles.content}
                    showsVerticalScrollIndicator
                >
                    <PrivacyContent />
                </ScrollView>

                {/* Bottom Close Button */}
                <View
                    style={[
                        styles.bottom,
                        { borderColor: colors.borderSubtle },
                    ]}
                >
                    <TouchableOpacity
                        style={[
                            styles.closeButton,
                            { backgroundColor: colors.primary },
                        ]}
                        onPress={onClose}
                    >
                        <Text style={styles.closeButtonText}>
                            {t("common.close")}
                        </Text>
                    </TouchableOpacity>
                </View>

            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#fff",
        paddingTop: 30,
        alignSelf: "center",
        maxWidth: 900,
        width: "100%",
    },

    closeText: {
        fontSize: 22,
        fontWeight: "500",
        color: "#444",
    },

    content: {
        paddingHorizontal: 16,
    },

    bottom: {
        padding: 16,
        borderTopWidth: 1,
        borderColor: "#eee",
    },

    closeButton: {
        paddingVertical: 14,
        borderRadius: 10,
        alignItems: "center",
    },

    closeButtonText: {
        color: "#fff",
        fontSize: 16,
        fontWeight: "600",
    },
});
