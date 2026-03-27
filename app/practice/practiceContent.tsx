import { MaterialIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Localization from "expo-localization";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Animated, Button, Dimensions, FlatList, Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from "react-native";
import Svg, { Line, Rect, Text as SvgText } from "react-native-svg";
import { practiceImages } from "../../constants/practiceImages";
import { useReachedCelebration } from "../../hooks/useReachedCelebration";
import * as practiceService from "../../services/practiceService";
import * as sessionService from "../../services/sessionService";
import { subscribeData } from "../../utils/events";

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
    const [defaultAddCount, setDefaultAddCount] = useState("");
    const [menuOpen, setMenuOpen] = useState(false);
    const rotateAnim = useRef(new Animated.Value(0)).current;
    const titleRowRef = useRef<View | null>(null);
    const [menuAnchor, setMenuAnchor] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
    const [showTableTooltip, setShowTableTooltip] = useState(false);
    const [targetCount, setTargetCount] = useState(0);
    const {
        celebrationFade,
        sparkle1,
        sparkle2,
        sparkle3,
        updateReachedState,
        isCelebrating,
    } = useReachedCelebration();
    const practiceRefreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (imageKey && practiceImages[imageKey]) {
            const source = Image.resolveAssetSource(practiceImages[imageKey]);

            if (source?.width && source?.height) {
                setRatio(source.width / source.height);
            }
        }
    }, [imageKey]);

    useEffect(() => {
        schedulePracticeRefresh();

        return () => {
            if (practiceRefreshTimeoutRef.current) {
                clearTimeout(practiceRefreshTimeoutRef.current);
            }
        };
    }, [practiceId, rangeDays, viewMode]);

    useEffect(() => {
        const unsubscribe = subscribeData(() => {
            schedulePracticeRefresh();
        });

        return unsubscribe;
    }, [practiceId, rangeDays, viewMode]);

    useEffect(() => {
        let showTimeout: ReturnType<typeof setTimeout> | null = null;
        let hideTimeout: ReturnType<typeof setTimeout> | null = null;

        async function maybeShowTableTooltip() {
            if (viewMode !== "table") return;

            const seen = await AsyncStorage.getItem("practiceTableTooltipSeen");
            if (seen) return;

            showTimeout = setTimeout(async () => {
                setShowTableTooltip(true);
                await AsyncStorage.setItem("practiceTableTooltipSeen", "true");

                hideTimeout = setTimeout(() => {
                    setShowTableTooltip(false);
                }, 5000);
            }, 500);
        }

        maybeShowTableTooltip();

        if (viewMode !== "table") {
            setShowTableTooltip(false);
        }

        return () => {
            if (showTimeout) clearTimeout(showTimeout);
            if (hideTimeout) clearTimeout(hideTimeout);
        };
    }, [viewMode]);

    useFocusEffect(
        useCallback(() => {
            schedulePracticeRefresh();
        }, [practiceId, rangeDays, viewMode])
    );

    function schedulePracticeRefresh() {
        if (practiceRefreshTimeoutRef.current) {
            clearTimeout(practiceRefreshTimeoutRef.current);
        }

        practiceRefreshTimeoutRef.current = setTimeout(() => {
            practiceRefreshTimeoutRef.current = null;
            loadPracticeData();
            loadDailyData(rangeDays);
        }, 0);
    }

    function loadSessions(overrideTargetCount?: number) {
        const rows = sessionService.getSessionsForPractice(practiceId) as Session[];
        setSessions(rows);

        const totalResult = sessionService.getPracticeTotal(practiceId);
        const nextTotal = totalResult.total;

        setTotal(nextTotal);

        const effectiveTargetCount = overrideTargetCount ?? targetCount;

        void updateReachedState([
            {
                id: practiceId,
                total: nextTotal,
                targetCount: effectiveTargetCount,
            }
        ]);
    }

    function addSession(count: number) {
        sessionService.addSession(practiceId, count);
    }

    function loadPracticeData() {
        const practice = practiceService.getPractice(practiceId);

        if (practice) {
            setPracticeName(practice.name);
            setImageKey(practice.imageKey ?? null);
            setDefaultAddCount(String(practice.defaultAddCount ?? 108));
            setTargetCount(practice.targetCount);
            loadSessions(practice.targetCount);
        }
    }

    function confirmDelete() {
        closeMenu();

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
        const padding = total >= 1000000 ? { top: 30, bottom: 30, left: 50, right: 10 } : total >= 100000 ? { top: 30, bottom: 30, left: 40, right: 10 } : { top: 30, bottom: 30, left: 30, right: 10 };
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

    function openEditPractice() {
        setMenuOpen(false);

        router.push({
            pathname: "/edit-practice",
            params: {
                id: practiceId,
                practiceName
            }
        });
    }

    function toggleMenu() {
        if (menuOpen) {
            closeMenu();
            return;
        }

        const target = titleRowRef.current;
        if (!target) return;

        (target as any).measureInWindow((x: number, y: number, width: number, height: number) => {
            setMenuAnchor({ x, y, width, height });
            setMenuOpen(true);

            Animated.timing(rotateAnim, {
                toValue: 1,
                duration: 180,
                useNativeDriver: true,
            }).start();
        });
    }

    function closeMenu() {
        setMenuOpen(false);

        Animated.timing(rotateAnim, {
            toValue: 0,
            duration: 180,
            useNativeDriver: true,
        }).start();
    }

    const chevronRotation = rotateAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ["0deg", "180deg"],
    });

    function renderCelebrationOverlay() {
        const sparkleStyle = (value: Animated.Value, translateX: number, translateY: number) => ({
            opacity: value.interpolate({
                inputRange: [0, 0.2, 0.8, 1],
                outputRange: [0, 1, 1, 0],
            }),
            transform: [
                { translateX },
                {
                    translateY: value.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, translateY],
                    }),
                },
                {
                    scale: value.interpolate({
                        inputRange: [0, 0.5, 1],
                        outputRange: [0.6, 1.1, 0.8],
                    }),
                },
            ],
        });

        return (
            <Animated.View
                pointerEvents="none"
                style={[
                    styles.totalCelebrationOverlay,
                    { opacity: celebrationFade }
                ]}
            >
                <Animated.Text style={[styles.sparkle, sparkleStyle(sparkle1, 6, -14)]}>✦</Animated.Text>
                <Animated.Text style={[styles.sparkle, sparkleStyle(sparkle2, 42, -28)]}>✦</Animated.Text>
                <Animated.Text style={[styles.sparkle, sparkleStyle(sparkle3, 78, -18)]}>✦</Animated.Text>
            </Animated.View>
        );
    }

    return (

        <ScrollView
            style={{ marginTop: 24 }}
            contentContainerStyle={{
                paddingBottom: 40,
                alignItems: "stretch"
            }}
            keyboardShouldPersistTaps="handled"
        >
            <Pressable onPress={menuOpen ? closeMenu : undefined}>

                <View style={styles.titleMenuWrapper}>
                    <Pressable
                        ref={titleRowRef}
                        style={styles.titleRow}
                        onPress={toggleMenu}
                    >
                        <Text style={styles.title}>
                            {practiceName}
                        </Text>

                        <Animated.View style={{ transform: [{ rotate: chevronRotation }] }}>
                            <MaterialIcons name="keyboard-arrow-down" size={28} color="#333" />
                        </Animated.View>
                    </Pressable>
                </View>
            </Pressable>
            {imageKey && practiceImages[imageKey] && (
                <View style={styles.imageWrapper}>
                    <Image
                        source={practiceImages[imageKey]}
                        style={{
                            width: width,
                            alignSelf: "center",
                            marginBottom: 15
                        }}
                        resizeMode="contain"
                    />
                </View>
            )}

            <View style={styles.contentBlock}>

                <View style={styles.totalRow}>
                    <View style={styles.totalWrapper}>
                        <Text style={styles.total}>
                            {total + ' ' + (!!targetCount ? '/ ' + targetCount : '')}
                        </Text>
                        {isCelebrating(practiceId) && renderCelebrationOverlay()}
                    </View>

                    {isCelebrating(practiceId) && (
                        <Animated.Text
                            style={[
                                styles.congratsText,
                                { opacity: celebrationFade }
                            ]}
                        >
                            Target reached, congratulations!!
                        </Animated.Text>
                    )}
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
                        placeholderTextColor="#999"
                    />

                    <Button
                        title="Add custom"
                        onPress={() => addSession(Number(customValue))}
                    />

                </View>

                <Text style={styles.total}>
                    Practice History
                </Text>
                <View style={{ flexDirection: "row", gap: 10, zIndex: 100 }}>
                    <View style={{ flexDirection: "row", gap: 10, marginBottom: 20, marginTop: 5 }}>

                        <Button
                            title="Chart"
                            onPress={() => setViewMode("chart")}
                        />

                        <Button
                            title="Table"
                            onPress={() => setViewMode("table")}
                        />

                    </View>
                    <View style={{ position: "relative", width: "100%" }}>
                        {showTableTooltip && (
                            <View style={styles.tableTooltip}>
                                <Text style={styles.tableTooltipText}>
                                    Tip: You can edit any day’s total by tapping on its count.
                                </Text>
                            </View>
                        )}
                    </View>

                </View>


                <View style={{ flexDirection: "row", gap: 10, marginBottom: 20 }}>
                    <Button title="10d" onPress={() => { setRangeDays(10); }} />
                    <Button title="30d" onPress={() => { setRangeDays(30); }} />
                    <Button title="90d" onPress={() => { setRangeDays(90); }} />
                </View>

                <View key={dailyData.length}>
                    {viewMode === "chart"
                        ? renderChart()
                        : renderTable()
                    }
                </View>
            </View>

            <Modal
                visible={menuOpen}
                transparent
                animationType="fade"
                onRequestClose={closeMenu}
            >
                <Pressable style={styles.menuOverlay} onPress={closeMenu}>
                    {menuAnchor && (
                        <View
                            style={[
                                styles.dropdownMenuModal,
                                {
                                    top: menuAnchor.y + menuAnchor.height + 8,
                                    left: Math.max(20, menuAnchor.x + menuAnchor.width / 2 - 110),
                                }
                            ]}
                        >
                            <Pressable
                                style={styles.dropdownItem}
                                onPress={openEditPractice}
                            >
                                <MaterialIcons name="edit" size={18} color="#333" />
                                <Text style={styles.dropdownText}>Edit practice</Text>
                            </Pressable>

                            <Pressable
                                style={styles.dropdownItem}
                                onPress={confirmDelete}
                            >
                                <MaterialIcons name="delete-outline" size={18} color="#c62828" />
                                <Text style={styles.dropdownDeleteText}>Delete practice</Text>
                            </Pressable>
                        </View>
                    )}
                </Pressable>
            </Modal>
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
    },

    total: {
        fontSize: 18,
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
        marginBottom: 10,
        color: "black"
    },

    editableCell: {
        borderBottomWidth: 1,
        borderColor: "#aaa",
        minWidth: 60,
        textAlign: "right",
        paddingVertical: 2,
        color: "black"
    },

    titleMenuWrapper: {
        paddingHorizontal: 20,
    },

    titleRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 4,
        alignSelf: "center",
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 999,
        backgroundColor: "#f3f4f6",
    },

    menuOverlay: {
        flex: 1,
    },

    dropdownMenuModal: {
        position: "absolute",
        width: 220,
        backgroundColor: "white",
        borderRadius: 10,
        paddingVertical: 6,
        shadowColor: "#000",
        shadowOpacity: 0.12,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 3 },
        elevation: 8,
    },

    dropdownItem: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        paddingVertical: 12,
        paddingHorizontal: 14,
    },

    dropdownText: {
        fontSize: 15,
        color: "#333",
    },

    dropdownDeleteText: {
        fontSize: 15,
        color: "#c62828",
    },

    imageWrapper: {
        zIndex: 1,
        elevation: 1,
    },

    contentBlock: {
        paddingHorizontal: 20,
        zIndex: 1,
        elevation: 1,
    },

    tableTooltip: {
        alignSelf: "flex-start",
        backgroundColor: "#111",
        paddingVertical: 10,
        paddingHorizontal: 14,
        borderRadius: 8,
        marginBottom: 16,
        maxWidth: 280,
        position: "absolute",
        width: 180
    },

    tableTooltipText: {
        color: "white",
        fontSize: 13,
    },

    totalRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        marginBottom: 20,
        flexWrap: "wrap",
    },

    totalWrapper: {
        position: "relative",
        alignSelf: "flex-start",
    },

    totalCelebrationOverlay: {
        position: "absolute",
        top: -4,
        left: 0,
        right: -10,
        bottom: -4,
        pointerEvents: "none",
    },

    sparkle: {
        position: "absolute",
        fontSize: 16,
        color: "#a78bfa",
        fontWeight: "700",
    },

    congratsText: {
        fontSize: 12,
        color: "#7c3aed",
        fontWeight: "700",
    },

});