import { MaterialIcons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useI18n } from "../i18n";
import { useAppTheme } from "../styles/theme";

type Props = {
    canGoForward: boolean;
    canGoBack: boolean;
    label: string;
    onNextMonth: () => void;
    onNextYear: () => void;
    onPreviousMonth: () => void;
    onPreviousYear: () => void;
};

type NavigationButtonProps = {
    accessibilityLabel: string;
    disabled: boolean;
    icon: keyof typeof MaterialIcons.glyphMap;
    onPress: () => void;
};

export default function CalendarNavigationHeader({
    canGoForward,
    canGoBack,
    label,
    onNextMonth,
    onNextYear,
    onPreviousMonth,
    onPreviousYear,
}: Props) {
    const { colors } = useAppTheme();
    const { t } = useI18n();

    function NavigationButton({
        accessibilityLabel,
        disabled,
        icon,
        onPress,
    }: NavigationButtonProps) {
        return (
            <Pressable
                accessibilityLabel={accessibilityLabel}
                accessibilityRole="button"
                accessibilityState={{ disabled }}
                disabled={disabled}
                hitSlop={8}
                onPress={onPress}
                style={({ pressed }) => [
                    styles.navigationButton,
                    pressed && !disabled && styles.pressed,
                ]}
            >
                <MaterialIcons
                    name={icon}
                    size={24}
                    color={
                        disabled
                            ? colors.inputPlaceholder
                            : colors.primary
                    }
                />
            </Pressable>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.navigationGroup}>
                <NavigationButton
                    accessibilityLabel={t("calendar.previousYear")}
                    disabled={!canGoBack}
                    icon="keyboard-double-arrow-left"
                    onPress={onPreviousYear}
                />
                <NavigationButton
                    accessibilityLabel={t("calendar.previousMonth")}
                    disabled={!canGoBack}
                    icon="chevron-left"
                    onPress={onPreviousMonth}
                />
            </View>

            <Text
                numberOfLines={1}
                style={[styles.label, { color: colors.textPrimary }]}
            >
                {label}
            </Text>

            <View style={styles.navigationGroup}>
                <NavigationButton
                    accessibilityLabel={t("calendar.nextMonth")}
                    disabled={!canGoForward}
                    icon="chevron-right"
                    onPress={onNextMonth}
                />
                <NavigationButton
                    accessibilityLabel={t("calendar.nextYear")}
                    disabled={!canGoForward}
                    icon="keyboard-double-arrow-right"
                    onPress={onNextYear}
                />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        minHeight: 48,
        paddingHorizontal: 4,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },

    navigationGroup: {
        width: 80,
        flexDirection: "row",
        justifyContent: "space-between",
    },

    navigationButton: {
        width: 36,
        height: 36,
        alignItems: "center",
        justifyContent: "center",
    },

    label: {
        flex: 1,
        minWidth: 0,
        paddingHorizontal: 4,
        fontSize: 18,
        fontWeight: "600",
        textAlign: "center",
    },

    pressed: {
        opacity: 0.55,
    },
});
