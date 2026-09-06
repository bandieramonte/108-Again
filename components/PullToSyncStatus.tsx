import { MaterialIcons } from "@expo/vector-icons";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import type { PullToSyncStatus as Status } from "../hooks/usePullToSync";
import { useI18n } from "../i18n";
import { useAppTheme } from "../styles/theme";

export default function PullToSyncStatus({
    status,
}: {
    status: Status | null;
}) {
    const { t } = useI18n();
    const { colors } = useAppTheme();

    if (!status) return null;

    const content = (() => {
        switch (status) {
            case "syncing":
                return {
                    color: colors.primary,
                    icon: null,
                    label: t("account.syncing"),
                };
            case "success":
                return {
                    color: colors.success,
                    icon: "check-circle" as const,
                    label: t("account.syncSuccess"),
                };
            case "offline":
                return {
                    color: colors.warning,
                    icon: "cloud-off" as const,
                    label: t("account.syncOfflineUnavailable"),
                };
            case "postponed":
                return {
                    color: colors.warning,
                    icon: "schedule" as const,
                    label: t("account.syncPostponedTitle"),
                };
            case "signed_out":
                return {
                    color: colors.warning,
                    icon: "person-outline" as const,
                    label: t("account.syncSignInRequired"),
                };
            case "failed":
                return {
                    color: colors.destructive,
                    icon: "error-outline" as const,
                    label: t("account.syncError"),
                };
        }
    })();

    return (
        <View
            pointerEvents="none"
            style={styles.overlay}
        >
            <View
                accessibilityLiveRegion="polite"
                style={[
                    styles.pill,
                    {
                        backgroundColor: colors.surfaceElevated,
                        borderColor: colors.borderSubtle,
                        shadowColor: colors.shadow,
                    },
                ]}
            >
                {status === "syncing" ? (
                    <ActivityIndicator size="small" color={content.color} />
                ) : (
                    <MaterialIcons
                        name={content.icon ?? "sync"}
                        size={18}
                        color={content.color}
                    />
                )}
                <Text style={[styles.label, { color: colors.textPrimary }]}>
                    {content.label}
                </Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    overlay: {
        position: "absolute",
        top: 10,
        left: 0,
        right: 0,
        alignItems: "center",
        zIndex: 100,
        elevation: 6,
    },
    pill: {
        flexDirection: "row",
        alignItems: "center",
        gap: 7,
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 999,
        borderWidth: 1,
        shadowOpacity: 0.12,
        shadowRadius: 5,
        shadowOffset: { width: 0, height: 2 },
    },
    label: {
        fontSize: 13,
        fontWeight: "600",
    },
});
