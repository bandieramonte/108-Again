import { useI18n } from "@/i18n";
import { useAppTheme } from "@/styles/theme";
import { MaterialIcons } from "@expo/vector-icons";
import {
    Pressable,
    StyleSheet,
    View,
} from "react-native";

type Props = {
    canGoBack: boolean;
    onBack: () => void;
};

export default function HeaderLeftControls({
    canGoBack,
    onBack,
}: Props) {
    const { colors } = useAppTheme();
    const { t } = useI18n();

    if (!canGoBack) return <View style={styles.placeholder} />;

    return (
        <View style={styles.container}>
            <Pressable
                onPress={onBack}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel={t("common.back")}
                style={({ pressed }) => [
                    styles.backButton,
                    pressed && styles.pressed,
                ]}
            >
                <MaterialIcons
                    name="arrow-back"
                    size={24}
                    color={colors.icon}
                />
            </Pressable>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        marginLeft: 10,
        flexDirection: "row",
        alignItems: "center",
    },

    backButton: {
        width: 34,
        height: 34,
        alignItems: "center",
        justifyContent: "center",
    },

    placeholder: {
        width: 44,
    },

    pressed: {
        opacity: 0.55,
    },
});
