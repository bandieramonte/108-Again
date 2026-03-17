import * as Localization from "expo-localization";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Button, Dimensions, FlatList, Image, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from "react-native";
import Svg, { Line, Rect, Text as SvgText } from "react-native-svg";
import { practiceImages } from "../../constants/practiceImages";
import * as practiceService from "../../services/practiceService";
import * as sessionService from "../../services/sessionService";

type Session = {
    id: string;
    count: number;
    createdAt: number;
};

export default function PracticeContent({ practiceId }: { practiceId: string }) {
    const router = useRouter();
    const [practiceName, setPracticeName] = useState("");
    const [sessions, setSessions] = useState<Session[]>([]);
    const [total, setTotal] = useState(0);
    const [customValue, setCustomValue] = useState("");
    const [viewMode, setViewMode] = useState<"chart" | "table">("chart");
    const [rangeDays, setRangeDays] = useState(10);
    const [dailyData, setDailyData] = useState<
        { date: string; total: number }[]
    >([]);
    const [editingValues, setEditingValues] = useState<Record<string, string>>({});
    const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
    const [imageKey, setImageKey] = useState<string | null>(null);
    const [ratio, setRatio] = useState(1);
    const { width } = useWindowDimensions();

    useEffect(() => {
        if (imageKey && practiceImages[imageKey]) {
            const source = Image.resolveAssetSource(practiceImages[imageKey]);

            if (source?.width && source?.height) {
                setRatio(source.width / source.height);
            }
        }
    }, [imageKey]);

    useEffect(() => {
        const practice = practiceService.getPractice(practiceId);

        if (practice) {
            setPracticeName(practice.name);
            setImageKey(practice.imageKey ?? null);
        }

        const timeout = setTimeout(() => {
            loadSessions();
            loadDailyData(rangeDays);
        }, 0);

        return () => clearTimeout(timeout);

    }, [practiceId, rangeDays, viewMode]);

    useEffect(() => {
        loadSessions();
    }, []);

    function loadSessions() {

        const rows = sessionService.getSessionsForPractice(practiceId) as Session[];
        setSessions(rows);

        const total = rows.reduce((sum, s) => sum + s.count, 0);
        setTotal(total);
    }

    function addSession(count: number) {
        sessionService.addSession(practiceId, count);
        loadSessions();
        loadDailyData(rangeDays);
    }

    function confirmDelete() {

        Alert.alert(
            "Delete practice?",
            "All sessions for this practice will also be deleted.",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: deletePractice
                }
            ]
        );

    }

    function deletePractice() {

        practiceService.deletePractice(practiceId);
        router.replace("/");

    }

    function loadDailyData(days: number) {

        const data =
            viewMode === "table"
                ? sessionService.getDailyPracticeDataWithAdjustments(
                    practiceId,
                    days
                )
                : sessionService.getDailyPracticeData(
                    practiceId,
                    days
                );

        setDailyData(data);
    }


    function formatShortDate(dateString: string) {

        const d = new Date(dateString + "T00:00:00");
        const locale = Localization.getLocales()[0];

        const day = String(d.getDate()).padStart(2, "0");
        const month = String(d.getMonth() + 1).padStart(2, "0");

        // If locale region is US → month/day
        if (locale.regionCode === "US") {
            return `${month}/${day}`;
        }

        // Everywhere else → day/month
        return `${day}/${month}`;
    }

    function renderChart() {

        const width = Dimensions.get("window").width - 40;
        const height = 220;
        const padding = { top: 30, bottom: 30, left: 30, right: 10 };
        const chartWidth = width - padding.left - padding.right;
        const chartHeight = height - padding.top - padding.bottom;
        const values = dailyData.map(d => d.total);
        const maxValue = Math.max(...values, 1);
        const steps = 4;
        const stepValue = Math.ceil(maxValue / steps / 10) * 10;
        const yTicks = Array.from({ length: steps + 1 }, (_, i) => i * stepValue);
        const barWidth = chartWidth / dailyData.length;
        const labelCount = 4;
        const step = Math.max(1, Math.ceil(dailyData.length / labelCount));
        const yScale = (value: number) => (value / maxValue) * chartHeight;
        const tooltipWidth = 40;
        const tooltipHeight = 20;
        const tooltipOffset = 6;

        return (
            <View
                onStartShouldSetResponder={() => true}
                onResponderRelease={() => setSelectedIndex(null)}
            >
                <Svg width={width} height={height}>

                    {/* Y-axis labels */}
                    {yTicks.map((value, i) => {
                        const y =
                            padding.top +
                            chartHeight -
                            (value / maxValue) * chartHeight;

                        return (
                            <SvgText
                                key={`y-label-${i}`}
                                x={padding.left - 5}
                                y={y + 4}
                                fontSize="10"
                                textAnchor="end"
                                fill="#666"
                            >
                                {value}
                            </SvgText>
                        );
                    })}

                    {/* grid lines */}
                    {[0, 0.25, 0.5, 0.75, 1].map((p, i) => {
                        const y = padding.top + chartHeight * (1 - p);

                        return (
                            <Line
                                key={i}
                                x1={padding.left}
                                x2={width - padding.right}
                                y1={y}
                                y2={y}
                                stroke="#ddd"
                                strokeDasharray="3,3"
                            />
                        );
                    })}

                    {/* bars */}
                    {dailyData.map((d, i) => {

                        const barHeight = yScale(d.total);

                        const x = padding.left + i * barWidth;
                        const y = padding.top + chartHeight - barHeight;

                        return (
                            <Rect
                                key={d.date}
                                x={x}
                                y={y}
                                width={barWidth * 0.7}
                                height={barHeight}
                                fill={selectedIndex === i ? "#1d4ed8" : "#3b82f6"}
                                onPress={() => setSelectedIndex(i)}
                            />
                        );
                    })}

                    {/* Tooltip with background */}
                    {selectedIndex !== null && (() => {

                        const d = dailyData[selectedIndex];
                        const barHeight = yScale(d.total);

                        const xCenter = padding.left + selectedIndex * barWidth + barWidth * 0.35;
                        const yBarTop = padding.top + chartHeight - barHeight;

                        // --- prevent clipping at top ---
                        const yTooltip = Math.max(
                            padding.top,
                            yBarTop - tooltipHeight - tooltipOffset
                        );

                        return (
                            <>
                                {/* background */}
                                <Rect
                                    x={xCenter - tooltipWidth / 2}
                                    y={yTooltip}
                                    width={tooltipWidth}
                                    height={tooltipHeight}
                                    rx={4}
                                    fill="#111"
                                    opacity={0.85}
                                />

                                {/* text */}
                                <SvgText
                                    x={xCenter}
                                    y={yTooltip + tooltipHeight / 2 + 4}
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

                    {/* x-axis labels */}
                    {dailyData.map((d, i) => {

                        if (i % step !== 0 && i !== dailyData.length - 1) return null;

                        const x = padding.left + i * barWidth + barWidth * 0.35;

                        return (
                            <SvgText
                                key={`label-${i}`}
                                x={x}
                                y={height - 10}
                                fontSize="10"
                                textAnchor="middle"
                                fill="#444"
                            >
                                {formatShortDate(d.date)}
                            </SvgText>
                        );
                    })}

                </Svg>

            </View>

        );
    }

    function handleEdit(date: string, newValue: number) {
        if (!Number.isFinite(newValue)) return;

        if (newValue < 0) {
            alert("Value cannot be negative");
            return;
        }

        if (!Number.isInteger(newValue)) {
            alert("Please enter a whole number");
            return;
        }
        sessionService.adjustDayTotal(practiceId, date, newValue);

        loadSessions();
        loadDailyData(rangeDays);
    }

    function renderTable() {
        return (
            <FlatList
                data={dailyData}
                keyExtractor={(item) => item.date}
                renderItem={({ item }) => (
                    <View style={styles.row}>
                        <Text>
                            {formatShortDate(item.date)}
                        </Text>
                        <TextInput
                            value={editingValues[item.date] ?? String(item.total)}
                            keyboardType="numeric"
                            style={styles.editableCell}
                            onChangeText={(text) => {
                                setEditingValues(prev => ({
                                    ...prev,
                                    [item.date]: text
                                }));
                            }}
                            onEndEditing={() => {
                                const value = Number(editingValues[item.date]);
                                handleEdit(item.date, value);

                                // clear editing state
                                setEditingValues(prev => {
                                    const copy = { ...prev };
                                    delete copy[item.date];
                                    return copy;
                                });
                            }}
                        />
                    </View>
                )}
                scrollEnabled={false}
            />
        );
    }

    return (

        <ScrollView
            style={{ marginTop: 24 }}
            contentContainerStyle={{
                paddingBottom: 40,
                alignItems: "stretch"
            }}
        >
            <Text style={styles.title}>
                {practiceName}
            </Text>

            {imageKey && practiceImages[imageKey] && (
                <Image
                    source={practiceImages[imageKey]}
                    style={{
                        width: width,
                        alignSelf: "center",
                        marginBottom: 15
                    }}
                    resizeMode="contain"
                />
            )}

            <View style={{ paddingHorizontal: 20 }}>

                <Text style={styles.total}>
                    Total: {total}
                </Text>

                <View style={{ flexDirection: "row", gap: 10, marginBottom: 20 }}>

                    <Button
                        title="Edit"
                        onPress={() =>
                            router.push({
                                pathname: "/edit-practice",
                                params: {
                                    id: practiceId,
                                    practiceName
                                }
                            })
                        }
                    />

                    <Button
                        title="Delete"
                        color="red"
                        onPress={confirmDelete}
                    />

                </View>

                <View style={styles.addSection}>

                    <Text style={styles.sectionTitle}>
                        Add repetitions
                    </Text>

                    <View style={styles.buttonRow}>
                        <Button title="+1" onPress={() => addSession(1)} />
                        <Button title="+27" onPress={() => addSession(27)} />
                        <Button title="+108" onPress={() => addSession(108)} />
                    </View>

                    <TextInput
                        placeholder="Custom count"
                        keyboardType="numeric"
                        value={customValue}
                        onChangeText={setCustomValue}
                        style={styles.input}
                    />

                    <Button
                        title="Add custom"
                        onPress={() => addSession(Number(customValue))}
                    />

                </View>

                <Text style={styles.total}>
                    Practice History
                </Text>
                <View style={{ flexDirection: "row", gap: 10, marginBottom: 20 }}>

                    <Button
                        title="Chart"
                        onPress={() => setViewMode("chart")}
                    />

                    <Button
                        title="Table"
                        onPress={() => setViewMode("table")}
                    />

                </View>

                <View style={{ flexDirection: "row", gap: 10, marginBottom: 20 }}>
                    <Button title="10d" onPress={() => { setRangeDays(10); loadDailyData(10); }} />
                    <Button title="30d" onPress={() => { setRangeDays(30); loadDailyData(30); }} />
                    <Button title="90d" onPress={() => { setRangeDays(90); loadDailyData(90); }} />
                </View>

                {dailyData.every(d => d.total === 0)
                    ? <Text>No practice recorded in this period.</Text>
                    : (
                        <View key={dailyData.length}>
                            {viewMode === "chart"
                                ? renderChart()
                                : renderTable()
                            }
                        </View>
                    )
                }
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({

    container: {
        marginTop: 60
    },

    contentContainerStyle: {
        padding: 20,
        paddingBottom: 40
    },

    title: {
        fontSize: 24,
        fontWeight: "bold",
        textAlign: "center",
        marginBottom: 12
    },

    total: {
        fontSize: 18,
        marginBottom: 20
    },

    sectionTitle: {
        fontSize: 16,
        marginBottom: 10
    },

    row: {
        flexDirection: "row",
        justifyContent: "space-between",
        paddingVertical: 6
    },

    addSection: {
        marginBottom: 30
    },

    buttonRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        marginBottom: 10
    },

    input: {
        borderWidth: 1,
        borderColor: "#ccc",
        padding: 8,
        marginBottom: 10
    },

    editableCell: {
        borderBottomWidth: 1,
        borderColor: "#aaa",
        minWidth: 60,
        textAlign: "right",
        paddingVertical: 2
    },

});