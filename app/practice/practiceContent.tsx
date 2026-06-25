import { MaterialIcons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, Dimensions, Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import CelebrationOverlay from "../../components/CelebrationOverlay";
import DailyGoalProgress from "../../components/DailyGoalProgress";
import FloatingAddAnimation, { FloatingAddAnimationRef } from "../../components/FloatingAddAnimation";
import PracticeActionsMenu, {
    type PracticeMenuAnchor,
} from "../../components/PracticeActionsMenu";
import PracticeCalendar from "../../components/PracticeCalendar";
import PracticeReminderEditor from "../../components/PracticeReminderEditor";
import QuickAddEditor from "../../components/QuickAddEditor";
import TargetDateEditor from "../../components/TargetDateEditor";
import { practiceImages } from "../../constants/practiceImages";
import { useReachedCelebration } from "../../hooks/useReachedCelebration";
import * as appService from "../../services/appService";
import type { PracticeReminderSettings } from "../../services/practiceReminderService";
import * as practiceReminderService from "../../services/practiceReminderService";
import * as practiceService from "../../services/practiceService";
import * as sessionService from "../../services/sessionService";
import { colors, containers } from "../../styles/theme";
import { subscribeData } from "../../utils/events";
import { digitsOnly, formatCountProgress, formatNumber, MAX_REPETITIONS_PER_DAY, validateNonNegativeInteger } from "../../utils/numberUtils";

export default function PracticeContent({
    practiceId,
    openCalendarInitially = false,
}: {
    practiceId: string;
    openCalendarInitially?: boolean;
}) {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const [quickAddOpen, setQuickAddOpen] = useState(false);
    const [targetEditOpen, setTargetEditOpen] = useState(false);
    const [reminderOpen, setReminderOpen] = useState(false);
    const [reminderSettings, setReminderSettings] =
        useState<PracticeReminderSettings | null>(null);
    const initialPractice = practiceService.getPractice(practiceId);

    const [practiceName, setPracticeName] = useState(initialPractice?.name ?? "");
    const [total, setTotal] = useState(() =>
        sessionService.getPracticeTotal(practiceId).total
    );
    const [imageKey, setImageKey] = useState<string | null>(initialPractice?.imageKey ?? null);
    const [dailyTargetCount, setDailyTargetCount] = useState(
        initialPractice?.dailyTargetCount == null
            ? ""
            : String(initialPractice.dailyTargetCount)
    );
    const [defaultSessionCount, setDefaultSessionCount] = useState(
        String(initialPractice?.defaultSessionCount ?? 108)
    );
    const [targetCount, setTargetCount] = useState(initialPractice?.targetCount ?? 0);
    const [calendarData, setCalendarData] = useState<
        { date: string; count: number }[]
    >(() => sessionService.getCalendarDailyData(practiceId));

    const { width } = useWindowDimensions();
    const imageSource =
        imageKey && practiceImages[imageKey]
            ? practiceImages[imageKey]
            : practiceImages["generic"];

    const imageRatio = useMemo(() => {
        if (!imageSource) return 1;

        const source = Image.resolveAssetSource(imageSource);

        if (source?.width && source?.height) {
            return source.width / source.height;
        }

        return 1;
    }, [imageSource]);
    const imageDisplayHeight = Math.min(width - 20, 500);
    const imageDisplayWidth = imageDisplayHeight * imageRatio;
    const [menuOpen, setMenuOpen] = useState(false);
    const rotateAnim = useRef(new Animated.Value(0)).current;
    const titleRowRef = useRef<View | null>(null);
    const [menuAnchor, setMenuAnchor] = useState<PracticeMenuAnchor | null>(null);
    const {
        celebrationFade,
        sparkle1,
        sparkle2,
        sparkle3,
        updateReachedState,
        isCelebrating,
    } = useReachedCelebration();

    const [infoOpen, setInfoOpen] = useState(false);
    const effectiveDailyTargetCount =
        dailyTargetCount.trim()
            ? Number(dailyTargetCount)
            : null;
    const hasDailyTarget =
        effectiveDailyTargetCount != null &&
        effectiveDailyTargetCount > 0;
    const todayDate = formatDateKey(new Date());
    const todayCount = useMemo(() => {
        return calendarData.find(day => day.date === todayDate)?.count ?? 0;
    }, [calendarData, todayDate]);
    const reminderEnabled = reminderSettings?.enabled === true;
    const reminderHour = reminderSettings?.hour ?? 20;
    const reminderMinute = reminderSettings?.minute ?? 0;
    const reminderSummary = reminderEnabled
        ? `Reminder: ${practiceReminderService.formatReminderTime(
            reminderHour,
            reminderMinute
        )} if unfinished`
        : "Reminder: Off";
    const calendarEndDate = useMemo(() => {
        return (
            practiceService.getExpectedTargetDate(
                targetCount,
                total,
                effectiveDailyTargetCount
            ) ?? new Date()
        );
    }, [targetCount, total, effectiveDailyTargetCount]);

    const targetDate = useMemo(() => {
        return practiceService.getExpectedTargetDate(
            targetCount,
            total,
            effectiveDailyTargetCount
        );
    }, [targetCount, total, effectiveDailyTargetCount]);

    const formattedTargetDate = useMemo(() => {
        if (targetCount > 0 && total >= targetCount) {
            return "Reached!";
        }

        if (!effectiveDailyTargetCount) return "Set daily target 1st";
        if (!targetDate) return "No estimate";

        return targetDate.toLocaleDateString("en-US", {
            month: "long",
            day: "2-digit",
            year: "numeric"
        });
    }, [effectiveDailyTargetCount, targetDate, total, targetCount]);
    const [customAmount, setCustomAmount] = useState("");
    const [customAmountOpen, setCustomAmountOpen] = useState(false);
    const dailyAnimRef = useRef<FloatingAddAnimationRef>(null);
    const customAnimRef = useRef<FloatingAddAnimationRef>(null);
    const [calendarOpen, setCalendarOpen] = useState(openCalendarInitially);
    const [calendarInfoOpen, setCalendarInfoOpen] = useState(false);
    const [dateAdjustedInfo, setDateAdjustedInfo] = useState<{
        selected: Date;
        actual: Date;
    } | null>(null);
    const scrollBottomPadding = Math.max(30, insets.bottom + 24);

    useEffect(() => {
        schedulePracticeRefresh();
    }, [practiceId]);

    useEffect(() => {
        let active = true;

        void practiceReminderService
            .getPracticeReminderSettings(practiceId)
            .then(settings => {
                if (active) {
                    setReminderSettings(settings);
                }
            });

        return () => {
            active = false;
        };
    }, [practiceId]);

    useEffect(() => {
        if (!reminderSettings?.enabled) return;

        void practiceReminderService
            .refreshPracticeReminderSchedule({
                practiceId,
                practiceName,
                todayCount,
                dailyTargetCount: effectiveDailyTargetCount,
            })
            .then(setReminderSettings)
            .catch(error => {
                console.warn("Failed to refresh practice reminder", error);
            });
    }, [
        practiceId,
        practiceName,
        todayCount,
        effectiveDailyTargetCount,
        reminderSettings?.enabled,
    ]);

    useEffect(() => {
        const unsubscribe = subscribeData(() => {
            schedulePracticeRefresh();
        });

        return unsubscribe;
    }, [practiceId]);

    useFocusEffect(
        useCallback(() => {
            schedulePracticeRefresh();
        }, [practiceId])
    );

    function loadCalendarData() {
        const data = sessionService.getCalendarDailyData(practiceId);
        setCalendarData(data);
    }

    function schedulePracticeRefresh() {
        loadPracticeData();
        loadCalendarData();
    }

    function loadSessions(overrideTargetCount?: number) {
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
            setDailyTargetCount(
                practice.dailyTargetCount == null
                    ? ""
                    : String(practice.dailyTargetCount)
            );
            setDefaultSessionCount(String(practice.defaultSessionCount ?? 108));
            setTargetCount(practice.targetCount);
            loadSessions(practice.targetCount);
        }
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
            schedulePracticeRefresh();
        } catch (error: any) {
            alert(error.message);
        }
    }, [practiceId]);

    function openCustomAmountModal() {
        setCustomAmount("");
        setCustomAmountOpen(true);
    }

    function closeCustomAmountModal() {
        setCustomAmountOpen(false);
        setCustomAmount("");
    }

    function addCustomAmount() {
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
            schedulePracticeRefresh();
            closeCustomAmountModal();
        } catch (error: any) {
            alert(error.message);
        }
    }

    const calendarStartDate = useMemo(
        () => appService.getCalendarStartDate(practiceId),
        [practiceId, calendarData]
    );

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

    function isSameDay(a: Date, b: Date) {
        return (
            a.getFullYear() === b.getFullYear() &&
            a.getMonth() === b.getMonth() &&
            a.getDate() === b.getDate()
        );
    }

    function showDateAdjustedModal(selected: Date, actual: Date) {
        setDateAdjustedInfo({ selected, actual });

        setTimeout(() => {
            setDateAdjustedInfo(null);
        }, 4000);
    }

    function formatDateKey(date: Date) {
        return (
            date.getUTCFullYear() +
            "-" +
            String(date.getUTCMonth() + 1).padStart(2, "0") +
            "-" +
            String(date.getUTCDate()).padStart(2, "0")
        );
    }

    function openReminderEditor() {
        if (!hasDailyTarget) {
            alert("Set a daily target before enabling reminders.");
            setTargetEditOpen(true);
            return;
        }

        setReminderOpen(true);
    }

    async function saveReminder(hour: number, minute: number) {
        try {
            const settings =
                await practiceReminderService.savePracticeReminderSettings({
                    practiceId,
                    practiceName,
                    todayCount,
                    dailyTargetCount: effectiveDailyTargetCount,
                    hour,
                    minute,
                });

            setReminderSettings(settings);
            setReminderOpen(false);
        } catch (error: any) {
            alert(error.message);
        }
    }

    async function disableReminder() {
        try {
            const settings =
                await practiceReminderService.disablePracticeReminder(
                    practiceId
                );

            setReminderSettings(settings);
            setReminderOpen(false);
        } catch (error: any) {
            alert(error.message);
        }
    }

    return (
        <View style={{ flex: 1 }}>
            <ScrollView
                contentContainerStyle={{
                    paddingBottom: scrollBottomPadding
                }}
            >
                <View style={containers.screen}>
                    <View >
                        <View>
                            <Pressable onPress={menuOpen ? closeMenu : undefined}>
                                <View>
                                    <Pressable
                                        ref={titleRowRef}
                                        style={({ pressed }) => [
                                            styles.titleRow,
                                            pressed && styles.titleRowPressed,
                                            menuOpen && styles.titleRowOpen
                                        ]}
                                        onPress={toggleMenu}
                                        accessibilityRole="button"
                                        accessibilityLabel={`Open actions for ${practiceName}`}
                                    >
                                        <Text style={styles.title}>
                                            {practiceName}
                                        </Text>

                                        <Animated.View
                                            style={[
                                                styles.titleActionIcon,
                                                {
                                                    opacity: rotateAnim.interpolate({
                                                        inputRange: [0, 1],
                                                        outputRange: [0.78, 1],
                                                    })
                                                }
                                            ]}
                                        >
                                            <MaterialIcons
                                                name="more-horiz"
                                                size={20}
                                                color={colors.primary}
                                            />
                                        </Animated.View>

                                    </Pressable>
                                </View>
                            </Pressable>

                            <Pressable
                                onPress={() => setInfoOpen(true)}
                                style={styles.infoIcon}
                                hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
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
                                            height: imageDisplayHeight,
                                            aspectRatio: imageRatio,
                                            alignSelf: "center"
                                        }}
                                        resizeMode="contain"
                                    />
                                </View>
                            )}


                            <View
                                style={[
                                    styles.statsCardsRow,
                                    { width: imageDisplayWidth }
                                ]}
                            >
                                <View style={styles.statsCard}>
                                    <View style={styles.statsCardLabelRow}>
                                        <MaterialIcons
                                            name="trending-up"
                                            size={16}
                                            color={colors.primary}
                                        />
                                        <Text style={styles.statsCardLabel}>
                                            Total Progress
                                        </Text>
                                    </View>
                                    <Text style={styles.statsCardValue}>
                                        {formatCountProgress(
                                            total,
                                            targetCount || null
                                        )}
                                    </Text>
                                </View>

                                <Pressable
                                    style={({ pressed }) => [
                                        styles.statsCard,
                                        styles.statsCardPressable,
                                        pressed && styles.statsCardPressed
                                    ]}
                                    onPress={() => setTargetEditOpen(true)}
                                    accessibilityRole="button"
                                    accessibilityLabel="Edit target date"
                                >
                                    <View style={styles.statsCardLabelRow}>
                                        <MaterialIcons
                                            name="event"
                                            size={16}
                                            color={colors.primary}
                                        />
                                        <Text style={styles.statsCardLabel}>
                                            Target Date
                                        </Text>
                                        <MaterialIcons
                                            name="edit"
                                            size={14}
                                            color={colors.primary}
                                        />
                                    </View>

                                    <View style={styles.targetDateRow}>
                                        <Text style={styles.statsCardValue}>
                                            {formattedTargetDate}
                                        </Text>

                                        {isCelebrating(practiceId) && (
                                            <CelebrationOverlay
                                                fade={celebrationFade}
                                                sparkle1={sparkle1}
                                                sparkle2={sparkle2}
                                                sparkle3={sparkle3}
                                            />
                                        )}
                                    </View>
                                </Pressable>
                            </View>

                            <View
                                style={[
                                    styles.todayGoalCard,
                                    { width: imageDisplayWidth }
                                ]}
                            >
                                {hasDailyTarget ? (
                                    <DailyGoalProgress
                                        todayCount={todayCount}
                                        dailyTargetCount={effectiveDailyTargetCount}
                                        height={22}
                                        style={styles.todayGoalProgressRow}
                                        labelStyle={styles.todayGoalLabel}
                                        barStyle={styles.todayGoalProgressBar}
                                        textStyle={styles.todayGoalProgressText}
                                    />
                                ) : (
                                    <Pressable
                                        style={({ pressed }) => [
                                            styles.enableDailyTargetButton,
                                            pressed && styles.enableDailyTargetButtonPressed
                                        ]}
                                        onPress={() => setTargetEditOpen(true)}
                                        accessibilityRole="button"
                                        accessibilityLabel="Enable daily target"
                                    >
                                        <MaterialIcons
                                            name="check-circle-outline"
                                            size={17}
                                            color={colors.primary}
                                        />
                                        <Text style={styles.enableDailyTargetText}>
                                            Enable daily target
                                        </Text>
                                    </Pressable>
                                )}

                                <Pressable
                                    style={({ pressed }) => [
                                        styles.reminderButton,
                                        pressed && styles.reminderButtonPressed
                                    ]}
                                    onPress={openReminderEditor}
                                    accessibilityRole="button"
                                    accessibilityLabel="Edit practice reminder"
                                >
                                    <MaterialIcons
                                        name={reminderEnabled ? "notifications-active" : "notifications-none"}
                                        size={18}
                                        color={reminderEnabled ? colors.primary : "#666"}
                                    />

                                    <View style={styles.reminderTextGroup}>
                                        <Text style={styles.reminderTitle}>
                                            {reminderSummary}
                                        </Text>
                                        <Text style={styles.reminderSubtitle}>
                                            {hasDailyTarget
                                                ? "Tap to edit reminder time"
                                                : "Set a daily target before reminders"}
                                        </Text>
                                    </View>

                                    <MaterialIcons
                                        name="chevron-right"
                                        size={20}
                                        color="#999"
                                    />
                                </Pressable>
                            </View>

                            <View
                                style={[
                                    styles.addSessionCard,
                                    { width: imageDisplayWidth }
                                ]}
                            >
                                <View style={styles.addSessionHeader}>
                                    <Text style={styles.addSessionTitle}>
                                        Add Session
                                    </Text>

                                    <Pressable
                                        style={({ pressed }) => [
                                            styles.defaultSessionEditButton,
                                            pressed && styles.addSessionActionPressed
                                        ]}
                                        onPress={() => setQuickAddOpen(true)}
                                        accessibilityRole="button"
                                        accessibilityLabel="Edit default session count"
                                    >
                                        <MaterialIcons
                                            name="edit"
                                            size={15}
                                            color={colors.primary}
                                        />
                                        <Text style={styles.defaultSessionEditText}>
                                            {formatNumber(defaultSessionCount)}
                                        </Text>
                                    </Pressable>
                                </View>

                                <View style={styles.addSessionActions}>
                                    <Pressable
                                        style={({ pressed }) => [
                                            styles.addSessionAction,
                                            styles.addSessionActionPrimary,
                                            pressed && styles.addSessionActionPressed
                                        ]}
                                        onPress={() => {
                                            try {
                                                sessionService.addSession(
                                                    practiceId,
                                                    Number(defaultSessionCount)
                                                );
                                                dailyAnimRef.current?.trigger(
                                                    `+${formatNumber(defaultSessionCount)}\nadded!`
                                                );
                                                schedulePracticeRefresh();
                                            } catch (error: any) {
                                                alert(error.message);
                                            }
                                        }}
                                        onLongPress={() => setQuickAddOpen(true)}
                                        accessibilityRole="button"
                                        accessibilityLabel={`Add default session of ${formatNumber(defaultSessionCount)}`}
                                    >
                                        <Text style={styles.addSessionActionValue}>
                                            +{formatNumber(defaultSessionCount)}
                                        </Text>
                                        <Text style={styles.addSessionActionLabel}>
                                            Default session
                                        </Text>
                                        <FloatingAddAnimation ref={dailyAnimRef} />
                                    </Pressable>

                                    <Pressable
                                        style={({ pressed }) => [
                                            styles.addSessionAction,
                                            pressed && styles.addSessionActionPressed
                                        ]}
                                        onPress={openCustomAmountModal}
                                        accessibilityRole="button"
                                        accessibilityLabel="Add a custom amount"
                                    >
                                        <Text style={styles.addSessionActionValue}>
                                            +
                                        </Text>
                                        <Text style={styles.addSessionActionLabel}>
                                            Custom amount
                                        </Text>
                                        <FloatingAddAnimation ref={customAnimRef} />
                                    </Pressable>
                                </View>
                            </View>

                            <Pressable
                                style={styles.calendarButton}
                                onPress={() => setCalendarOpen(true)}
                            >
                                <Text style={styles.calendarButtonText}>
                                    Practice Calendar
                                </Text>
                            </Pressable>

                        </View>

                        <Modal
                            visible={customAmountOpen}
                            transparent
                            animationType="fade"
                            onRequestClose={closeCustomAmountModal}
                        >
                            <Pressable
                                style={styles.customAmountOverlay}
                                onPress={closeCustomAmountModal}
                            >
                                <Pressable
                                    style={styles.customAmountModal}
                                    onPress={() => { }}
                                >
                                    <Text style={styles.customAmountTitle}>
                                        Add custom amount
                                    </Text>

                                    <TextInput
                                        value={customAmount}
                                        onChangeText={(text) => {
                                            setCustomAmount(digitsOnly(text));
                                        }}
                                        keyboardType="numeric"
                                        returnKeyType="done"
                                        onSubmitEditing={addCustomAmount}
                                        placeholder="Enter amount"
                                        placeholderTextColor="#999"
                                        style={styles.customAmountInput}
                                        maxLength={String(MAX_REPETITIONS_PER_DAY).length}
                                        autoFocus
                                    />

                                    <View style={styles.customAmountActions}>
                                        <Pressable
                                            style={styles.customAmountCancelButton}
                                            onPress={closeCustomAmountModal}
                                        >
                                            <Text style={styles.customAmountCancelText}>
                                                Cancel
                                            </Text>
                                        </Pressable>

                                        <Pressable
                                            style={styles.customAmountAddButton}
                                            onPress={addCustomAmount}
                                        >
                                            <Text style={styles.customAmountAddText}>
                                                Add
                                            </Text>
                                        </Pressable>
                                    </View>
                                </Pressable>
                            </Pressable>
                        </Modal>

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

                                        <Pressable
                                            onPress={() => setCalendarInfoOpen(true)}
                                            style={styles.calendarInfoIcon}
                                            hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
                                            accessibilityRole="button"
                                            accessibilityLabel="Practice calendar information"
                                        >
                                            <MaterialIcons
                                                name="info-outline"
                                                size={20}
                                                color="#666"
                                            />
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
                            visible={calendarInfoOpen}
                            transparent
                            animationType="fade"
                            onRequestClose={() => setCalendarInfoOpen(false)}
                        >
                            <Pressable
                                style={styles.infoOverlay}
                                onPress={() => setCalendarInfoOpen(false)}
                            >
                                <Pressable
                                    style={styles.infoModal}
                                    onPress={() => { }}
                                >
                                    <Text style={styles.infoTitle}>
                                        Editing the Calendar
                                    </Text>

                                    <Text style={styles.infoText}>
                                        You can edit today or any earlier day in the practice calendar if you forgot to record a practice.
                                    </Text>

                                    <Text style={styles.infoText}>
                                        Tap a day, enter the correct total for that date, and the app will update your progress.
                                    </Text>

                                    <Pressable
                                        style={styles.infoButton}
                                        onPress={() => setCalendarInfoOpen(false)}
                                    >
                                        <Text style={styles.infoButtonText}>
                                            OK
                                        </Text>
                                    </Pressable>
                                </Pressable>
                            </Pressable>
                        </Modal>

                        <PracticeActionsMenu
                            visible={menuOpen}
                            anchor={menuAnchor}
                            practice={{
                                id: practiceId,
                                name: practiceName,
                                total,
                            }}
                            onClose={closeMenu}
                            onDeleted={() => router.replace("/")}
                            onCalendar={() => setCalendarOpen(true)}
                        />

                    </View>

                    <QuickAddEditor
                        visible={quickAddOpen}
                        practiceId={practiceId}
                        practiceName={practiceName}
                        defaultValue={Number(defaultSessionCount)}
                        onClose={() => setQuickAddOpen(false)}
                    />

                    <PracticeReminderEditor
                        visible={reminderOpen}
                        enabled={reminderEnabled}
                        practiceName={practiceName}
                        initialHour={reminderHour}
                        initialMinute={reminderMinute}
                        onClose={() => setReminderOpen(false)}
                        onDisable={disableReminder}
                        onSave={saveReminder}
                    />

                    <TargetDateEditor
                        visible={targetEditOpen}
                        targetCount={targetCount}
                        total={total}
                        currentTargetDate={targetDate}
                        onClose={() => setTargetEditOpen(false)}
                        onSave={(newDaily, selectedDateStr) => {
                            practiceService.updatePracticeDailyTargetCount(
                                practiceId,
                                newDaily
                            );
                            setDailyTargetCount(String(newDaily));

                            const selectedDate = new Date(selectedDateStr);

                            const actualDate =
                                practiceService.getExpectedTargetDate(
                                    targetCount,
                                    total,
                                    newDaily
                                );

                            if (
                                actualDate &&
                                !isSameDay(actualDate, selectedDate)
                            ) {
                                showDateAdjustedModal(selectedDate, actualDate);
                            }
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
                                    Long press the default session button to change how much it adds. Tap the target date to adjust the daily target used for estimates.
                                </Text>

                                <Text style={styles.infoText}>
                                    Changing the target date recalculates the daily target,
                                    and the calendar below updates accordingly.
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

                </View>
            </ScrollView>

            <Modal
                visible={!!dateAdjustedInfo}
                transparent
                animationType="fade"
            >
                <View style={styles.infoOverlay}>
                    <View style={styles.infoModal}>
                        <Text style={styles.infoText}>
                            You&apos;ll finish sooner than that.
                        </Text>

                        <Text style={styles.infoText}>
                            We adjusted the date to match your pace.
                        </Text>
                    </View>
                </View>
            </Modal>

        </View>
    );
}

