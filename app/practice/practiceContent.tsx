import { MaterialIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Animated, Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from "react-native";
import CelebrationOverlay from "../../components/CelebrationOverlay";
import FloatingAddAnimation, { FloatingAddAnimationRef } from "../../components/FloatingAddAnimation";
import PracticeCalendar from "../../components/PracticeCalendar";
import PracticeHistoryModal from "../../components/PracticeHistoryModal";
import QuickAddEditor from "../../components/QuickAddEditor";
import TargetDateEditor from "../../components/TargetDateEditor";
import { practiceImages } from "../../constants/practiceImages";
import { useReachedCelebration } from "../../hooks/useReachedCelebration";
import * as appService from "../../services/appService";
import * as practiceService from "../../services/practiceService";
import * as sessionService from "../../services/sessionService";
import { colors, containers } from "../../styles/theme";
import { subscribeData } from "../../utils/events";
import {
    digitsOnly,
    formatNumber,
    MAX_REPETITIONS_PER_DAY,
    validateNonNegativeInteger
} from "../../utils/numberUtils";

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

    const [infoOpen, setInfoOpen] = useState(false);
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
        if (targetCount > 0 && total >= targetCount) {
            return "Reached!";
        }

        if (!targetDate) return "No estimate";

        return targetDate.toLocaleDateString("en-US", {
            month: "long",
            day: "2-digit",
            year: "numeric"
        });
    }, [targetDate, total, targetCount]);
    const [customAmount, setCustomAmount] = useState("");

    const dailyAnimRef = useRef<FloatingAddAnimationRef>(null);
    const customAnimRef = useRef<FloatingAddAnimationRef>(null);
    const [calendarOpen, setCalendarOpen] = useState(false);
    const [historyOpen, setHistoryOpen] = useState(false);

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

    function openPracticeHistory() {
        closeMenu();
        setHistoryOpen(true);
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

    async function deletePractice() {
        await practiceService.deletePractice(practiceId);
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

        try {
            sessionService.adjustDayTotal(
                practiceId,
                date,
                newValue
            );
        } catch (error: any) {
            alert(error.message);
        }
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

        (target as any).measure((x: number, y: number, width: number, height: number, pageX: number, pageY: number) => {
            setMenuAnchor({ x: pageX, y: pageY, width, height });
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

    const calendarStartDate = useMemo(
        () => appService.getCalendarStartDate(),
        []
    );

    return (
        <View style={{ flex: 1 }}>
            <ScrollView>
                <View style={containers.screen}>
                    <View >
                        <View>
                            <Pressable onPress={menuOpen ? closeMenu : undefined}>
                                <View>
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

                            <Pressable
                                onPress={() => setInfoOpen(true)}
                                style={styles.infoIcon}
                            >
                                <MaterialIcons
                                    name="info-outline"
                                    size={20}
                                    color="#666"
                                />
                            </Pressable>
                        </View>


                        <View style={styles.contentBlock}>

                            {imageSource && (
                                <View style={styles.imageWrapper}>
                                    <Image
                                        source={imageSource}
                                        style={{
                                            // width: "100%",
                                            // height: "100%",
                                            height: Math.min(width - 20, 500),
                                            aspectRatio: imageRatio,
                                            alignSelf: "center"
                                        }}
                                        resizeMode="contain"
                                    />
                                </View>
                            )}


                            <View style={{ flexDirection: "row", justifyContent: "space-around" }}>
                                <View style={styles.indicatorRow}>
                                    <Text style={{ fontWeight: "bold" }}>
                                        Progress
                                    </Text>
                                    <View style={styles.totalWrapper}>
                                        <Text style={styles.total}>
                                            {formatNumber(total) + ' ' + (!!targetCount ? '/ ' + formatNumber(targetCount) : '')}
                                        </Text>
                                    </View>

                                </View>

                                <Pressable
                                    style={styles.indicatorRow}
                                    onPress={() => setTargetEditOpen(true)}
                                >
                                    <Text style={{ fontWeight: "bold" }}>
                                        Target Date
                                    </Text>
                                    <View style={styles.targetDateRow}>

                                        <View style={styles.targetDateEditable}>
                                            <Text style={styles.targetDateText}>
                                                {formattedTargetDate}
                                            </Text>
                                        </View>

                                        {isCelebrating(practiceId) && (
                                            <>
                                                <CelebrationOverlay
                                                    fade={celebrationFade}
                                                    sparkle1={sparkle1}
                                                    sparkle2={sparkle2}
                                                    sparkle3={sparkle3}
                                                />
                                            </>
                                        )}

                                    </View>
                                </Pressable>
                            </View>

                            <View style={styles.addRow}>
                                <View style={styles.addColumn}>
                                    <View style={styles.headerArea}>
                                        <Text style={styles.sectionTitle}>
                                            Add daily target
                                        </Text>
                                    </View>

                                    <View style={styles.quickAddRow}>

                                        <Pressable
                                            style={styles.quickAddButton}
                                            onPress={() => {
                                                try {
                                                    sessionService.addSession(
                                                        practiceId,
                                                        Number(defaultAddCount)
                                                    );
                                                    dailyAnimRef.current?.trigger(
                                                        `+${formatNumber(defaultAddCount)}\nadded!`
                                                    );
                                                } catch (error: any) {
                                                    alert(error.message);
                                                }
                                            }}
                                            onLongPress={() => setQuickAddOpen(true)}
                                        >
                                            <Text style={styles.quickAddButtonText}>
                                                +{formatNumber(defaultAddCount)}
                                            </Text>
                                            <FloatingAddAnimation ref={dailyAnimRef} />
                                        </Pressable>

                                    </View>
                                </View>
                                <Text style={styles.orText}>
                                    OR
                                </Text>
                                <View style={styles.addColumn}>
                                    <View style={styles.headerArea}>
                                        <View style={styles.customHeader}>
                                            <Text style={styles.sectionTitle}>Add </Text>
                                            <TextInput
                                                value={customAmount}
                                                onChangeText={(text) => {
                                                    setCustomAmount(digitsOnly(text));
                                                }}
                                                keyboardType="numeric"
                                                placeholder="custom"
                                                placeholderTextColor="#999"
                                                style={styles.customInput}
                                            />
                                            <Text style={styles.sectionTitle}> amount</Text>
                                        </View>
                                    </View>

                                    <Pressable
                                        style={[
                                            styles.quickAddButton,
                                            !customAmount && { opacity: 0.4 }
                                        ]}
                                        onPress={() => {

                                            const error =
                                                validateNonNegativeInteger(
                                                    customAmount,
                                                    "Custom amount"
                                                );

                                            if (error) {
                                                alert(error);
                                                return;
                                            }

                                            const value = Number(customAmount);

                                            if (value > MAX_REPETITIONS_PER_DAY) {
                                                alert(
                                                    `Custom amount cannot exceed ${MAX_REPETITIONS_PER_DAY.toLocaleString()}`
                                                );
                                                return;
                                            }

                                            try {
                                                sessionService.addSession(
                                                    practiceId,
                                                    value
                                                );
                                                customAnimRef.current?.trigger(
                                                    `+${formatNumber(value)}\nadded!`
                                                );
                                            } catch (error: any) {
                                                alert(error.message);
                                            }
                                        }}
                                    >
                                        <Text style={styles.quickAddButtonText}>
                                            {customAmount ? `+${formatNumber(customAmount)}` : "+"}
                                        </Text>
                                        <FloatingAddAnimation ref={customAnimRef} />
                                    </Pressable>

                                </View>

                            </View>

                        </View>

                        <Modal
                            visible={calendarOpen}
                            transparent
                            animationType="slide"
                            statusBarTranslucent
                            onRequestClose={() => setCalendarOpen(false)}
                        >
                            <Pressable style={styles.calendarOverlay} onPress={() => setCalendarOpen(false)}>

                                <View style={styles.calendarSheet}>

                                    <View style={styles.sheetHandle} />

                                    <View style={styles.calendarHeader}>
                                        <Pressable onPress={() => setCalendarOpen(false)}>
                                            <Text style={styles.calendarClose}>
                                                Close
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

                            </Pressable>
                        </Modal>

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
                                            onPress={openPracticeHistory}
                                        >
                                            <MaterialIcons
                                                name="show-chart"
                                                size={18}
                                                color="#333"
                                            />
                                            <Text style={styles.dropdownText}>
                                                Practice history
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

                    <Modal
                        visible={infoOpen}
                        transparent
                        animationType="fade"
                        onRequestClose={() => setInfoOpen(false)}
                    >
                        <Pressable
                            style={styles.infoOverlay}
                            onPress={() => setInfoOpen(false)}
                        >
                            <Pressable
                                style={styles.infoModal}
                                onPress={() => { }}
                            >
                                <Text style={styles.infoTitle}>
                                    Adjusting Practice Data
                                </Text>

                                <Text style={styles.infoText}>
                                    You can edit the daily repetition count by long pressing its corresponding button. You can also edit the target date by tapping it.
                                </Text>

                                <Text style={styles.infoText}>
                                    Changing one will automatically adjust the other,
                                    and the calendar below will update accordingly.
                                </Text>

                                <Text style={styles.infoText}>
                                    You can also modify any daily count in the calendar
                                    for today or any past day.
                                </Text>

                                <Pressable
                                    style={styles.infoButton}
                                    onPress={() => setInfoOpen(false)}
                                >
                                    <Text style={styles.infoButtonText}>
                                        OK
                                    </Text>
                                </Pressable>

                            </Pressable>
                        </Pressable>
                    </Modal>

                    <PracticeHistoryModal
                        visible={historyOpen}
                        onClose={() => setHistoryOpen(false)}
                        practiceId={practiceId}
                        total={total}
                    />
                </View>
            </ScrollView>

            <Pressable
                style={styles.calendarButtonFixed}
                onPress={() => setCalendarOpen(true)}
            >
                <Text style={styles.calendarButtonText}>
                    Practice Calendar
                </Text>
            </Pressable>

        </View>
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
        fontSize: 13,
        color: "#666",
        marginTop: 12,
        marginBottom: 6
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

    titleRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 4,
        alignSelf: "center",
        paddingHorizontal: 10,
        borderRadius: 999,
        paddingBottom: 4,
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
        marginBottom: 10,
        alignItems: "center",
        width: "100%"
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

    indicatorRow: {
        alignItems: "center",
        gap: 3,
        flexWrap: "wrap",
        justifyContent: "space-between"
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
        marginTop: 2,
        marginBottom: 10,
        flexWrap: "wrap"
    },

    quickAddLabel: {
        fontSize: 14,
        color: "#666",
        marginRight: 8
    },

    quickAddButton: {
        width: 90,
        height: 90,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#eef2ff",
        borderRadius: 100,
        borderWidth: 2,
        borderColor: colors.primary,
    },

    quickAddButtonText: {
        fontSize: 16,
        fontWeight: "600",
        color: "#111"
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

    targetDateRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        position: "relative",
        flexWrap: "wrap"
    },

    infoIcon: {
        position: "absolute",
        right: 0,
        bottom: 0,
        top: 0,
        margin: "auto"
    },

    infoOverlay: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.35)",
        justifyContent: "center",
        alignItems: "center",
        padding: 20
    },

    infoModal: {
        width: "100%",
        maxWidth: 420,
        backgroundColor: "white",
        borderRadius: 12,
        padding: 20
    },

    infoTitle: {
        fontSize: 18,
        fontWeight: "bold",
        marginBottom: 12
    },

    infoText: {
        fontSize: 14,
        color: "#333",
        marginBottom: 10,
        lineHeight: 20
    },

    infoButton: {
        marginTop: 10,
        alignSelf: "flex-end",
        paddingVertical: 8,
        paddingHorizontal: 16
    },

    infoButtonText: {
        fontSize: 15,
        fontWeight: "600",
        color: "#2563eb"
    },

    customRow: {
        flexDirection: "row",
        alignItems: "center",
        marginTop: 8,
        marginBottom: 8,
        flexWrap: "wrap"
    },

    customLabel: {
        fontSize: 14,
        color: "#666",
        marginRight: 8
    },

    customInput: {
        borderWidth: 1,
        borderColor: "#ddd",
        borderRadius: 8,
        paddingHorizontal: 7,
        paddingVertical: 4,
        width: 65,
        textAlign: "center",
        color: "black",
        alignSelf: "center"
    },

    customButton: {
        backgroundColor: "#e5e7eb",
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 8
    },

    customButtonText: {
        fontSize: 14,
        fontWeight: "600"
    },

    addRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "flex-start",
        marginTop: 8
    },

    addColumn: {
        alignItems: "center",
        width: 120
    },

    orText: {
        alignSelf: "center",
        marginTop: 24,
        color: "#666"
    },
    customHeader: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center"
    },
    headerArea: {
        height: 60,
        justifyContent: "center",
        alignItems: "center"
    },
    addFloating: {
        position: "absolute",
        fontSize: 14,
        fontWeight: "600",
        color: "#8B1E3F"
    },

    calendarButton: {
        marginTop: 24,
        paddingVertical: 14,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: "#e5e7eb",
        alignItems: "center",
        backgroundColor: "#f9fafb"
    },

    calendarButtonText: {
        fontSize: 15,
        fontWeight: "600",
        color: "white"
    },

    calendarModalContainer: {
        flex: 1,
        backgroundColor: "white",
        paddingTop: 40
    },

    calendarHeader: {
        paddingHorizontal: 20,
        paddingBottom: 10,
        borderBottomWidth: 1,
        borderColor: "#eee"
    },

    calendarClose: {
        fontSize: 16,
        fontWeight: "600",
        color: colors.primary
    },
    calendarButtonFixed: {
        position: "absolute",
        bottom: 20,
        left: 20,
        right: 20,
        paddingVertical: 14,
        borderRadius: 12,
        backgroundColor: colors.primary,
        borderWidth: 1,
        borderColor: colors.primary,
        alignItems: "center",
        shadowColor: "#000",
        shadowOpacity: 0.08,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 2 },
        elevation: 4,
    },

    calendarOverlay: {
        flex: 1,
        justifyContent: "flex-end",
        backgroundColor: "rgba(0,0,0,0.15)"
    },

    calendarSheet: {
        height: "50%",
        backgroundColor: "white",
        borderTopLeftRadius: 18,
        borderTopRightRadius: 18,
        paddingTop: 6,
        shadowColor: "#000",
        shadowOpacity: 0.1,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: -3 },
        elevation: 8
    },
    sheetHandle: {
        width: 40,
        height: 4,
        backgroundColor: "#ddd",
        alignSelf: "center",
        borderRadius: 2,
        marginTop: 6,
        marginBottom: 8
    },
});