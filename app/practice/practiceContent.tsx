import { MaterialIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Animated, Image, Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import PracticeCalendar from "../../components/PracticeCalendar";
import QuickAddEditor from "../../components/QuickAddEditor";
import TargetDateEditor from "../../components/TargetDateEditor";
import { practiceImages } from "../../constants/practiceImages";
import { useReachedCelebration } from "../../hooks/useReachedCelebration";
import * as appService from "../../services/appService";
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
    const [quickAddOpen, setQuickAddOpen] = useState(false);
    const [targetEditOpen, setTargetEditOpen] = useState(false);
    const initialPractice = practiceService.getPractice(practiceId);

    const [practiceName, setPracticeName] = useState(initialPractice?.name ?? "");
    const [sessions, setSessions] = useState<Session[]>(() =>
        sessionService.getSessionsForPractice(practiceId) as Session[]
    );
    const [total, setTotal] = useState(() =>
        sessionService.getPracticeTotal(practiceId).total
    );
    const [imageKey, setImageKey] = useState<string | null>(initialPractice?.imageKey ?? null);
    const [defaultAddCount, setDefaultAddCount] = useState(
        String(initialPractice?.defaultAddCount ?? 108)
    );
    const [targetCount, setTargetCount] = useState(initialPractice?.targetCount ?? 0);
    const [calendarData, setCalendarData] = useState<
        { date: string; count: number }[]
    >(() => sessionService.getCalendarDailyData(practiceId));

    const [viewMode, setViewMode] = useState<"chart" | "table">("chart");
    const [rangeDays, setRangeDays] = useState(10);
    const [dailyData, setDailyData] = useState<
        { date: string; total: number }[]
    >([]);
    const { width } = useWindowDimensions();
    const imageSource =
        imageKey && practiceImages[imageKey]
            ? practiceImages[imageKey]
            : null;

    const imageRatio = useMemo(() => {
        if (!imageSource) return 1;

        const source = Image.resolveAssetSource(imageSource);

        if (source?.width && source?.height) {
            return source.width / source.height;
        }

        return 1;
    }, [imageSource]);
    const [menuOpen, setMenuOpen] = useState(false);
    const rotateAnim = useRef(new Animated.Value(0)).current;
    const titleRowRef = useRef<View | null>(null);
    const [menuAnchor, setMenuAnchor] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
    const [showTableTooltip, setShowTableTooltip] = useState(false);
    const {
        celebrationFade,
        sparkle1,
        sparkle2,
        sparkle3,
        updateReachedState,
        isCelebrating,
    } = useReachedCelebration();

    const calendarEndDate = useMemo(() => {
        return (
            practiceService.getExpectedTargetDate(
                targetCount,
                total,
                Number(defaultAddCount)
            ) ?? new Date()
        );
    }, [targetCount, total, defaultAddCount]);

    const targetDate = useMemo(() => {
        return practiceService.getExpectedTargetDate(
            targetCount,
            total,
            Number(defaultAddCount)
        );
    }, [targetCount, total, defaultAddCount]);

    const formattedTargetDate = useMemo(() => {
        if (!targetDate) return "No estimate";

        return targetDate.toLocaleDateString("en-US", {
            month: "long",
            day: "2-digit",
            year: "numeric"
        });
    }, [targetDate]);

    useEffect(() => {
        schedulePracticeRefresh();
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

    function loadCalendarData() {
        const data = sessionService.getCalendarDailyData(practiceId);
        setCalendarData(data);
    }

    function schedulePracticeRefresh() {
        loadPracticeData();
        loadDailyData(rangeDays);
        loadCalendarData();
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

    const handleEdit = useCallback((date: string, newValue: number) => {
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
    }, [practiceId]);


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

    const calendarStartDate = useMemo(
        () => appService.getCalendarStartDate(),
        []
    );

    return (
        <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>

            <View style={{ marginTop: 24 }}>

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

                            <Animated.View
                                style={{ transform: [{ rotate: chevronRotation }] }}
                            >
                                <MaterialIcons
                                    name="keyboard-arrow-down"
                                    size={28}
                                    color="#333"
                                />
                            </Animated.View>

                        </Pressable>
                    </View>
                </Pressable>

                {imageSource && (
                    <View style={styles.imageWrapper}>
                        <Image
                            source={imageSource}
                            style={{
                                width: width,
                                aspectRatio: imageRatio,
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

                    <Pressable
                        onPress={() => setTargetEditOpen(true)}
                        style={styles.targetDateEditable}
                    >
                        <Text style={styles.targetDateText}>
                            Target date: {formattedTargetDate}
                        </Text>
                    </Pressable>

                    <View style={styles.quickAddRow}>

                        <Text style={styles.quickAddLabel}>
                            Quick Add:
                        </Text>

                        <Pressable
                            style={styles.quickAddButton}
                            onPress={() =>
                                sessionService.addSession(
                                    practiceId,
                                    Number(defaultAddCount)
                                )
                            }
                            onLongPress={() => setQuickAddOpen(true)}
                        >
                            <Text style={styles.quickAddButtonText}>
                                +{defaultAddCount}
                            </Text>
                        </Pressable>

                    </View>

                    <PracticeCalendar
                        data={calendarData}
                        startDate={calendarStartDate}
                        endDate={calendarEndDate}
                        onEditDay={handleEdit}
                    />

                </View>

                <Modal
                    visible={menuOpen}
                    transparent
                    animationType="fade"
                    onRequestClose={closeMenu}
                >
                    <Pressable
                        style={styles.menuOverlay}
                        onPress={closeMenu}
                    >
                        {menuAnchor && (
                            <View
                                style={[
                                    styles.dropdownMenuModal,
                                    {
                                        top: menuAnchor.y + menuAnchor.height + 8,
                                        left: Math.max(
                                            20,
                                            menuAnchor.x + menuAnchor.width / 2 - 110
                                        ),
                                    }
                                ]}
                            >

                                <Pressable
                                    style={styles.dropdownItem}
                                    onPress={openEditPractice}
                                >
                                    <MaterialIcons
                                        name="edit"
                                        size={18}
                                        color="#333"
                                    />
                                    <Text style={styles.dropdownText}>
                                        Edit practice
                                    </Text>
                                </Pressable>

                                <Pressable
                                    style={styles.dropdownItem}
                                    onPress={confirmDelete}
                                >
                                    <MaterialIcons
                                        name="delete-outline"
                                        size={18}
                                        color="#c62828"
                                    />
                                    <Text style={styles.dropdownDeleteText}>
                                        Delete practice
                                    </Text>
                                </Pressable>

                            </View>
                        )}
                    </Pressable>
                </Modal>

            </View>

            <QuickAddEditor
                visible={quickAddOpen}
                practiceId={practiceId}
                practiceName={practiceName}
                defaultValue={Number(defaultAddCount)}
                onClose={() => setQuickAddOpen(false)}
            />

            <TargetDateEditor
                visible={targetEditOpen}
                targetCount={targetCount}
                total={total}
                currentTargetDate={targetDate}
                onClose={() => setTargetEditOpen(false)}
                onSave={(newDaily) => {
                    practiceService.updatePracticeDefaultAddCount(
                        practiceId,
                        newDaily
                    );
                }}
            />
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
        fontSize: 15,
        color: "#666"
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
        paddingBottom: 30
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
        marginBottom: 6,
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

    targetRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginTop: 8,
        marginBottom: 4
    },

    targetDateText: {
        fontSize: 14,
        color: "#666"
    },

    quickAddRow: {
        flexDirection: "row",
        alignItems: "center",
        marginTop: 6,
        marginBottom: 6
    },

    quickAddLabel: {
        fontSize: 14,
        color: "#666",
        marginRight: 8
    },

    quickAddButton: {
        paddingVertical: 4,
        paddingHorizontal: 10,
        backgroundColor: "#e5e7eb",
        borderRadius: 8
    },

    quickAddButtonText: {
        fontSize: 14,
        fontWeight: "600"
    },

    quickAddInput: {
        marginTop: 4,
        borderWidth: 1,
        borderColor: "#ddd",
        padding: 6,
        borderRadius: 6,
        width: 80
    },

    targetDateEditable: {
        borderBottomWidth: 1,
        borderBottomColor: "#cbd5e1",
        paddingBottom: 2,
        alignSelf: "flex-start"
    },
});