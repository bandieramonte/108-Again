import React, { useEffect, useState } from "react";
import {
    Modal,
    Pressable,
    StyleSheet,
    Text,
    useWindowDimensions,
    View
} from "react-native";
import Svg, {
    Line,
    Rect,
    Text as SvgText,
} from "react-native-svg";
import * as sessionService from "../services/sessionService";

type DailyData = {
    date: string;
    total: number;
};

type Props = {
    visible: boolean;
    onClose: () => void;
    practiceId: string;
    total: number;
};

export default function PracticeHistoryModal({
    visible,
    onClose,
    practiceId,
    total,
}: Props) {
    const [selectedIndex, setSelectedIndex] =
        useState<number | null>(null);
    const [rangeDays, setRangeDays] = useState(10);
    const [dailyData, setDailyData] = useState<DailyData[]>([]);
    const { width: screenWidth } = useWindowDimensions();

    useEffect(() => {
        if (!visible) return;

        const data =
            sessionService.getDailyPracticeDataWithAdjustments(
                practiceId,
                rangeDays
            );

        setDailyData(data);
    }, [practiceId, rangeDays, visible]);

    function formatShortDate(date: string) {
        const d = new Date(date);

        return d.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
        });
    }

    function renderChart() {
        const width = Math.min(
            screenWidth - 32,
            760
        );

        const height = 220;

        const padding =
            total >= 1000000
                ? {
                    top: 30,
                    bottom: 30,
                    left: 50,
                    right: 15,
                }
                : total >= 100000
                    ? {
                        top: 30,
                        bottom: 30,
                        left: 40,
                        right: 15,
                    }
                    : {
                        top: 30,
                        bottom: 30,
                        left: 30,
                        right: 15,
                    };

        const chartWidth =
            width - padding.left - padding.right;

        const chartHeight =
            height - padding.top - padding.bottom;

        const values =
            dailyData.map((d) => d.total);

        const maxValue =
            Math.max(...values, 1);

        const steps = 4;

        const stepValue =
            Math.ceil(maxValue / steps / 10) * 10;

        const yTicks = Array.from(
            { length: steps + 1 },
            (_, i) => i * stepValue
        );

        const barWidth =
            chartWidth / dailyData.length;

        const labelCount = 4;

        const step = Math.max(
            1,
            Math.ceil(
                dailyData.length / labelCount
            )
        );

        const yScale = (value: number) =>
            (value / maxValue) * chartHeight;

        const tooltipWidth = 40;
        const tooltipHeight = 20;
        const tooltipOffset = 6;

        return (
            <View
                onStartShouldSetResponder={() => true}
                onResponderRelease={() =>
                    setSelectedIndex(null)
                }
            >
                <Svg width={width} height={height}>
                    {yTicks.map((value, i) => {
                        const y =
                            padding.top +
                            chartHeight -
                            (value / maxValue) *
                            chartHeight;

                        return (
                            <SvgText
                                key={`y-${i}`}
                                x={padding.left - 5}
                                y={y + 4}
                                fontSize="12"
                                textAnchor="end"
                                fill="#666"
                            >
                                {value}
                            </SvgText>
                        );
                    })}

                    {[0, 0.25, 0.5, 0.75, 1].map(
                        (p, i) => {
                            const y =
                                padding.top +
                                chartHeight *
                                (1 - p);

                            return (
                                <Line
                                    key={i}
                                    x1={padding.left}
                                    x2={
                                        width -
                                        padding.right
                                    }
                                    y1={y}
                                    y2={y}
                                    stroke="#ddd"
                                    strokeDasharray="3,3"
                                />
                            );
                        }
                    )}

                    {dailyData.map((d, i) => {
                        const barHeight =
                            yScale(d.total);

                        const x =
                            padding.left +
                            i * barWidth;

                        const y =
                            padding.top +
                            chartHeight -
                            barHeight;

                        return (
                            <Rect
                                key={d.date}
                                x={x}
                                y={y}
                                width={
                                    barWidth * 0.7
                                }
                                height={barHeight}
                                fill={
                                    selectedIndex === i
                                        ? "#144DA6"
                                        : "#1A5FCC"
                                }
                                onPress={() =>
                                    setSelectedIndex(
                                        i
                                    )
                                }
                            />
                        );
                    })}

                    {selectedIndex !== null &&
                        (() => {
                            const d =
                                dailyData[
                                selectedIndex
                                ];

                            const barHeight =
                                yScale(d.total);

                            const xCenter =
                                padding.left +
                                selectedIndex *
                                barWidth +
                                barWidth * 0.35;

                            const yBarTop =
                                padding.top +
                                chartHeight -
                                barHeight;

                            const yTooltip =
                                Math.max(
                                    padding.top,
                                    yBarTop -
                                    tooltipHeight -
                                    tooltipOffset
                                );

                            return (
                                <>
                                    <Rect
                                        x={
                                            xCenter -
                                            tooltipWidth /
                                            2
                                        }
                                        y={yTooltip}
                                        width={
                                            tooltipWidth
                                        }
                                        height={
                                            tooltipHeight
                                        }
                                        rx={4}
                                        fill="#111"
                                        opacity={0.85}
                                    />

                                    <SvgText
                                        x={xCenter}
                                        y={
                                            yTooltip +
                                            tooltipHeight /
                                            2 +
                                            4
                                        }
                                        fontSize="11"
                                        textAnchor="middle"
                                        fill="#fff"
                                        fontWeight="bold"
                                    >
                                        {d.total}
                                    </SvgText>
                                </>
                            );
                        })()}

                    {dailyData.map((d, i) => {
                        if (
                            i % step !== 0 &&
                            i !==
                            dailyData.length - 1
                        ) {
                            return null;
                        }

                        const x =
                            padding.left +
                            i * barWidth +
                            barWidth * 0.35;

                        return (
                            <SvgText
                                key={`x-${i}`}
                                x={x}
                                y={height - 10}
                                fontSize="12"
                                textAnchor="middle"
                                fill="#444"
                            >
                                {formatShortDate(
                                    d.date
                                )}
                            </SvgText>
                        );
                    })}
                </Svg>
            </View>
        );
    }

    return (
        <Modal
            visible={visible}
            transparent
            statusBarTranslucent
            animationType="slide"
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
                        Practice History
                    </Text>

                    <View style={styles.rangeSelector}>
                        {[10, 30, 90].map((days) => (
                            <Pressable
                                key={days}
                                onPress={() => setRangeDays(days)}
                                style={[
                                    styles.rangeButton,
                                    rangeDays === days &&
                                    styles.rangeButtonActive
                                ]}
                            >
                                <Text
                                    style={[
                                        styles.rangeButtonText,
                                        rangeDays === days &&
                                        styles.rangeButtonTextActive
                                    ]}
                                >
                                    {days} Days
                                </Text>
                            </Pressable>
                        ))}
                    </View>

                    {dailyData.length > 0 ? (
                        renderChart()
                    ) : (
                        <Text style={styles.empty}>
                            No history available yet.
                        </Text>
                    )}

                    <Pressable
                        style={styles.button}
                        onPress={onClose}
                    >
                        <Text style={styles.buttonText}>
                            Close
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
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0,0,0,0.35)",
        justifyContent: "center",
        alignItems: "center",
    },

    modal: {
        width: "100%",
        maxWidth: 800,
        backgroundColor: "white",
        borderRadius: 16,
        paddingVertical: 20,
        paddingHorizontal: 12,
    },

    title: {
        fontSize: 18,
        fontWeight: "bold",
        marginBottom: 16,
    },

    empty: {
        fontSize: 14,
        color: "#333",
        marginBottom: 20,
    },

    button: {
        marginTop: 16,
        alignSelf: "flex-end",
        paddingVertical: 8,
        paddingHorizontal: 16,
    },

    buttonText: {
        fontSize: 15,
        fontWeight: "600",
        color: "#2563eb",
    },

    rangeSelector: {
        flexDirection: "row",
        justifyContent: "center",
        gap: 8,
        marginBottom: 16,
        flexWrap: "wrap",
    },

    rangeButton: {
        paddingVertical: 8,
        paddingHorizontal: 14,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: "#d1d5db",
        backgroundColor: "#fff",
    },

    rangeButtonActive: {
        backgroundColor: "#1A5FCC",
        borderColor: "#1A5FCC",
    },

    rangeButtonText: {
        fontSize: 14,
        fontWeight: "600",
        color: "#444",
    },

    rangeButtonTextActive: {
        color: "white",
    },
});