import { subscribeData } from "@/utils/events";
import { MaterialIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Animated, Dimensions, Image, Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View, type LayoutChangeEvent } from "react-native";
import Reanimated, { LinearTransition } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import CelebrationOverlay from "../components/CelebrationOverlay";
import DailyGoalProgress from "../components/DailyGoalProgress";
import DailyTargetEditor from "../components/DailyTargetEditor";
import EnableDailyTargetButton from "../components/EnableDailyTargetButton";
import PracticeActionsMenu, {
  type PracticeMenuAnchor,
} from "../components/PracticeActionsMenu";
import PracticeCalendarModal from "../components/PracticeCalendarModal";
import PracticeHistoryModal from "../components/PracticeHistoryModal";
import QuickAddEditor from "../components/QuickAddEditor";
import WelcomeModal from "../components/WelcomeModal";
import { practiceImages } from "../constants/practiceImages";
import { usePracticeActions } from "../hooks/usePracticeActions";
import { useReachedCelebration } from "../hooks/useReachedCelebration";
import { useI18n } from "../i18n";
import { getPracticeDisplayName } from "../i18n/practiceNames";
import * as appService from "../services/appService";
import * as dashboardService from "../services/dashboardService";
import {
  DEFAULT_DRAG_REORDER_ANIMATION_MS,
  DragReorderService,
  getDragPreviewItems,
  type DragOverlayFrame,
} from "../services/dragReorderService";
import * as practiceService from "../services/practiceService";
import * as sessionService from "../services/sessionService";
import { colors, useAppTheme, useGlobalStyles } from "../styles/theme";
import { formatMonthDayYear } from "../utils/dateUtils";
import { formatCountProgress, formatNumber } from "../utils/numberUtils";

type Practice = {
  id: string;
  name: string;
  targetCount: number;
  total: number;
  today: number;
  imageKey?: string | null;
  dailyTargetCount?: number | null;
  defaultSessionCount?: number | null;
};

const MAX_STREAK_FIRE_DAYS = 365;
const MIN_STREAK_FIRE_SIZE = 5;
const MAX_STREAK_FIRE_SIZE = 26;
const STREAK_FIRE_GROWTH_EXPONENT = 1.4;
const DASHBOARD_PROGRESS_BAR_HEIGHT = 22;
const practiceCardLayoutTransition =
  LinearTransition.duration(DEFAULT_DRAG_REORDER_ANIMATION_MS);

type DashboardTotalProgressBarProps = {
  label: string;
  progress: number;
};

