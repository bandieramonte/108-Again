import { MaterialIcons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text } from "react-native";
import { useI18n } from "../i18n";
import { useAppTheme } from "../styles/theme";

type Props = {
    accessibilityLabel?: string;
    onPress: () => void;
};

export default function EnableDailyTargetButton({
    accessibilityLabel,
    onPress,
}: Props) {
    const { colors } = useAppTheme();
    const { t } = useI18n();

    return (
        <Pressable
            style={({ pressed }) => [
                styles.button,
                { borderColor: colors.borderStrong },
                pressed && styles.buttonPressed,
            ]}
            onPress={onPress}
            accessibilityRole="button"
            accessibilityLabel={accessibilityLabel ?? t("practice.enableDailyTarget")}
        >
            <MaterialIcons
                name="check-circle-outline"
                size={17}
                color={colors.primary}
            />
            <Text style={[styles.text, { color: colors.textPrimary }]}>
                {t("practice.enableDailyTarget")}
            </Text>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    button: {
        flexDirection: "row",
        alignItems: "center",
        alignSelf: "flex-start",
        gap: 7,
        paddingVertical: 5,
        paddingHorizontal: 10,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: "#BFDBFE",
        backgroundColor: "transparent",
    },

    buttonPressed: {
        opacity: 0.72,
    },

    text: {
        fontSize: 14,
        fontWeight: "400",
    },
});