const styles = StyleSheet.create({

    container: {
        marginTop: 60
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

    titleRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        alignSelf: "center",
        paddingLeft: 14,
        paddingRight: 8,
        paddingVertical: 5,
        borderRadius: 999,
        backgroundColor: "#eef2ff",
        borderWidth: 1,
        borderColor: "#dbe4ff",
    },

    titleRowPressed: {
        opacity: 0.78,
    },

    titleRowOpen: {
        borderColor: colors.primary,
        backgroundColor: "#e0e7ff",
    },

    titleActionIcon: {
        width: 24,
        height: 24,
        borderRadius: 12,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "white",
    },

    imageWrapper: {
        zIndex: 1,
        elevation: 1,
        marginBottom: 10,
        alignItems: "center",
        width: "100%",
        marginTop: 5
    },

    contentBlock: {
        paddingHorizontal: 20,
        zIndex: 1,
        elevation: 1,
        paddingBottom: 30,
        paddingTop: 15

    },

    statsCardsRow: {
        flexDirection: "row",
        alignSelf: "center",
        gap: 10,
        paddingTop: 18,
        paddingBottom: 2,
    },

    statsCard: {
        flex: 1,
        minHeight: 72,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: "#E1E7F5",
        backgroundColor: "#FAFBFF",
        paddingVertical: 11,
        paddingHorizontal: 12,
        justifyContent: "center",
        shadowColor: "#000",
        shadowOpacity: 0.04,
        shadowRadius: 5,
        shadowOffset: {
            width: 0,
            height: 2,
        },
        elevation: 1,
        alignItems: "center"
    },

    statsCardPressable: {
        borderColor: "#DBE4FF",
    },

    statsCardPressed: {
        opacity: 0.74,
    },

    statsCardLabelRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
        marginBottom: 6,
    },

    statsCardLabel: {
        fontSize: 13,
        fontWeight: "700",
        color: "#111",
    },

    statsCardValue: {
        fontSize: 14,
        color: "#555",
        lineHeight: 19,
    },

    targetDateRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        position: "relative",
        flexWrap: "wrap"
    },

    todayGoalCard: {
        alignSelf: "center",
        marginTop: 18,
        marginBottom: 8,
        paddingVertical: 12,
        paddingHorizontal: 14,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: "#DBE4FF",
        backgroundColor: "#F8FAFF",
        gap: 10,
    },

    todayGoalProgressRow: {
        width: "100%",
    },

    todayGoalLabel: {
        fontSize: 14,
        fontWeight: "700",
        minWidth: 92,
    },

    todayGoalProgressBar: {
        flex: 1,
        minWidth: 150,
    },

    todayGoalProgressText: {
        fontSize: 14,
    },

    addSessionCard: {
        alignSelf: "center",
        marginTop: 14,
        padding: 14,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: "#DBE4FF",
        backgroundColor: "#FAFBFF",
        gap: 12,
        shadowColor: "#000",
        shadowOpacity: 0.04,
        shadowRadius: 5,
        shadowOffset: {
            width: 0,
            height: 2,
        },
        elevation: 1,
    },

    addSessionHeader: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 10,
    },

    addSessionTitle: {
        fontSize: 15,
        fontWeight: "700",
        color: "#111",
    },

    defaultSessionEditButton: {
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
        paddingVertical: 5,
        paddingHorizontal: 10,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: "#DBE4FF",
        backgroundColor: "white",
    },

    defaultSessionEditText: {
        fontSize: 13,
        fontWeight: "700",
        color: colors.primary,
    },

    addSessionActions: {
        flexDirection: "row",
        gap: 10,
    },

    addSessionAction: {
        flex: 1,
        minHeight: 82,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: "#DBE4FF",
        backgroundColor: "white",
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 8,
        position: "relative",
        overflow: "visible",
    },

    addSessionActionPrimary: {
        borderColor: colors.primary,
        backgroundColor: "#EEF2FF",
    },

    addSessionActionPressed: {
        opacity: 0.72,
    },

    addSessionActionValue: {
        fontSize: 18,
        fontWeight: "800",
        color: "#111",
        marginBottom: 5,
    },

    addSessionActionLabel: {
        fontSize: 12,
        fontWeight: "600",
        color: "#666",
        textAlign: "center",
    },

    enableDailyTargetButton: {
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

    enableDailyTargetButtonPressed: {
        opacity: 0.72,
    },

    enableDailyTargetText: {
        fontSize: 14,
        fontWeight: "400",
        color: "#111",
    },

    reminderButton: {
        flexDirection: "row",
        alignItems: "center",
        gap: 9,
        paddingTop: 9,
        borderTopWidth: 1,
        borderTopColor: "#E5E7EB",
    },

    reminderButtonPressed: {
        opacity: 0.72,
    },

    reminderTextGroup: {
        flex: 1,
        gap: 2,
    },

    reminderTitle: {
        fontSize: 14,
        fontWeight: "600",
        color: "#111",
    },

    reminderSubtitle: {
        fontSize: 12,
        color: "#666",
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

    customAmountOverlay: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.25)",
        justifyContent: "center",
        alignItems: "center",
        padding: 20
    },

    customAmountModal: {
        width: "100%",
        maxWidth: 340,
        backgroundColor: "white",
        borderRadius: 12,
        padding: 20
    },

    customAmountTitle: {
        fontSize: 18,
        fontWeight: "700",
        color: "#111",
        marginBottom: 14
    },

    customAmountInput: {
        borderWidth: 1,
        borderColor: "#ddd",
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 10,
        fontSize: 16,
        color: "#111",
        marginBottom: 18
    },

    customAmountActions: {
        flexDirection: "row",
        justifyContent: "flex-end",
        alignItems: "center",
        gap: 12
    },

    customAmountCancelButton: {
        paddingHorizontal: 12,
        paddingVertical: 8
    },

    customAmountCancelText: {
        fontSize: 15,
        fontWeight: "600",
        color: "#666"
    },

    customAmountAddButton: {
        paddingHorizontal: 16,
        paddingVertical: 9,
        borderRadius: 8,
        backgroundColor: colors.primary
    },

    customAmountAddText: {
        fontSize: 15,
        fontWeight: "700",
        color: "white"
    },

    calendarButtonText: {
        fontSize: 15,
        fontWeight: "600",
        color: "white"
    },

    calendarHeader: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
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
    calendarInfoIcon: {
        width: 28,
        height: 28,
        alignItems: "center",
        justifyContent: "center",
        marginRight: 2
    },
    calendarButton: {
        width: "100%",
        marginTop: 24,
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
        height: Dimensions.get("window").width > 700 ? "70%" : "60%",
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
