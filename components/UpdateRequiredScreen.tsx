import { MaterialIcons } from "@expo/vector-icons";
import { useEffect } from "react";
import {
    ActivityIndicator,
    BackHandler,
    Pressable,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useI18n } from "../i18n";
import type { UpdateRequirement } from "../services/appUpdatePolicy";
import { globalStyles } from "../styles/global";
import { colors } from "../styles/theme";

type RequiredUpdate = Extract<
    UpdateRequirement,
    { kind: "required" }
>;

type Props = {
    requirement: RequiredUpdate;
    checking: boolean;
    onRetry: () => void;
    onUpdate: () => void;
};

export default function UpdateRequiredScreen({
    requirement,
    checking,
    onRetry,
    onUpdate,
}: Props) {
    const { t } = useI18n();
    const isMaintenance = requirement.reason === "maintenance";
    const message = requirement.message ??
        (
            isMaintenance
                ? t("update.maintenanceMessage")
                : t("update.requiredMessage")
        );

    useEffect(() => {
        const subscription = BackHandler.addEventListener(
            "hardwareBackPress",
            () => true
        );

        return () => subscription.remove();
    }, []);

    return (
        <SafeAreaView style={[globalStyles.sidePadding, styles.screen]}>
            <View style={styles.card}>
                <MaterialIcons
                    name={isMaintenance ? "build" : "system-update"}
                    size={52}
                    color={colors.primary}
                />

                <Text style={styles.title}>
                    {isMaintenance
                        ? t("update.maintenanceTitle")
                        : t("update.requiredTitle")}
                </Text>

                <Text style={styles.message}>
                    {message}
                </Text>

                {!isMaintenance && (
                    <Pressable
                        style={({ pressed }) => [
                            styles.primaryButton,
                            pressed && styles.buttonPressed,
                        ]}
                        onPress={onUpdate}
                        accessibilityRole="button"
                        accessibilityLabel={t("update.updateA11y")}
                    >
                        <Text style={styles.primaryButtonText}>
                            {t("update.updateNow")}
                        </Text>
                    </Pressable>
                )}

                <Pressable
                    style={({ pressed }) => [
                        styles.retryButton,
                        pressed && styles.buttonPressed,
                    ]}
                    onPress={onRetry}
                    disabled={checking}
                    accessibilityRole="button"
                    accessibilityLabel={t("update.checkAgain")}
                >
                    {checking ? (
                        <ActivityIndicator color={colors.primary} />
                    ) : (
                        <Text style={styles.retryButtonText}>
                            {t("update.checkAgain")}
                        </Text>
                    )}
                </Pressable>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: colors.background,
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 17,
    },
    card: {
        width: "100%",
        maxWidth: 420,
        alignItems: "center",
        gap: 18,
    },
    title: {
        fontSize: 24,
        fontWeight: "700",
        color: colors.textPrimary,
        textAlign: "center",
    },
    message: {
        fontSize: 16,
        lineHeight: 23,
        color: colors.textSecondary,
        textAlign: "center",
        marginBottom: 8,
    },
    primaryButton: {
        width: "100%",
        minHeight: 52,
        borderRadius: 12,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.primary,
    },
    primaryButtonText: {
        color: "white",
        fontSize: 16,
        fontWeight: "700",
    },
    retryButton: {
        minHeight: 44,
        minWidth: 140,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 18,
    },
    retryButtonText: {
        color: colors.primary,
        fontSize: 15,
        fontWeight: "600",
    },
    buttonPressed: {
        opacity: 0.72,
    },
});