function DashboardTotalProgressBar({
  label,
  progress,
}: DashboardTotalProgressBarProps) {
  const { colors: themeColors, isDark } = useAppTheme();
  const [trackWidth, setTrackWidth] = useState(0);
  const safeProgress =
    Number.isFinite(progress)
      ? Math.min(Math.max(progress, 0), 1)
      : 0;
  const percent = Math.round(safeProgress * 100);
  const fillWidth = `${safeProgress * 100}%` as `${number}%`;

  function handleTrackLayout(event: LayoutChangeEvent) {
    setTrackWidth(event.nativeEvent.layout.width);
  }

  return (
    <View
      style={[
        styles.totalProgressTrack,
        {
          backgroundColor: themeColors.progressTrack,
          borderColor: themeColors.borderStrong,
        },
      ]}
      onLayout={handleTrackLayout}
      accessibilityRole="progressbar"
      accessibilityValue={{
        min: 0,
        max: 100,
        now: percent,
      }}
    >
      <View
        style={[
          styles.totalProgressFill,
          {
            width: fillWidth,
            backgroundColor: themeColors.primary,
          },
        ]}
      />

      <View style={styles.totalProgressTextFull}>
        <Text
          style={[
            styles.totalProgressText,
            {
              color: themeColors.textPrimary,
              fontWeight: isDark ? "400" : "700",
            },
          ]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.72}
        >
          {label}
        </Text>
      </View>

      {trackWidth > 0 && (
        <View
          pointerEvents="none"
          style={[
            styles.totalProgressFilledTextClip,
            { width: fillWidth },
          ]}
        >
          <View
            style={[
              styles.totalProgressTextFull,
              { width: trackWidth },
            ]}
          >
            <Text
              style={[
                styles.totalProgressText,
                styles.totalProgressTextFilled,
                { fontWeight: isDark ? "400" : "700" },
              ]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.72}
            >
              {label}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

function getStreakFireSize(streak: number) {
  const cappedStreak =
    Math.min(Math.max(streak, 0), MAX_STREAK_FIRE_DAYS);
  const progress = Math.pow(
    cappedStreak / MAX_STREAK_FIRE_DAYS,
    STREAK_FIRE_GROWTH_EXPONENT
  );

  return Math.round(
    MIN_STREAK_FIRE_SIZE +
    (MAX_STREAK_FIRE_SIZE - MIN_STREAK_FIRE_SIZE) * progress
  );
}

export default function Dashboard() {

  const router = useRouter();
  const insets = useSafeAreaInsets();
  const globalStyles = useGlobalStyles();
  const { colors: themeColors } = useAppTheme();
  const { locale, t } = useI18n();
  const dashboardBottomPadding = Math.max(30, insets.bottom + 24);
  const [practices, setPractices] = useState<Practice[]>([]);
  const [streak, setStreak] = useState(0);
  const [dashboardLoaded, setDashboardLoaded] = useState(false);

  const [editDefaultOpen, setEditDefaultOpen] = useState(false);
  const [selectedPracticeId, setSelectedPracticeId] = useState<string | null>(null);
  const [selectedPracticeName, setSelectedPracticeName] = useState("");
  const [defaultSessionInput, setDefaultSessionInput] = useState("");
  const [dailyTargetPromptPractice, setDailyTargetPromptPractice] =
    useState<{ id: string; name: string } | null>(null);
  const [showQuickAddHint, setShowQuickAddHint] = useState(false);
  const quickAddRefs = useRef<Record<string, View | null>>({});
  const practiceRowRefs = useRef<Record<string, View | null>>({});
  const practicesRef = useRef<Practice[]>([]);
  const [draggingPracticeId, setDraggingPracticeId] = useState<string | null>(null);
  const [dragPreviewOrderIds, setDragPreviewOrderIds] = useState<string[] | null>(null);
  const [dragOverlayPractice, setDragOverlayPractice] = useState<Practice | null>(null);
  const [dragOverlayFrame, setDragOverlayFrame] = useState<DragOverlayFrame | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState<{ top: number; left: number } | null>(null);
  const [menuPractice, setMenuPractice] = useState<Practice | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<PracticeMenuAnchor | null>(null);
  const [calendarPractice, setCalendarPractice] =
    useState<Practice | null>(null);
  const [calendarData, setCalendarData] = useState<
    { date: string; count: number }[]
  >([]);
  const {
    celebrationFade,
    sparkle1,
    sparkle2,
    sparkle3,
    updateReachedState,
    isCelebrating,
  } = useReachedCelebration();
  const refreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [infoOpen, setInfoOpen] = useState(false);
  const [welcomeOpen, setWelcomeOpen] = useState(false);
  const refreshDashboard = useCallback(() => {
    const rows = dashboardService.getDashboardPractices();
    updateReachedState(
      rows.map(practice => ({
        id: practice.id,
        total: practice.total,
        targetCount: practice.targetCount,
      }))
    );
    setPractices(rows);
    setStreak(dashboardService.getCurrentStreak());
    setDashboardLoaded(true);
  }, [updateReachedState]);
  const scheduleDashboardRefresh = useCallback(() => {
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current);
    }

    refreshTimeoutRef.current = setTimeout(() => {
      refreshTimeoutRef.current = null;
      refreshDashboard();
    }, 0);
  }, [refreshDashboard]);
  const practiceActions = usePracticeActions({
    onDeleted: refreshDashboard,
  });
  const streakFireSize = getStreakFireSize(streak);
  const cardThemeStyle = {
    backgroundColor: themeColors.surfaceElevated,
    borderColor: themeColors.borderSubtle,
    shadowColor: themeColors.shadow,
  };
  const textPrimaryStyle = {
    color: themeColors.textPrimary,
  };
  const textSecondaryStyle = {
    color: themeColors.textSecondary,
  };
  const quickAddThemeStyle = {
    backgroundColor: themeColors.quickAddSurface,
    borderColor: themeColors.quickAddBorder,
  };
  const quickAddDividerStyle = {
    borderLeftColor: themeColors.quickAddBorder,
  };
  const refreshDashboardRef = useRef(refreshDashboard);
  const dragReorderRef = useRef<DragReorderService<Practice> | null>(null);

  if (!dragReorderRef.current) {
    dragReorderRef.current = new DragReorderService<Practice>({
      getItems: () => practicesRef.current,
      setItems: (nextPractices) => {
        practicesRef.current = nextPractices;
        setPractices(nextPractices);
      },
      setPreviewOrderIds: setDragPreviewOrderIds,
      setDraggingItemId: setDraggingPracticeId,
      setOverlayItem: setDragOverlayPractice,
      setOverlayFrame: setDragOverlayFrame,
      onReorder: (nextOrder) => {
        practiceService.reorderPractices(nextOrder);
      },
      onReorderError: (error: any) => {
        alert(error.message);
        refreshDashboardRef.current();
      },
    });
  }

  const dragReorder = dragReorderRef.current;

  useEffect(() => {
    refreshDashboardRef.current = refreshDashboard;
  }, [refreshDashboard]);

  useFocusEffect(
    useCallback(() => {
      scheduleDashboardRefresh();
    }, [scheduleDashboardRefresh])
  );

  useEffect(() => {
    practicesRef.current = practices;
  }, [practices]);

  useEffect(() => {
    return () => {
      dragReorder.dispose();
    };
  }, [dragReorder]);

  useEffect(() => {
    maybeShowWelcomeModal();

    const unsubscribe = subscribeData(() => {
      scheduleDashboardRefresh();
    });

    return () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
      unsubscribe();
    };
  }, [scheduleDashboardRefresh]);

  async function maybeShowWelcomeModal() {
    const seen = await AsyncStorage.getItem("welcomeModalSeen");

    if (seen) return;

    setWelcomeOpen(true);
    await AsyncStorage.setItem(
      "welcomeModalSeen",
      "true"
    );
  }

  async function maybeShowQuickAddHint(practiceId: string) {
    const seen = await AsyncStorage.getItem("quickAddLongPressHintSeen");

    if (seen) return;

    const target = quickAddRefs.current[practiceId];
    if (!target) return;

    // Prefer measuring via the ref; UIManager.measureInWindow is deprecated.
    (target as any).measureInWindow(async (x: number, y: number, width: number, height: number) => {
      const tooltipWidth = 240;
      let left = x + width / 2 - tooltipWidth / 2;

      left = Math.max(12, left);
      left = Math.min(left, screenWidth - tooltipWidth - 12);

      setTooltipPosition({
        top: y - 108,
        left: left
      });

      setTimeout(() => {
        setShowQuickAddHint(true);
      }, 300);

      await AsyncStorage.setItem("quickAddLongPressHintSeen", "true");

      setTimeout(() => {
        setShowQuickAddHint(false);
        setTooltipPosition(null);
      }, 5000);
    });
  }

  async function quickAdd(practice: Practice) {
    const count = practice.defaultSessionCount ?? 108;

    try {
      sessionService.addSession(practice.id, count);
    } catch (error: any) {
      alert(error.message);
    }

    await maybeShowQuickAddHint(practice.id);
  }

  function openEditDefaultModal(practiceId: string, practiceName: string, currentDefaultSession: number) {
    setSelectedPracticeId(practiceId);
    setSelectedPracticeName(practiceName);
    setDefaultSessionInput(String(currentDefaultSession));
    setEditDefaultOpen(true);
  }

  function openPracticeMenu(practice: Practice) {
    const target = practiceRowRefs.current[practice.id];
    if (!target) return;
    const practiceDisplayName =
      getPracticeDisplayName(practice.id, practice.name, t);

    (target as any).measureInWindow(
      (x: number, y: number, width: number, height: number) => {
        setMenuPractice({
          ...practice,
          name: practiceDisplayName,
        });
        setMenuAnchor({ x, y, width, height });
      }
    );
  }

  function closePracticeMenu() {
    setMenuPractice(null);
    setMenuAnchor(null);
  }

  function openDailyTargetPrompt(practice: Practice) {
    setDailyTargetPromptPractice({
      id: practice.id,
      name: getPracticeDisplayName(practice.id, practice.name, t),
    });
  }

  function closeDailyTargetPrompt() {
    setDailyTargetPromptPractice(null);
  }

  function saveDailyTarget(dailyTargetCount: number) {
    if (!dailyTargetPromptPractice) return;

    practiceService.updatePracticeDailyTargetCount(
      dailyTargetPromptPractice.id,
      dailyTargetCount
    );
    refreshDashboard();
  }

  function openPracticeCalendar(practice: Practice) {
    setCalendarPractice(practice);
    setCalendarData(sessionService.getCalendarDailyData(practice.id));
  }

  function closePracticeCalendar() {
    setCalendarPractice(null);
    setCalendarData([]);
  }

  function handleCalendarEdit(date: string, newValue: number) {
    if (!calendarPractice) return;

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
        calendarPractice.id,
        date,
        newValue
      );
      setCalendarData(
        sessionService.getCalendarDailyData(calendarPractice.id)
      );

      const latestPractice =
        dashboardService
          .getDashboardPractices()
          .find(practice => practice.id === calendarPractice.id);

      if (latestPractice) {
        setCalendarPractice(latestPractice);
      }

      refreshDashboard();
    } catch (error: any) {
      alert(error.message);
    }
  }

  const calendarStartDate = useMemo(
    () => calendarPractice
      ? appService.getCalendarStartDate(calendarPractice.id)
      : new Date(),
    [calendarPractice]
  );
  const calendarEndDate = useMemo(() => {
    if (!calendarPractice) return new Date();

    return (
      practiceService.getExpectedTargetDate(
        calendarPractice.targetCount,
        calendarPractice.total,
        calendarPractice.dailyTargetCount ?? null
      ) ?? new Date()
    );
  }, [calendarPractice]);

  function getPracticeCardViewModel(practice: Practice) {
    const practiceDisplayName =
      getPracticeDisplayName(practice.id, practice.name, t);
    const currentCycleProgress =
      practice.total >= practice.targetCount
        ? 1
        : (practice.total % practice.targetCount) / practice.targetCount;
    const dailyTargetCount = practice.dailyTargetCount ?? null;
    const hasDailyTarget =
      dailyTargetCount != null &&
      dailyTargetCount > 0;
    const targetDate =
      hasDailyTarget
        ? practiceService.getExpectedTargetDate(
          practice.targetCount,
          practice.total,
          dailyTargetCount
        )
        : null;
    const targetReached =
      practice.targetCount > 0 &&
      practice.total >= practice.targetCount;
    const expectedTargetDate =
      targetReached
        ? t("practice.reached")
        : !hasDailyTarget
          ? t("practice.setDailyTargetFirst")
          : targetDate
            ? formatMonthDayYear(targetDate, locale)
            : t("practice.noEstimate");

    return {
      practiceDisplayName,
      currentCycleProgress,
      dailyTargetCount,
      hasDailyTarget,
      targetReached,
      expectedTargetDate,
    };
  }

  function renderTotalProgressBar(practice: Practice, progress: number) {
    const label =
      `${t("practice.totalProgress")}: ${formatCountProgress(
        practice.total,
        practice.targetCount || null,
        locale
      )}`;

    return (
      <DashboardTotalProgressBar
        label={label}
        progress={progress}
      />
    );
  }

  function renderPracticeDragOverlay() {
    if (!dragOverlayPractice || !dragOverlayFrame) return null;

    const {
      practiceDisplayName,
      currentCycleProgress,
      dailyTargetCount,
      hasDailyTarget,
      targetReached,
      expectedTargetDate,
    } = getPracticeCardViewModel(dragOverlayPractice);
    const defaultSessionCount =
      dragOverlayPractice.defaultSessionCount ?? 108;

    return (
      <Animated.View
        pointerEvents="none"
        style={[
          styles.dragOverlayCard,
          {
            left: dragOverlayFrame.left,
            width: dragOverlayFrame.width,
            transform: [{ translateY: dragReorder.overlayTranslateY }],
          }
        ]}
      >
        <View
          style={[
            styles.card,
            cardThemeStyle,
            styles.cardDragging,
            styles.dragOverlaySurface,
          ]}
        >
          <View style={styles.cardContent}>
            <View style={styles.practiceNameRow}>
              <View style={styles.dragHandle}>
                <MaterialIcons
                  name="drag-indicator"
                  size={22}
                  color={themeColors.iconMuted}
                />
              </View>

              <Text
                numberOfLines={1}
                ellipsizeMode="tail"
                style={[styles.practiceName, textPrimaryStyle]}
              >
                {practiceDisplayName}
              </Text>

              <View style={styles.practiceActionButtons}>
                <View style={styles.practiceActionButton}>
                  <MaterialIcons
                    name="edit"
                    size={18}
                    color={themeColors.primary}
                  />
                </View>
                <View style={styles.practiceActionButton}>
                  <MaterialIcons
                    name="bar-chart"
                    size={18}
                    color={themeColors.primary}
                  />
                </View>
                <View style={styles.practiceActionButton}>
                  <MaterialIcons
                    name="calendar-today"
                    size={17}
                    color={themeColors.primary}
                  />
                </View>
                <View style={styles.practiceActionButton}>
                  <MaterialIcons
                    name="delete-outline"
                    size={18}
                    color={themeColors.destructive}
                  />
                </View>
              </View>
            </View>

            {renderTotalProgressBar(dragOverlayPractice, currentCycleProgress)}

            <View style={styles.practiceBodyRow}>
              <Image
                source={dragOverlayPractice.imageKey && practiceImages[dragOverlayPractice.imageKey] ? practiceImages[dragOverlayPractice.imageKey] : practiceImages["generic"]}
                style={styles.icon}
                resizeMode="contain"
              />

              <View style={styles.practiceMetricGroup}>
                <Text style={[styles.countText, textPrimaryStyle]}>
                  {t("practice.targetDate")}:{" "}
                  <Text style={targetReached ? { color: themeColors.primary } : undefined}>
                    {expectedTargetDate}
                  </Text>
                </Text>

                {hasDailyTarget ? (
                  <DailyGoalProgress
                    todayCount={dragOverlayPractice.today}
                    dailyTargetCount={dailyTargetCount ?? 0}
                    height={18}
                    style={styles.dailyGoalInline}
                    labelStyle={[
                      styles.countText,
                      styles.dailyGoalLabel,
                      textPrimaryStyle,
                    ]}
                    barStyle={styles.dailyGoalBar}
                    textStyle={styles.dailyGoalBarText}
                    labelNumberOfLines={1}
                  />
                ) : (
                  <View
                    style={[
                      styles.enableDailyTargetButton,
                      { borderColor: themeColors.borderStrong },
                    ]}
                  >
                    <MaterialIcons
                      name="check-circle-outline"
                      size={16}
                      color={themeColors.primary}
                    />
                    <Text
                      style={[
                        styles.enableDailyTargetText,
                        textPrimaryStyle,
                      ]}
                    >
                      {t("practice.enableDailyTarget")}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </View>

          <View style={styles.quickAddContainer}>
            <View style={[styles.quickAddButton, quickAddThemeStyle]}>
              <View style={styles.quickAddMainButton}>
                <Text style={[styles.quickAddAmountText, textPrimaryStyle]}>
                  +{formatNumber(defaultSessionCount, locale)}
                </Text>

                <Text
                  style={[styles.quickAddLabelText, textSecondaryStyle]}
                  numberOfLines={1}
                >
                  {t("practice.addDefaultSession")}
                </Text>
              </View>

              <View style={[styles.quickAddEditButton, quickAddDividerStyle]}>
                <MaterialIcons
                  name="edit"
                  size={15}
                  color={themeColors.primary}
                />
              </View>
            </View>
          </View>
        </View>
      </Animated.View>
    );
  }

  const renderedPractices = useMemo(
    () => getDragPreviewItems(practices, dragPreviewOrderIds),
    [dragPreviewOrderIds, practices]
  );

  if (!dashboardLoaded) {
    return (
      <View
        ref={dragReorder.rootRef}
        style={[
          styles.dashboardRoot,
          { backgroundColor: themeColors.background },
        ]}
        onLayout={() => dragReorder.updateRootWindowMetrics()}
      >
        <View style={[globalStyles.screen, styles.dashboardLoadingContainer]}>
          <ActivityIndicator size="large" color={themeColors.primary} />
        </View>

        <WelcomeModal
          visible={welcomeOpen}
          onClose={() => setWelcomeOpen(false)}
        />
      </View>
    );
  }

  return (

    <View
      ref={dragReorder.rootRef}
      style={[
        styles.dashboardRoot,
        { backgroundColor: themeColors.background },
      ]}
      onLayout={() => dragReorder.updateRootWindowMetrics()}
    >
      <ScrollView
        ref={dragReorder.scrollViewRef}
        style={[
          globalStyles.screen,
          { backgroundColor: themeColors.background },
        ]}
        contentContainerStyle={{ paddingBottom: dashboardBottomPadding }}
        scrollEnabled={draggingPracticeId === null}
        scrollEventThrottle={16}
        onScroll={(event) => {
          dragReorder.setScrollY(event.nativeEvent.contentOffset.y);
        }}
        onContentSizeChange={(_width, height) => {
          dragReorder.setScrollContentHeight(height);
        }}
        onLayout={(event) => {
          dragReorder.handleScrollViewLayout(
            event.nativeEvent.layout.height
          );
        }}
      >
        <View
          ref={dragReorder.contentRef}
          style={{
            width: "100%",
            maxWidth: 700,
            alignSelf: "center"
          }}
          onLayout={(event) => {
            dragReorder.handleContentLayout(
              event.nativeEvent.layout.x
            );
          }}
        >
          <View style={styles.streakContainer}>
            <View
              style={[
                styles.streakBadge,
                cardThemeStyle,
              ]}
            >
              <View
                style={[
                  styles.streakFireIconBox,
                  { backgroundColor: themeColors.surfaceSelected },
                ]}
              >
                <MaterialIcons
                  name="local-fire-department"
                  size={streakFireSize}
                  color={themeColors.primary}
                />
              </View>

              <Text style={[styles.streakText, textPrimaryStyle]}>
                {t("dashboard.streak", {
                  count: streak,
                  unit: streak === 1
                    ? t("dashboard.streakDay")
                    : t("dashboard.streakDays"),
                })}
              </Text>

              <Pressable
                onPress={() => setInfoOpen(true)}
                style={styles.streakInfoButton}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <MaterialIcons
                  name="info-outline"
                  size={18}
                  color={themeColors.iconMuted}
                />
              </Pressable>
            </View>
          </View>
          {renderedPractices.map((practice) => {

            const {
              practiceDisplayName,
              currentCycleProgress,
              dailyTargetCount,
              hasDailyTarget,
              targetReached,
              expectedTargetDate,
            } = getPracticeCardViewModel(practice);
            return (

              <Reanimated.View
                key={practice.id}
                layout={draggingPracticeId ? practiceCardLayoutTransition : undefined}
                ref={(node) => {
                  dragReorder.cardRefs[practice.id] =
                    node as unknown as View | null;
                }}
                style={[
                  styles.card,
                  cardThemeStyle,
                  draggingPracticeId === practice.id &&
                  styles.cardDraggingPlaceholder,
                ]}
                onLayout={(event) => {
                  dragReorder.setCardLayout(practice.id, {
                    x: event.nativeEvent.layout.x,
                    y: event.nativeEvent.layout.y,
                    width: event.nativeEvent.layout.width,
                    height: event.nativeEvent.layout.height,
                  });
                }}
              >
                <TouchableOpacity
                  onPress={() => {
                    if (dragReorder.isPressSuppressed()) return;

                    router.push({
                      pathname: "/practice",
                      params: {
                        id: practice.id
                      }
                    });
                  }}
                  onLongPress={() => openPracticeMenu(practice)}
                  delayLongPress={350}
                  accessibilityHint={t("dashboard.infoLongPressPractice")}
                >

                  <View
                    ref={(node) => {
                      practiceRowRefs.current[practice.id] = node;
                    }}
                    style={styles.cardContent}
                  >
                    <View style={styles.practiceNameRow}>
                      <View
                        style={styles.dragHandle}
                        {...dragReorder.getPanHandlers(practice.id)}
                        accessibilityRole="adjustable"
                        accessibilityLabel={`${t("dashboard.reorderPractice")}: ${practiceDisplayName}`}
                      >
                        <MaterialIcons
                          name="drag-indicator"
                          size={22}
                          color={themeColors.iconMuted}
                        />
                      </View>

                      <Text
                        numberOfLines={1}
                        ellipsizeMode="tail"
                        style={[styles.practiceName, textPrimaryStyle]}
                      >
                        {practiceDisplayName}
                      </Text>

                      <View style={styles.practiceActionButtons}>
                        <Pressable
                          style={({ pressed }) => [
                            styles.practiceActionButton,
                            pressed && styles.practiceActionButtonPressed
                          ]}
                          onPress={(event) => {
                            event.stopPropagation();
                            practiceActions.editPractice({
                              ...practice,
                              name: practiceDisplayName,
                            });
                          }}
                          hitSlop={6}
                          accessibilityRole="button"
                          accessibilityLabel={`${t("practiceMenu.edit")}: ${practiceDisplayName}`}
                        >
                          <MaterialIcons
                            name="edit"
                            size={18}
                            color={themeColors.primary}
                          />
                        </Pressable>

                        <Pressable
                          style={({ pressed }) => [
                            styles.practiceActionButton,
                            pressed && styles.practiceActionButtonPressed
                          ]}
                          onPress={(event) => {
                            event.stopPropagation();
                            practiceActions.openPracticeHistory({
                              ...practice,
                              name: practiceDisplayName,
                            });
                          }}
                          hitSlop={6}
                          accessibilityRole="button"
                          accessibilityLabel={`${t("practiceMenu.history")}: ${practiceDisplayName}`}
                        >
                          <MaterialIcons
                            name="bar-chart"
                            size={18}
                            color={themeColors.primary}
                          />
                        </Pressable>

                        <Pressable
                          style={({ pressed }) => [
                            styles.practiceActionButton,
                            pressed && styles.practiceActionButtonPressed
                          ]}
                          onPress={(event) => {
                            event.stopPropagation();
                            openPracticeCalendar(practice);
                          }}
                          hitSlop={6}
                          accessibilityRole="button"
                          accessibilityLabel={`${t("practiceMenu.calendar")}: ${practiceDisplayName}`}
                        >
                          <MaterialIcons
                            name="calendar-today"
                            size={17}
                            color={themeColors.primary}
                          />
                        </Pressable>

                        <Pressable
                          style={({ pressed }) => [
                            styles.practiceActionButton,
                            pressed && styles.practiceDeleteButtonPressed
                          ]}
                          onPress={(event) => {
                            event.stopPropagation();
                            practiceActions.confirmDeletePractice({
                              ...practice,
                              name: practiceDisplayName,
                            });
                          }}
                          hitSlop={6}
                          accessibilityRole="button"
                          accessibilityLabel={`${t("practiceMenu.delete")}: ${practiceDisplayName}`}
                        >
                          <MaterialIcons
                            name="delete-outline"
                            size={18}
                            color={themeColors.destructive}
                          />
                        </Pressable>
                      </View>
                    </View>

                    {renderTotalProgressBar(practice, currentCycleProgress)}

                    <View style={styles.practiceBodyRow}>
                      <Image
                        source={practice.imageKey && practiceImages[practice.imageKey] ? practiceImages[practice.imageKey] : practiceImages["generic"]}
                        style={styles.icon}
                        resizeMode="contain"
                      />

                      <View style={styles.practiceMetricGroup}>
                        <View style={styles.targetDateRow}>
                          {isCelebrating(practice.id) && (
                            <CelebrationOverlay
                              fade={celebrationFade}
                              sparkle1={sparkle1}
                              sparkle2={sparkle2}
                              sparkle3={sparkle3}
                            />
                          )}
                          <Text style={[styles.countText, textPrimaryStyle]}>
                            {t("practice.targetDate")}:{" "}
                            <Text style={targetReached ? { color: themeColors.primary } : undefined}>
                              {expectedTargetDate}
                            </Text>
                          </Text>

                          {targetReached && isCelebrating(practice.id) && (
                            <Animated.Text
                              style={[
                                styles.congratsText,
                                { opacity: celebrationFade }
                              ]}
                            >
                              {t("dashboard.congratulations")}
                            </Animated.Text>
                          )}
                        </View>

                        {hasDailyTarget ? (
                          <DailyGoalProgress
                            todayCount={practice.today}
                            dailyTargetCount={dailyTargetCount ?? 0}
                            height={18}
                            style={styles.dailyGoalInline}
                            labelStyle={[
                              styles.countText,
                              styles.dailyGoalLabel,
                              textPrimaryStyle,
                            ]}
                            barStyle={styles.dailyGoalBar}
                            textStyle={styles.dailyGoalBarText}
                            labelNumberOfLines={1}
                          />
                        ) : (
                          <EnableDailyTargetButton
                            onPress={() => openDailyTargetPrompt(practice)}
                            accessibilityLabel={`${t("practice.enableDailyTarget")}: ${practiceDisplayName}`}
                          />
                        )}
                      </View>
                    </View>
                  </View>

                </TouchableOpacity>

                <View
                  ref={(node) => {
                    quickAddRefs.current[practice.id] = node;
                  }}
                  style={styles.quickAddContainer}
                >
                  <View style={[styles.quickAddButton, quickAddThemeStyle]}>
                    <Pressable
                      style={({ pressed }) => [
                        styles.quickAddMainButton,
                        pressed && styles.quickAddButtonPressed
                      ]}
                      onPress={(event) => {
                        event.stopPropagation();
                        void quickAdd(practice);
                      }}
                      onLongPress={(event) => {
                        event.stopPropagation();
                        openEditDefaultModal(
                          practice.id,
                          practiceDisplayName,
                          practice.defaultSessionCount ?? 108
                        );
                      }}
                      delayLongPress={350}
                      accessibilityRole="button"
                      accessibilityLabel={`${t("practice.addDefaultSessionA11y", {
                        count: formatNumber(
                          practice.defaultSessionCount ?? 108,
                          locale
                        ),
                      })}: ${practiceDisplayName}`}
                    >
                      <Text style={[styles.quickAddAmountText, textPrimaryStyle]}>
                        +{formatNumber(
                          practice.defaultSessionCount ?? 108,
                          locale
                        )}
                      </Text>

                      <Text
                        style={[styles.quickAddLabelText, textSecondaryStyle]}
                        numberOfLines={1}
                      >
                        {t("practice.addDefaultSession")}
                      </Text>
                    </Pressable>

                    <Pressable
                      style={({ pressed }) => [
                        styles.quickAddEditButton,
                        quickAddDividerStyle,
                        pressed && styles.quickAddEditButtonPressed
                      ]}
                      onPress={(event) => {
                        event.stopPropagation();
                        openEditDefaultModal(
                          practice.id,
                          practiceDisplayName,
                          practice.defaultSessionCount ?? 108
                        );
                      }}
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel={`${t("practice.editDefaultSessionCount")}: ${practiceDisplayName}`}
                    >
                      <MaterialIcons
                        name="edit"
                        size={15}
                        color={themeColors.primary}
                      />
                    </Pressable>
                  </View>
                </View>

              </Reanimated.View>

            );
          })}

          <Pressable
            style={({ pressed }) => [
              styles.addPracticeCard,
              { borderColor: themeColors.primary },
              pressed && styles.addPracticeCardPressed
            ]}
            onPress={() => router.push("/add-practice")}
            accessibilityRole="button"
            accessibilityLabel={t("dashboard.addPractice")}
          >
            <View
              style={[
                styles.addPracticeCircle,
                { borderColor: themeColors.primary },
              ]}
            >
              <MaterialIcons
                name="add"
                size={22}
                color={themeColors.primary}
              />
            </View>

            <View style={styles.addPracticeTextWrapper}>
              <Text style={[styles.addPracticeText, textPrimaryStyle]}>
                {t("dashboard.addPractice")}
              </Text>
            </View>
          </Pressable>

          <QuickAddEditor
            visible={editDefaultOpen}
            practiceId={selectedPracticeId}
            practiceName={selectedPracticeName}
            defaultValue={Number(defaultSessionInput)}
            onClose={() => setEditDefaultOpen(false)}
          />

          <PracticeActionsMenu
            visible={menuPractice !== null}
            anchor={menuAnchor}
            practice={menuPractice}
            onClose={closePracticeMenu}
            onDeleted={refreshDashboard}
            onCalendar={(practice) => {
              const latestPractice =
                practicesRef.current.find(row => row.id === practice.id);

              if (latestPractice) {
                openPracticeCalendar(latestPractice);
              }
            }}
          />

          {practiceActions.historyPractice && (
            <PracticeHistoryModal
              visible
              onClose={practiceActions.closePracticeHistory}
              practiceId={practiceActions.historyPractice.id}
              total={practiceActions.historyPractice.total}
            />
          )}

          <DailyTargetEditor
            visible={dailyTargetPromptPractice !== null}
            practiceName={dailyTargetPromptPractice?.name}
            onClose={closeDailyTargetPrompt}
            onSave={saveDailyTarget}
          />

          <PracticeCalendarModal
            visible={calendarPractice !== null}
            data={calendarData}
            startDate={calendarStartDate}
            endDate={calendarEndDate}
            onEditDay={handleCalendarEdit}
            onClose={closePracticeCalendar}
          />

          {showQuickAddHint && tooltipPosition && (
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={() => {
                setShowQuickAddHint(false);
                setTooltipPosition(null);
              }}
            >
              <View
                style={[
                  styles.anchoredTooltip,
                  { backgroundColor: themeColors.tooltipBackground },
                  {
                    top: tooltipPosition.top,
                    left: tooltipPosition.left,
                  }
                ]}
              >
                <Text
                  style={[
                    styles.anchoredTooltipText,
                    { color: themeColors.background },
                  ]}
                >
                  {t("dashboard.quickAddTip")}
                </Text>
              </View>
            </Pressable>
          )}

          <Modal
            visible={infoOpen}
            transparent
            animationType="fade"
            onRequestClose={() => setInfoOpen(false)}
          >
            <Pressable
              style={[
                styles.infoOverlay,
                { backgroundColor: themeColors.overlay },
              ]}
              onPress={() => setInfoOpen(false)}
            >
              <Pressable
                style={[
                  styles.infoModal,
                  {
                    backgroundColor: themeColors.surfaceElevated,
                    borderColor: themeColors.borderSubtle,
                  },
                ]}
                onPress={() => { }}
              >
                <Text style={[styles.infoTitle, textPrimaryStyle]}>
                  {t("dashboard.infoTitle")}
                </Text>

                <Text style={[styles.infoText, textSecondaryStyle]}>
                  {t("dashboard.infoStreak")}
                </Text>

                <Text style={[styles.infoText, textSecondaryStyle]}>
                  {t("dashboard.infoLongPressPractice")}
                </Text>

                <Pressable
                  style={styles.infoButton}
                  onPress={() => setInfoOpen(false)}
                >
                  <Text
                    style={[
                      styles.infoButtonText,
                      { color: themeColors.primary },
                    ]}
                  >
                    {t("common.ok")}
                  </Text>
                </Pressable>

              </Pressable>
            </Pressable>
          </Modal>

        </View>
        <WelcomeModal
          visible={welcomeOpen}
          onClose={() => setWelcomeOpen(false)}
        />
      </ScrollView>

      {renderPracticeDragOverlay()}
    </View>
  );
}

const screenWidth = Dimensions.get("window").width;
const iconSize = screenWidth < 360 ? 56 : 66;
const addPracticeCardHeight = Math.round(iconSize);
const styles = StyleSheet.create({

  dashboardRoot: {
    flex: 1,
  },

  dashboardLoadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  title: {
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 30,
  },

  card: {
    marginBottom: 18,
    position: "relative",
    marginHorizontal: 6,
    padding: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E1E7F5",
    backgroundColor: "#FAFBFF",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 7,
    shadowOffset: {
      width: 0,
      height: 3,
    },
    elevation: 2,
  },

  cardDragging: {
    opacity: 0.96,
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 7,
    zIndex: 10,
  },

  cardDraggingPlaceholder: {
    opacity: 0,
  },

  dragOverlayCard: {
    position: "absolute",
    top: 0,
    zIndex: 1000,
    elevation: 12,
  },

  dragOverlaySurface: {
    marginBottom: 0,
    marginHorizontal: 0,
  },

  dragHandle: {
    width: 24,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 2,
  },

  addPracticeCard: {
    minHeight: addPracticeCardHeight,
    marginBottom: 25,
    marginHorizontal: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: "transparent",
    justifyContent: "center",
    paddingVertical: 16,
    paddingHorizontal: 18,
  },

  addPracticeCardPressed: {
    opacity: 0.72,
  },

  addPracticeCircle: {
    position: "absolute",
    left: 18,
    width: addPracticeCardHeight * .8,
    height: addPracticeCardHeight * .8,
    borderRadius: addPracticeCardHeight / 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: colors.primary,
  },

  addPracticeTextWrapper: {
    alignItems: "center",
  },

  addPracticeText: {
    fontSize: 18,
    color: "#111",
    textAlign: "center",
  },

  practiceName: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111",
    flex: 1,
  },

  practiceNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },

  practiceActionButtons: {
    flexDirection: "row",
    alignItems: "center",
  },

  practiceActionButton: {
    width: 25.5,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },

  practiceActionButtonPressed: {
    backgroundColor: "#eef2ff",
  },

  practiceDeleteButtonPressed: {
    backgroundColor: "#ffebee",
  },

  countText: {
    fontSize: 14,
    fontWeight: "400",
    color: "#222",
  },

  practiceMetricGroup: {
    flex: 1,
    alignSelf: "stretch",
    justifyContent: "space-around",
    gap: 4,
    minWidth: 0,
  },

  practiceMetricGroupNoImage: {
    marginBottom: 10,
  },

  enableDailyTargetButton: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 7,
    paddingVertical: 4,
    paddingHorizontal: 9,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#BFDBFE",
    backgroundColor: "transparent",
  },

  enableDailyTargetText: {
    fontSize: 14,
    fontWeight: "400",
    color: "#111",
  },

  quickAddContainer: {
    marginTop: 12,
    alignSelf: "stretch",
  },

  cardContent: {
    gap: 10,
  },

  totalProgressTrack: {
    alignSelf: "stretch",
    width: "100%",
    position: "relative",
    height: DASHBOARD_PROGRESS_BAR_HEIGHT,
    borderRadius: DASHBOARD_PROGRESS_BAR_HEIGHT / 2,
    backgroundColor: "#E8EDF7",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    overflow: "hidden",
  },

  totalProgressFill: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: colors.primary,
    borderRadius: DASHBOARD_PROGRESS_BAR_HEIGHT / 2,
  },

  totalProgressText: {
    flex: 1,
    paddingHorizontal: 8,
    color: "#111827",
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
    includeFontPadding: false,
    transform: [{ translateY: 2 }],
  },

  totalProgressTextFull: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },

  totalProgressFilledTextClip: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    overflow: "hidden",
  },

  totalProgressTextFilled: {
    color: "white",
  },

  practiceBodyRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },

  icon: {
    width: iconSize,
    height: iconSize,
    borderRadius: 12,
  },

  dailyGoalInline: {
    alignSelf: "stretch",
    alignItems: "center",
    width: "100%",
  },

  dailyGoalLabel: {
    flexShrink: 1,
    maxWidth: "48%",
  },

  dailyGoalBar: {
    flex: 1,
    minWidth: 94,
    maxWidth: "100%",
  },

  dailyGoalBarText: {
    fontSize: 14,
  },

  quickAddButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EEF2FF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#DBE4FF",
    overflow: "hidden",
  },

  quickAddMainButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },

  quickAddAmountText: {
    fontSize: 16,
    fontWeight: "800",
    color: "#111",
  },

  quickAddLabelText: {
    flexShrink: 1,
    fontSize: 13,
    fontWeight: "600",
    color: "#333",
  },

  quickAddEditButton: {
    width: 40,
    minHeight: 40,
    alignSelf: "stretch",
    alignItems: "center",
    justifyContent: "center",
    borderLeftWidth: 1,
    borderLeftColor: "#DBE4FF",
  },

  quickAddButtonPressed: {
    opacity: 0.65,
  },

  quickAddEditButtonPressed: {
    backgroundColor: "#DBE4FF",
  },

  tooltipOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "flex-start",
    alignItems: "center",
    paddingTop: 80,
  },

  tooltipBox: {
    backgroundColor: "#111",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    maxWidth: 280,
  },

  tooltipText: {
    color: "white",
    fontSize: 13,
    textAlign: "center",
  },

  anchoredTooltip: {
    position: "absolute",
    width: 240,
    backgroundColor: "#111",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    zIndex: 1000,
  },

  anchoredTooltipText: {
    color: "white",
    fontSize: 13,
    textAlign: "center",
  },

  targetDateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },

  congratsText: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: "700",
    marginTop: 2,
  },

  celebrationOverlay: {
    position: "absolute",
    top: -6,
    left: 0,
    right: 0,
    height: 24,
    pointerEvents: "none",
    zIndex: 20,
  },

  streakText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#111",
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
    maxWidth: 360,
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

  streakContainer: {
    alignItems: "center",
    marginBottom: 20
  },

  streakBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: "#FAFBFF",
    paddingLeft: 7,
    paddingRight: 8,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#DBE4FF",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 7,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },

  streakFireIconBox: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EEF2FF",
  },

  streakInfoButton: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },

});
