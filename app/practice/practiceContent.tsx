import { MaterialIcons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import * as Localization from "expo-localization";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, Dimensions, Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import CelebrationOverlay from "../../components/CelebrationOverlay";
import DailyGoalProgress from "../../components/DailyGoalProgress";
import DailyTargetEditor from "../../components/DailyTargetEditor";
import EnableDailyTargetButton from "../../components/EnableDailyTargetButton";
import FloatingAddAnimation, { FloatingAddAnimationRef } from "../../components/FloatingAddAnimation";
import PracticeActionsMenu, {
    type PracticeMenuAnchor,
} from "../../components/PracticeActionsMenu";
import PracticeCalendar from "../../components/PracticeCalendar";
import PracticeProgressEditor from "../../components/PracticeProgressEditor";
import PracticeReminderEditor from "../../components/PracticeReminderEditor";
import QuickAddEditor from "../../components/QuickAddEditor";
import TargetDateEditor from "../../components/TargetDateEditor";
import { practiceImages } from "../../constants/practiceImages";
import { useReachedCelebration } from "../../hooks/useReachedCelebration";
import { useI18n } from "../../i18n";
import { getPracticeDisplayName } from "../../i18n/practiceNames";
import { createPracticeReminderText } from "../../i18n/reminderText";
import * as appService from "../../services/appService";
import * as practiceReminderRefreshService from "../../services/practiceReminderRefreshService";
import type { PracticeReminderSettings } from "../../services/practiceReminderService";
import * as practiceReminderService from "../../services/practiceReminderService";
import * as practiceService from "../../services/practiceService";
import * as sessionService from "../../services/sessionService";
import { APP_SIDE_PADDING } from "../../styles/global";
import { colors, containers } from "../../styles/theme";
import { subscribeData } from "../../utils/events";
import { digitsOnly, formatCountProgress, formatNumber, MAX_REPETITIONS_PER_DAY, validateNonNegativeInteger } from "../../utils/numberUtils";
import { getPracticeReminderSettingsFromPractice } from "../../utils/practiceReminderState";
import { formatReminderTimeForLocale } from "../../utils/reminderTime";

export default function PracticeContent({
    practiceId,
    openCalendarInitially = false,
}: {
    practiceId: string;
    openCalendarInitially?: boolean;
}) {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { locale, t } = useI18n();
    const [quickAddOpen, setQuickAddOpen] = useState(false);
    const [progressEditOpen, setProgressEditOpen] = useState(false);
    const [targetEditOpen, setTargetEditOpen] = useState(false);
    const [reminderOpen, setReminderOpen] = useState(false);
    const initialPractice = practiceService.getPractice(practiceId);
    const [reminderSettings, setReminderSettings] =
        useState<PracticeReminderSettings>(() =>
            getPracticeReminderSettingsFromPractice(initialPractice)
        );

    const [practiceName, setPracticeName] = useState(initialPractice?.name ?? "");
    const displayPracticeName =
        getPracticeDisplayName(practiceId, practiceName, t);
    const reminderText = useMemo(
        () => createPracticeReminderText(t),
        [t]
    );
    const timeLocale =
        Localization.getLocales()[0]?.languageTag ?? locale;
    const [total, setTotal] = useState(() =>
        sessionService.getPracticeTotal(practiceId).total
    );
    const [imageKey, setImageKey] = useState<string | null>(initialPractice?.imageKey ?? null);
    const [dailyTargetCount, setDailyTargetCount] = useState(
        initialPractice?.dailyTargetCount == null
            ? ""
            : String(initialPractice.dailyTargetCount)
    );
    const [dailyTargetOpen, setDailyTargetOpen] = useState(false);
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
    const availableContentWidth =
        Math.max(width - APP_SIDE_PADDING * 2, 0);
    const imageDisplayWidth = Math.min(availableContentWidth, 500);
    const imageDisplayHeight = imageDisplayWidth / imageRatio;
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
    const reminderEnabled = reminderSettings.enabled === true;
    const reminderHour = reminderSettings.hour;
    const reminderMinute = reminderSettings.minute;
    const reminderSummary = reminderEnabled
        ? t("practice.reminderAt", {
            time: formatReminderTimeForLocale(
                reminderHour,
                reminderMinute,
                timeLocale
            ),
        })
        : t("practice.reminderOff");
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
            return t("practice.reached");
        }

        if (!effectiveDailyTargetCount) return t("practice.setDailyTargetFirst");
        if (!targetDate) return t("practice.noEstimate");

        return targetDate.toLocaleDateString(locale, {
            month: "long",
            day: "2-digit",
            year: "numeric"
        });
    }, [effectiveDailyTargetCount, locale, targetDate, total, targetCount, t]);
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
    }, [practiceId, t]);

    useEffect(() => {
        if (!reminderSettings.enabled) return;

        void practiceReminderRefreshService
            .refreshReminderForPractice(
                practiceId,
                {
                    reminderText,
                    t,
                }
            )
            .then(() => {
                setReminderSettings(
                    getPracticeReminderSettingsFromPractice(
                        practiceService.getPractice(practiceId)
                    )
                );
            })
            .catch(error => {
                console.warn("Failed to refresh practice reminder", error);
            });
    }, [
        practiceId,
        displayPracticeName,
        reminderText,
        t,
        todayCount,
        effectiveDailyTargetCount,
        reminderSettings.enabled,
    ]);

    useEffect(() => {
        const unsubscribe = subscribeData(() => {
            schedulePracticeRefresh();
        });

        return unsubscribe;
    }, [practiceId, t]);

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
            setReminderSettings(
                getPracticeReminderSettingsFromPractice(practice)
            );
            loadSessions(practice.targetCount);
        }
    }

    const handleEdit = useCallback((date: string, newValue: number) => {
        if (!Number.isFinite(newValue)) return;

        if (newValue < 0) {
            alert(t("practice.valueCannotBeNegative"));
            return;
        }

        if (!Number.isInteger(newValue)) {
            alert(t("practice.enterWholeNumber"));
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
    }, [practiceId, t]);

    function openCustomAmountModal() {
        setCustomAmount("");
        setCustomAmountOpen(true);
    }

    function closeCustomAmountModal() {
        setCustomAmountOpen(false);
        setCustomAmount("");
    }

    function openDailyTargetEditor() {
        setDailyTargetOpen(true);
    }

    function closeDailyTargetEditor() {
        setDailyTargetOpen(false);
    }

    function saveDailyTarget(dailyTargetCount: number) {
        practiceService.updatePracticeDailyTargetCount(
            practiceId,
            dailyTargetCount
        );
        setDailyTargetCount(String(dailyTargetCount));
        schedulePracticeRefresh();
    }

    function saveProgress(nextTotal: number, nextTargetCount: number) {
        practiceService.updatePractice(
            practiceId,
            practiceName,
            nextTargetCount,
            nextTotal
        );
        setTargetCount(nextTargetCount);
        setTotal(nextTotal);
        schedulePracticeRefresh();
    }

    function addCustomAmount() {
        const error =
            validateNonNegativeInteger(
                customAmount,
                t("practice.customAmount")
            );

        if (error) {
            alert(error);
            return;
        }

        const value = Number(customAmount);

        if (value > MAX_REPETITIONS_PER_DAY) {
            alert(
                t("practice.customAmountTooHigh", {
                    count: formatNumber(MAX_REPETITIONS_PER_DAY),
                })
            );
            return;
        }

        try {
            sessionService.addSession(
                practiceId,
                value
            );
            customAnimRef.current?.trigger(
                `+${formatNumber(value)}\n${t("common.added")}`
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
            alert(t("practice.setDailyTargetBeforeReminders"));
            openDailyTargetEditor();
            return;
        }

        setReminderOpen(true);
    }

    async function saveReminder(hour: number, minute: number) {
        try {
            const settings =
                await practiceReminderService.savePracticeReminderSettings({
                    practiceId,
                    practiceName: displayPracticeName,
                    todayCount,
                    dailyTargetCount: effectiveDailyTargetCount,
                    reminderText,
                    hour,
                    minute,
                });

            setReminderSettings(settings);
            practiceService.updatePracticeReminderSettings(
                practiceId,
                settings.enabled,
                settings.hour,
                settings.minute
            );
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
            practiceService.updatePracticeReminderSettings(
                practiceId,
                settings.enabled,
                settings.hour,
                settings.minute
            );
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
                                        accessibilityLabel={t("practice.openActionsA11y", {
                                            practiceName: displayPracticeName,
                                        })}
                                    >
                                        <Text style={styles.title}>
                                            {displayPracticeName}
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
                                <Pressable
                                    style={({ pressed }) => [
                                        styles.statsCard,
                                        styles.statsCardPressable,
                                        pressed && styles.statsCardPressed
                                    ]}
                                    onPress={() => setProgressEditOpen(true)}
                                    accessibilityRole="button"
                                    accessibilityLabel={t("practice.totalProgress")}
                                >
                                    <View style={styles.statsCardLabelRow}>
                                        <MaterialIcons
                                            name="trending-up"
                                            size={16}
                                            color={colors.primary}
                                        />
                                        <Text style={styles.statsCardLabel}>
                                            {t("practice.totalProgress")}
                                        </Text>
                                        <MaterialIcons
                                            name="edit"
                                            size={14}
                                            color={colors.primary}
                                        />
                                    </View>
                                    <Text style={styles.statsCardValue}>
                                        {formatCountProgress(
                                            total,
                                            targetCount || null
                                        )}
                                    </Text>
                                </Pressable>

                                <Pressable
                                    style={({ pressed }) => [
                                        styles.statsCard,
                                        styles.statsCardPressable,
                                        pressed && styles.statsCardPressed
                                    ]}
                                    onPress={() => setTargetEditOpen(true)}
                                    accessibilityRole="button"
                                    accessibilityLabel={t("practice.editTargetDate")}
                                >
                                    <View style={styles.statsCardLabelRow}>
                                        <MaterialIcons
                                            name="event"
                                            size={16}
                                            color={colors.primary}
                                        />
                                        <Text style={styles.statsCardLabel}>
                                            {t("practice.targetDate")}
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
                                    <EnableDailyTargetButton
                                        onPress={openDailyTargetEditor}
                                        accessibilityLabel={t("practice.enableDailyTarget")}
                                    />
                                )}

                                <Pressable
                                    style={({ pressed }) => [
                                        styles.reminderButton,
                                        pressed && styles.reminderButtonPressed
                                    ]}
                                    onPress={openReminderEditor}
                                    accessibilityRole="button"
                                    accessibilityLabel={t("practice.editPracticeReminder")}
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
                                                ? t("practice.editReminderTime")
                                                : t("practice.reminderNeedsTarget")}
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
                                        {t("practice.addSession")}
                                    </Text>

                                    <Pressable
                                        style={({ pressed }) => [
                                            styles.defaultSessionEditButton,
                                            pressed && styles.addSessionActionPressed
                                        ]}
                                        onPress={() => setQuickAddOpen(true)}
                                        accessibilityRole="button"
                                        accessibilityLabel={t("practice.editDefaultSessionCount")}
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
                                                    `+${formatNumber(defaultSessionCount)}\n${t("common.added")}`
                                                );
                                                schedulePracticeRefresh();
                                            } catch (error: any) {
                                                alert(error.message);
                                            }
                                        }}
                                        onLongPress={() => setQuickAddOpen(true)}
                                        accessibilityRole="button"
                                        accessibilityLabel={t("practice.addDefaultSessionA11y", {
                                            count: formatNumber(defaultSessionCount),
                                        })}
                                    >
                                        <Text style={styles.addSessionActionValue}>
                                            +{formatNumber(defaultSessionCount)}
                                        </Text>
                                        <Text style={styles.addSessionActionLabel}>
                                            {t("practice.defaultSession")}
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
                                        accessibilityLabel={t("practice.addCustomAmount")}
                                    >
                                        <Text style={styles.addSessionActionValue}>
                                            +
                                        </Text>
                                        <Text style={styles.addSessionActionLabel}>
                                            {t("practice.customAmount")}
                                        </Text>
                                        <FloatingAddAnimation ref={customAnimRef} />
                                    </Pressable>
                                </View>
                            </View>

                            <View
                                style={[
                                    styles.calendarButtonContainer,
                                    { width: imageDisplayWidth }
                                ]}
                            >
                                <Pressable
                                    style={styles.calendarButton}
                                    onPress={() => setCalendarOpen(true)}
                                >
                                    <Text style={styles.calendarButtonText}>
                                        {t("practice.practiceCalendar")}
                                    </Text>
                                </Pressable>
                            </View>

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
                                        {t("practice.addCustomAmount")}
                                    </Text>

                                    <TextInput
                                        value={customAmount}
                                        onChangeText={(text) => {
                                            setCustomAmount(digitsOnly(text));
                                        }}
                                        keyboardType="numeric"
                                        returnKeyType="done"
                                        onSubmitEditing={addCustomAmount}
                                        placeholder={t("practice.enterAmount")}
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
                                                {t("common.cancel")}
                                            </Text>
                                        </Pressable>

                                        <Pressable
                                            style={styles.customAmountAddButton}
                                            onPress={addCustomAmount}
                                        >
                                            <Text style={styles.customAmountAddText}>
                                                {t("common.add")}
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
                                                {t("common.close")}
                                            </Text>
                                        </Pressable>

                                        <Pressable
                                            onPress={() => setCalendarInfoOpen(true)}
                                            style={styles.calendarInfoIcon}
                                            hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
                                            accessibilityRole="button"
                                            accessibilityLabel={t("practice.calendarInfoA11y")}
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
                                        {t("practice.calendarInfoTitle")}
                                    </Text>

                                    <Text style={styles.infoText}>
                                        {t("practice.calendarInfoText1")}
                                    </Text>

                                    <Text style={styles.infoText}>
                                        {t("practice.calendarInfoText2")}
                                    </Text>

                                    <Pressable
                                        style={styles.infoButton}
                                        onPress={() => setCalendarInfoOpen(false)}
                                    >
                                        <Text style={styles.infoButtonText}>
                                            {t("common.ok")}
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
                                name: displayPracticeName,
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
                        practiceName={displayPracticeName}
                        defaultValue={Number(defaultSessionCount)}
                        onClose={() => setQuickAddOpen(false)}
                    />

                    <PracticeProgressEditor
                        visible={progressEditOpen}
                        practiceName={displayPracticeName}
                        total={total}
                        targetCount={targetCount}
                        onClose={() => setProgressEditOpen(false)}
                        onSave={saveProgress}
                    />

                    <DailyTargetEditor
                        visible={dailyTargetOpen}
                        practiceName={displayPracticeName}
                        initialValue={dailyTargetCount}
                        onClose={closeDailyTargetEditor}
                        onSave={saveDailyTarget}
                    />

                    <PracticeReminderEditor
                        visible={reminderOpen}
                        enabled={reminderEnabled}
                        practiceName={displayPracticeName}
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
                                    {t("practice.adjustingInfoTitle")}
                                </Text>

                                <Text style={styles.infoText}>
                                    {t("practice.adjustingInfoText1")}
                                </Text>

                                <Text style={styles.infoText}>
                                    {t("practice.adjustingInfoText2")}
                                </Text>

                                <Pressable
                                    style={styles.infoButton}
                                    onPress={() => setInfoOpen(false)}
                                >
                                    <Text style={styles.infoButtonText}>
                                        {t("common.ok")}
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
                            {t("practice.dateAdjustedSooner")}
                        </Text>

                        <Text style={styles.infoText}>
                            {t("practice.dateAdjustedPace")}
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
    calendarButtonContainer: {
        alignSelf: "center",
        marginTop: 24,
    },
    calendarButton: {
        width: "100%",
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
