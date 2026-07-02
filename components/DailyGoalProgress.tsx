import {
    Animated,
    StyleSheet,
    Text,
    View,
    type DimensionValue,
    type StyleProp,
    type TextStyle,
    type ViewStyle,
} from "react-native";
import { useEffect, useRef, useState } from "react";
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

const BORDER_WIDTH_IDLE = 1;
const BORDER_WIDTH_FINISHED = 2;
const BORDER_WIDTH_PEAK = 4;
const GOAL_FINISHED_FADE_IN_MS = 400;
const GOAL_FINISHED_FADE_OUT_MS = 2000;

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
    const { locale, t } = useI18n();
    const [showFinishedMessage, setShowFinishedMessage] = useState(false);
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
    const completionAnim = useRef(
        new Animated.Value(isFinished ? 1 : 0)
    ).current;
    const pulseAnim = useRef(new Animated.Value(0)).current;
    const finishedOpacity = useRef(new Animated.Value(0)).current;
    const wasFinishedRef = useRef(isFinished);
    const animatedBorderWidth = Animated.add(
        completionAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [BORDER_WIDTH_IDLE, BORDER_WIDTH_FINISHED],
        }),
        pulseAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [0, BORDER_WIDTH_PEAK - BORDER_WIDTH_FINISHED],
        })
    );
    const animatedBorderColor = completionAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ["#D1D5DB", colors.primary],
    });
    const countOpacity = showFinishedMessage
        ? finishedOpacity.interpolate({
            inputRange: [0, 1],
            outputRange: [1, 0],
        })
        : 1;
    const progressText =
        formatCountProgress(
            safeTodayCount,
            safeTargetCount,
            locale
        );

    useEffect(() => {
        const wasFinished = wasFinishedRef.current;

        wasFinishedRef.current = isFinished;

        if (!isFinished) {
            completionAnim.stopAnimation();
            pulseAnim.stopAnimation();
            finishedOpacity.stopAnimation();
            completionAnim.setValue(0);
            pulseAnim.setValue(0);
            finishedOpacity.setValue(0);
            setShowFinishedMessage(false);
            return;
        }

        if (wasFinished) {
            completionAnim.stopAnimation();
            pulseAnim.stopAnimation();
            finishedOpacity.stopAnimation();
            completionAnim.setValue(1);
            pulseAnim.setValue(0);
            finishedOpacity.setValue(0);
            setShowFinishedMessage(false);
            return;
        }

        let active = true;

        setShowFinishedMessage(true);
        completionAnim.setValue(0);
        pulseAnim.setValue(0);
        finishedOpacity.setValue(0);

        const animation = Animated.parallel([
            Animated.timing(completionAnim, {
                toValue: 1,
                duration: GOAL_FINISHED_FADE_IN_MS,
                useNativeDriver: false,
            }),
            Animated.sequence([
                Animated.timing(pulseAnim, {
                    toValue: 1,
                    duration: GOAL_FINISHED_FADE_IN_MS,
                    useNativeDriver: false,
                }),
                Animated.timing(pulseAnim, {
                    toValue: 0,
                    duration: GOAL_FINISHED_FADE_OUT_MS,
                    useNativeDriver: false,
                }),
            ]),
            Animated.sequence([
                Animated.timing(finishedOpacity, {
                    toValue: 1,
                    duration: GOAL_FINISHED_FADE_IN_MS,
                    useNativeDriver: false,
                }),
                Animated.timing(finishedOpacity, {
                    toValue: 0,
                    duration: GOAL_FINISHED_FADE_OUT_MS,
                    useNativeDriver: false,
                }),
            ]),
        ]);

        animation.start(({ finished }) => {
            if (active && finished) {
                setShowFinishedMessage(false);
            }
        });

        return () => {
            active = false;
            animation.stop();
        };
    }, [
        completionAnim,
        finishedOpacity,
        isFinished,
        pulseAnim,
    ]);

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
                    barStyle,
                    barWidth != null && { width: barWidth },
                    {
                        height,
                        borderRadius: height / 2,
                    },
                ]}
            >
                <View
                    style={[
                        styles.fill,
                        { width: `${progress * 100}%` },
                    ]}
                />

                <Animated.View
                    pointerEvents="none"
                    style={[
                        styles.borderOverlay,
                        {
                            borderRadius: height / 2,
                            borderColor: animatedBorderColor,
                            borderWidth: animatedBorderWidth,
                        },
                    ]}
                />

                <View style={styles.textOverlay}>
                    <Animated.Text
                        style={[
                            styles.barText,
                            {
                                height,
                                lineHeight: height,
                                opacity: countOpacity,
                            },
                            isFinished && styles.barTextFinished,
                            textStyle,
                        ]}
                    >
                        {progressText}
                    </Animated.Text>

                    {showFinishedMessage && (
                        <Animated.Text
                            style={[
                                styles.barText,
                                styles.finishedMessage,
                                {
                                    height,
                                    lineHeight: height,
                                    opacity: finishedOpacity,
                                },
                                styles.barTextFinished,
                                textStyle,
                            ]}
                        >
                            {t("dailyGoal.finished")}
                        </Animated.Text>
                    )}
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
        overflow: "hidden",
    },

    borderOverlay: {
        position: "absolute",
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
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

    finishedMessage: {
        position: "absolute",
        left: 0,
        right: 0,
    },

    barTextFinished: {
        color: colors.primary,
    },
});
