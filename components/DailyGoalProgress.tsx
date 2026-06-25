import {
    StyleSheet,
    Text,
    View,
    type DimensionValue,
    type StyleProp,
    type TextStyle,
    type ViewStyle,
} from "react-native";
import { useI18n } from "../i18n";
import { colors } from "../styles/theme";
import { formatCountProgress } from "../utils/numberUtils";

type Props = {
    todayCount: number;
    dailyTargetCount: number;
    label?: string;
    barWidth?: DimensionValue;
    height?: number;
    style?: StyleProp<ViewStyle>;
    labelStyle?: StyleProp<TextStyle>;
    barStyle?: StyleProp<ViewStyle>;
    textStyle?: StyleProp<TextStyle>;
    labelNumberOfLines?: number;
};

export default function DailyGoalProgress({
    todayCount,
    dailyTargetCount,
    label,
    barWidth,
    height = 15,
    style,
    labelStyle,
    barStyle,
    textStyle,
    labelNumberOfLines,
}: Props) {
    const { t } = useI18n();
    const safeTodayCount = Number.isFinite(todayCount)
        ? todayCount
        : 0;
    const safeTargetCount =
        Number.isFinite(dailyTargetCount) && dailyTargetCount > 0
            ? dailyTargetCount
            : 0;
    const progress =
        safeTargetCount > 0
            ? Math.min(safeTodayCount / safeTargetCount, 1)
            : 0;
    const isFinished =
        safeTargetCount > 0 &&
        safeTodayCount >= safeTargetCount;

    return (
        <View style={[styles.row, style]}>
            <Text
                style={[styles.label, labelStyle]}
                numberOfLines={labelNumberOfLines}
                ellipsizeMode="tail"
            >
                {label ?? t("dailyGoal.label")}
            </Text>

            <View
                style={[
                    styles.bar,
                    {
                        height,
                        borderRadius: height / 2,
                    },
                    barWidth != null && { width: barWidth },
                    isFinished && styles.barFinished,
                    barStyle,
                ]}
            >
                <View
                    style={[
                        styles.fill,
                        { width: `${progress * 100}%` },
                    ]}
                />

                <View style={styles.textOverlay}>
                    <Text
                        style={[
                            styles.barText,
                            {
                                height,
                                lineHeight: height,
                            },
                            isFinished && styles.barTextFinished,
                            textStyle,
                        ]}
                    >
                        {isFinished
                            ? t("dailyGoal.finished")
                            : formatCountProgress(
                                safeTodayCount,
                                safeTargetCount
                            )}
                    </Text>
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    row: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
    },

    label: {
        fontSize: 14,
        fontWeight: "400",
        color: "#111",

    },

    bar: {
        borderWidth: 1,
        borderColor: "#D1D5DB",
        backgroundColor: "#F9FAFB",
        overflow: "hidden",
    },

    barFinished: {
        borderColor: colors.primary,
    },

    fill: {
        position: "absolute",
        left: 0,
        top: 0,
        bottom: 0,
        backgroundColor: "rgba(107, 114, 128, 0.28)",
    },

    textOverlay: {
        position: "absolute",
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
        alignItems: "center",
        justifyContent: "center",
    },

    barText: {
        color: "#111",
        fontSize: 14,
        fontWeight: "400",
        includeFontPadding: false,
        textAlign: "center",
        textAlignVertical: "center",
    },

    barTextFinished: {
        color: colors.primary,
    },
});
