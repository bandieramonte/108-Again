import { subscribeData } from "@/utils/events";
import { MaterialIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Animated, Dimensions, Image, LayoutAnimation, Modal, PanResponder, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, UIManager, View } from "react-native";
import * as Progress from "react-native-progress";
import CelebrationOverlay from "../components/CelebrationOverlay";
import DailyGoalProgress from "../components/DailyGoalProgress";
import PracticeActionsMenu, {
  type PracticeMenuAnchor,
} from "../components/PracticeActionsMenu";
import PracticeHistoryModal from "../components/PracticeHistoryModal";
import QuickAddEditor from "../components/QuickAddEditor";
import WelcomeModal from "../components/WelcomeModal";
import { practiceImages } from "../constants/practiceImages";
import { usePracticeActions } from "../hooks/usePracticeActions";
import { useReachedCelebration } from "../hooks/useReachedCelebration";
import { useI18n } from "../i18n";
import { getPracticeDisplayName } from "../i18n/practiceNames";
import * as dashboardService from "../services/dashboardService";
import * as practiceService from "../services/practiceService";
import * as sessionService from "../services/sessionService";
import { colors, containers } from "../styles/theme";
import { formatMonthDayYear } from "../utils/dateUtils";
import { digitsOnly, formatCountProgress, formatNumber, MAX_REPETITIONS_PER_DAY, validateRepetitionCount } from "../utils/numberUtils";

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

type CardLayout = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type DragOverlayFrame = {
  left: number;
  width: number;
};

const MAX_STREAK_FIRE_DAYS = 365;
const MIN_STREAK_FIRE_SIZE = 5;
const MAX_STREAK_FIRE_SIZE = 26;
const STREAK_FIRE_GROWTH_EXPONENT = 1.4;
const DRAG_AUTO_SCROLL_EDGE = 96;
const DRAG_AUTO_SCROLL_SPEED_PER_SECOND = 360;
const DRAG_AUTO_SCROLL_MAX_FRAME_MS = 32;
const DRAG_REORDER_ANIMATION_MS = 150;
const DRAG_RELEASE_ANIMATION_MS = 120;

function isReactNativeNewArchitectureEnabled() {
  return Boolean(
    (globalThis as any).nativeFabricUIManager ||
    (globalThis as any).RN$Bridgeless
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
  const { locale, t } = useI18n();
  const [practices, setPractices] = useState<Practice[]>([]);
  const [streak, setStreak] = useState(0);

  const [editDefaultOpen, setEditDefaultOpen] = useState(false);
  const [selectedPracticeId, setSelectedPracticeId] = useState<string | null>(null);
  const [selectedPracticeName, setSelectedPracticeName] = useState("");
  const [defaultSessionInput, setDefaultSessionInput] = useState("");
  const [dailyTargetPromptPractice, setDailyTargetPromptPractice] =
    useState<{ id: string; name: string } | null>(null);
  const [dailyTargetInput, setDailyTargetInput] = useState("");
  const [showQuickAddHint, setShowQuickAddHint] = useState(false);
  const scrollViewRef = useRef<ScrollView | null>(null);
  const scrollYRef = useRef(0);
  const scrollViewWindowYRef = useRef(0);
  const scrollViewHeightRef = useRef(0);
  const scrollContentHeightRef = useRef(0);
  const dashboardContentXRef = useRef(0);
  const quickAddRefs = useRef<Record<string, View | null>>({});
  const practiceRowRefs = useRef<Record<string, View | null>>({});
  const practiceCardLayoutsRef = useRef<Record<string, CardLayout>>({});
  const dragStartLayoutsRef = useRef<Record<string, CardLayout>>({});
  const dragPanHandlersRef = useRef<Record<string, any>>({});
  const dragAutoScrollFrameRef = useRef<number | null>(null);
  const dragAutoScrollLastTimestampRef = useRef<number | null>(null);
  const dragStartScrollYRef = useRef(0);
  const dragStartOverlayTopRef = useRef<number | null>(null);
  const dragLatestDyRef = useRef(0);
  const dragLatestMoveYRef = useRef<number | null>(null);
  const dragVisualTopYRef = useRef<number | null>(null);
  const dragOverlayTranslateY = useRef(new Animated.Value(0)).current;
  const practicesRef = useRef<Practice[]>([]);
  const draggingPracticeIdRef = useRef<string | null>(null);
  const dragStartLayoutRef = useRef<CardLayout | null>(null);
  const dragStartOrderRef = useRef<string[]>([]);
  const dragMovedRef = useRef(false);
  const suppressCardPressRef = useRef(false);
  const [draggingPracticeId, setDraggingPracticeId] = useState<string | null>(null);
  const [dragOverlayPractice, setDragOverlayPractice] = useState<Practice | null>(null);
  const [dragOverlayFrame, setDragOverlayFrame] = useState<DragOverlayFrame | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState<{ top: number; left: number } | null>(null);
  const [menuPractice, setMenuPractice] = useState<Practice | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<PracticeMenuAnchor | null>(null);
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

  useFocusEffect(
    useCallback(() => {
      scheduleDashboardRefresh();
    }, [scheduleDashboardRefresh])
  );

  useEffect(() => {
    practicesRef.current = practices;
  }, [practices]);

  useEffect(() => {
    if (
      Platform.OS === "android" &&
      !isReactNativeNewArchitectureEnabled() &&
      UIManager.setLayoutAnimationEnabledExperimental
    ) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (dragAutoScrollFrameRef.current != null) {
        cancelAnimationFrame(dragAutoScrollFrameRef.current);
        dragAutoScrollFrameRef.current = null;
      }
    };
  }, []);

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

  function samePracticeOrder(left: Practice[], right: Practice[]) {
    if (left.length !== right.length) return false;

    return left.every((practice, index) => practice.id === right[index]?.id);
  }

  function reorderPracticeList(
    list: Practice[],
    practiceId: string,
    insertIndex: number
  ) {
    const draggedPractice =
      list.find(practice => practice.id === practiceId);

    if (!draggedPractice) return list;

    const withoutDragged =
      list.filter(practice => practice.id !== practiceId);
    const clampedIndex =
      Math.max(0, Math.min(insertIndex, withoutDragged.length));
    const next = [...withoutDragged];

    next.splice(clampedIndex, 0, draggedPractice);

    return next;
  }

  function updateScrollViewWindowMetrics() {
    (scrollViewRef.current as any)?.measureInWindow?.(
      (_x: number, y: number, _width: number, height: number) => {
        scrollViewWindowYRef.current = y;

        if (height > 0) {
          scrollViewHeightRef.current = height;
        }
      }
    );
  }

  function getMaxScrollY() {
    return Math.max(
      0,
      scrollContentHeightRef.current - scrollViewHeightRef.current
    );
  }

  function getDragAutoScrollDirection(moveY: number) {
    const top = scrollViewWindowYRef.current;
    const height =
      scrollViewHeightRef.current ||
      Dimensions.get("window").height;
    const bottom = top + height;
    const topDistance = moveY - top;
    const bottomDistance = bottom - moveY;

    if (topDistance < DRAG_AUTO_SCROLL_EDGE) {
      return -1;
    }

    if (bottomDistance < DRAG_AUTO_SCROLL_EDGE) {
      return 1;
    }

    return 0;
  }

  function stopDragAutoScroll() {
    if (dragAutoScrollFrameRef.current == null) return;

    cancelAnimationFrame(dragAutoScrollFrameRef.current);
    dragAutoScrollFrameRef.current = null;
    dragAutoScrollLastTimestampRef.current = null;
  }

  function runDragAutoScrollStep(timestamp: number) {
    const practiceId = draggingPracticeIdRef.current;
    const moveY = dragLatestMoveYRef.current;

    if (!practiceId || moveY == null) {
      dragAutoScrollFrameRef.current = null;
      dragAutoScrollLastTimestampRef.current = null;
      return;
    }

    const direction = getDragAutoScrollDirection(moveY);

    if (direction === 0) {
      dragAutoScrollFrameRef.current = null;
      dragAutoScrollLastTimestampRef.current = null;
      return;
    }

    const lastTimestamp =
      dragAutoScrollLastTimestampRef.current ?? timestamp;
    const elapsedMs = Math.min(
      DRAG_AUTO_SCROLL_MAX_FRAME_MS,
      Math.max(0, timestamp - lastTimestamp)
    );

    dragAutoScrollLastTimestampRef.current = timestamp;

    if (elapsedMs > 0) {
      const scrollDelta =
        direction *
        DRAG_AUTO_SCROLL_SPEED_PER_SECOND *
        (elapsedMs / 1000);
      const maxScrollY = getMaxScrollY();
      const nextScrollY = Math.round(
        Math.max(
          0,
          Math.min(maxScrollY, scrollYRef.current + scrollDelta)
        )
      );

      if (nextScrollY !== scrollYRef.current) {
        scrollYRef.current = nextScrollY;
        updatePracticeDragPosition(
          practiceId,
          dragLatestDyRef.current
        );
        scrollViewRef.current?.scrollTo({
          y: nextScrollY,
          animated: false,
        });
      }
    }

    if (draggingPracticeIdRef.current) {
      dragAutoScrollFrameRef.current = requestAnimationFrame(
        runDragAutoScrollStep
      );
    } else {
      dragAutoScrollFrameRef.current = null;
      dragAutoScrollLastTimestampRef.current = null;
    }
  }

  function startDragAutoScroll() {
    if (dragAutoScrollFrameRef.current != null) return;

    dragAutoScrollLastTimestampRef.current = null;
    dragAutoScrollFrameRef.current = requestAnimationFrame(
      runDragAutoScrollStep
    );
  }

  function configureDragReorderAnimation() {
    LayoutAnimation.configureNext({
      duration: DRAG_REORDER_ANIMATION_MS,
      update: {
        type: LayoutAnimation.Types.easeInEaseOut,
      },
    });
  }

  function setDraggedOverlayTop(top: number) {
    dragOverlayTranslateY.setValue(top);
  }

  function updateDraggedVisualPosition(practiceId: string, dy: number) {
    if (draggingPracticeIdRef.current !== practiceId) return;

    const startLayout = dragStartLayoutRef.current;

    if (!startLayout) return;

    const startOverlayTop = dragStartOverlayTopRef.current;

    if (startOverlayTop != null) {
      setDraggedOverlayTop(startOverlayTop + dy);
    }

    const scrollDelta =
      scrollYRef.current - dragStartScrollYRef.current;
    dragVisualTopYRef.current =
      startLayout.y +
      dy +
      scrollDelta;
  }

  function beginPracticeDrag(practiceId: string) {
    const layoutSnapshot = { ...practiceCardLayoutsRef.current };
    const startLayout = layoutSnapshot[practiceId] ?? null;
    const draggedPractice =
      practicesRef.current.find(practice => practice.id === practiceId) ??
      null;

    if (!startLayout || !draggedPractice) return;

    updateScrollViewWindowMetrics();
    dragOverlayTranslateY.stopAnimation();
    draggingPracticeIdRef.current = practiceId;
    dragStartLayoutsRef.current = layoutSnapshot;
    dragStartLayoutRef.current = startLayout;
    dragStartOrderRef.current =
      practicesRef.current.map(practice => practice.id);
    dragStartScrollYRef.current = scrollYRef.current;
    dragStartOverlayTopRef.current = startLayout.y - scrollYRef.current;
    dragLatestDyRef.current = 0;
    dragLatestMoveYRef.current = null;
    dragAutoScrollLastTimestampRef.current = null;
    dragMovedRef.current = false;
    suppressCardPressRef.current = true;
    dragVisualTopYRef.current = startLayout?.y ?? null;
    setDraggedOverlayTop(dragStartOverlayTopRef.current);
    setDragOverlayPractice(draggedPractice);
    setDragOverlayFrame({
      left: dashboardContentXRef.current + startLayout.x,
      width: startLayout.width,
    });
    setDraggingPracticeId(practiceId);
  }

  function updatePracticeDragPosition(practiceId: string, dy: number) {
    if (draggingPracticeIdRef.current !== practiceId) return;

    const startLayout = dragStartLayoutRef.current;

    if (!startLayout) return;

    updateDraggedVisualPosition(practiceId, dy);

    const nextVisualTopY = dragVisualTopYRef.current;
    if (nextVisualTopY == null) return;

    const draggedCenterY = nextVisualTopY + startLayout.height / 2;
    const currentPractices = practicesRef.current;
    const startOrder = dragStartOrderRef.current;
    const startLayouts = dragStartLayoutsRef.current;
    let insertIndex = 0;

    for (const orderedPracticeId of startOrder) {
      if (orderedPracticeId === practiceId) continue;

      const layout = startLayouts[orderedPracticeId];
      if (!layout) continue;

      if (draggedCenterY > layout.y + layout.height / 2) {
        insertIndex += 1;
      }
    }

    const nextPractices =
      reorderPracticeList(
        currentPractices,
        practiceId,
        insertIndex
      );

    if (samePracticeOrder(currentPractices, nextPractices)) return;

    practicesRef.current = nextPractices;
    configureDragReorderAnimation();
    setPractices(nextPractices);
  }

  function movePracticeDrag(
    practiceId: string,
    dy: number,
    moveY: number
  ) {
    if (draggingPracticeIdRef.current !== practiceId) return;

    dragLatestDyRef.current = dy;
    dragLatestMoveYRef.current = moveY;

    if (Math.abs(dy) > 4) {
      dragMovedRef.current = true;
    }

    updatePracticeDragPosition(practiceId, dy);

    if (getDragAutoScrollDirection(moveY) === 0) {
      stopDragAutoScroll();
    } else {
      startDragAutoScroll();
    }
  }

  function finishPracticeDrag() {
    const draggedPracticeId = draggingPracticeIdRef.current;
    const moved = dragMovedRef.current;
    const startOrder = dragStartOrderRef.current;
    const nextOrder =
      practicesRef.current.map(practice => practice.id);
    const orderChanged =
      startOrder.length === nextOrder.length &&
      startOrder.some((practiceId, index) => practiceId !== nextOrder[index]);

    draggingPracticeIdRef.current = null;
    stopDragAutoScroll();
    dragStartLayoutsRef.current = {};
    dragStartLayoutRef.current = null;
    dragStartOrderRef.current = [];
    dragStartScrollYRef.current = 0;
    dragStartOverlayTopRef.current = null;
    dragLatestDyRef.current = 0;
    dragLatestMoveYRef.current = null;
    dragMovedRef.current = false;
    dragVisualTopYRef.current = null;
    const finalLayout =
      draggedPracticeId
        ? practiceCardLayoutsRef.current[draggedPracticeId]
        : null;
    const releaseTop =
      finalLayout
        ? finalLayout.y - scrollYRef.current
        : 0;

    Animated.timing(dragOverlayTranslateY, {
      toValue: releaseTop,
      duration: DRAG_RELEASE_ANIMATION_MS,
      useNativeDriver: true,
    }).start(() => {
      setDraggingPracticeId(null);
      setDragOverlayPractice(null);
      setDragOverlayFrame(null);
    });

    setTimeout(() => {
      suppressCardPressRef.current = false;
    }, 120);

    if (!draggedPracticeId || !moved || !orderChanged) return;

    try {
      practiceService.reorderPractices(nextOrder);
    } catch (error: any) {
      alert(error.message);
      refreshDashboard();
    }
  }

  function createDragPanHandlers(practiceId: string) {
    if (!dragPanHandlersRef.current[practiceId]) {
      dragPanHandlersRef.current[practiceId] =
        PanResponder.create({
          onStartShouldSetPanResponder: () => true,
          onStartShouldSetPanResponderCapture: () => true,
          onMoveShouldSetPanResponder: () => true,
          onMoveShouldSetPanResponderCapture: () => true,
          onPanResponderGrant: () => beginPracticeDrag(practiceId),
          onPanResponderMove: (_, gestureState) =>
            movePracticeDrag(
              practiceId,
              gestureState.dy,
              gestureState.moveY
            ),
          onPanResponderRelease: finishPracticeDrag,
          onPanResponderTerminate: finishPracticeDrag,
          onPanResponderTerminationRequest: () => false,
          onShouldBlockNativeResponder: () => true,
        }).panHandlers;
    }

    return dragPanHandlersRef.current[practiceId];
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
    setDailyTargetInput("");
  }

  function closeDailyTargetPrompt() {
    setDailyTargetPromptPractice(null);
    setDailyTargetInput("");
  }

  function saveDailyTarget() {
    if (!dailyTargetPromptPractice) return;

    const error =
      validateRepetitionCount(
        dailyTargetInput,
        t("dashboard.dailyTarget")
      );

    if (error) {
      alert(error);
      return;
    }

    const value = Number(dailyTargetInput);

    if (value <= 0) {
      alert(t("dashboard.dailyTargetPositive"));
      return;
    }

    try {
      practiceService.updatePracticeDailyTargetCount(
        dailyTargetPromptPractice.id,
        value
      );
      closeDailyTargetPrompt();
      refreshDashboard();
    } catch (error: any) {
      alert(error.message);
    }
  }

  function openPracticeCalendar(practiceId: string) {
    router.push({
      pathname: "/practice",
      params: {
        id: practiceId,
        openCalendar: "1",
      }
    });
  }

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
            transform: [{ translateY: dragOverlayTranslateY }],
          }
        ]}
      >
        <View style={[styles.card, styles.cardDragging, styles.dragOverlaySurface]}>
          <View style={styles.cardContent}>
            <View style={styles.practiceNameRow}>
              <View style={styles.dragHandle}>
                <MaterialIcons
                  name="drag-indicator"
                  size={22}
                  color="#9CA3AF"
                />
              </View>

              <Text numberOfLines={1} ellipsizeMode="tail" style={styles.practiceName}>
                {practiceDisplayName}
              </Text>

              <View style={styles.practiceActionButtons}>
                <View style={styles.practiceActionButton}>
                  <MaterialIcons name="edit" size={18} color={colors.primary} />
                </View>
                <View style={styles.practiceActionButton}>
                  <MaterialIcons name="bar-chart" size={18} color={colors.primary} />
                </View>
                <View style={styles.practiceActionButton}>
                  <MaterialIcons name="calendar-today" size={17} color={colors.primary} />
                </View>
                <View style={styles.practiceActionButton}>
                  <MaterialIcons name="delete-outline" size={18} color="#c62828" />
                </View>
              </View>
            </View>

            <Progress.Bar
              progress={currentCycleProgress}
              width={null}
              height={10}
              color={colors.primary}
              unfilledColor="#E5E5E5"
              borderWidth={0}
              borderRadius={5}
            />

            <View style={styles.practiceBodyRow}>
              <Image
                source={dragOverlayPractice.imageKey && practiceImages[dragOverlayPractice.imageKey] ? practiceImages[dragOverlayPractice.imageKey] : practiceImages["generic"]}
                style={styles.icon}
                resizeMode="contain"
              />

              <View style={styles.practiceMetricGroup}>
                <Text style={styles.countText}>
                  {t("practice.totalProgress")}: {formatCountProgress(
                    dragOverlayPractice.total,
                    dragOverlayPractice.targetCount || null
                  )}
                </Text>

                <Text style={styles.countText}>
                  {t("practice.targetDate")}:{" "}
                  <Text style={targetReached ? { color: colors.primary } : undefined}>
                    {expectedTargetDate}
                  </Text>
                </Text>

                {hasDailyTarget ? (
                  <DailyGoalProgress
                    todayCount={dragOverlayPractice.today}
                    dailyTargetCount={dailyTargetCount ?? 0}
                    style={styles.dailyGoalInline}
                    labelStyle={[styles.countText, styles.dailyGoalLabel]}
                    barStyle={styles.dailyGoalBar}
                    textStyle={styles.dailyGoalBarText}
                    labelNumberOfLines={1}
                  />
                ) : (
                  <View style={styles.enableDailyTargetButton}>
                    <MaterialIcons
                      name="check-circle-outline"
                      size={16}
                      color={colors.primary}
                    />
                    <Text style={styles.enableDailyTargetText}>
                      {t("practice.enableDailyTarget")}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </View>

          <View style={styles.quickAddContainer}>
            <View style={styles.quickAddButton}>
              <View style={styles.quickAddMainButton}>
                <Text style={styles.quickAddAmountText}>
                  +{formatNumber(defaultSessionCount)}
                </Text>

                <Text
                  style={styles.quickAddLabelText}
                  numberOfLines={1}
                >
                  {t("practice.addDefaultSession")}
                </Text>
              </View>

              <View style={styles.quickAddEditButton}>
                <MaterialIcons
                  name="edit"
                  size={15}
                  color={colors.primary}
                />
              </View>
            </View>
          </View>
        </View>
      </Animated.View>
    );
  }

  return (

    <View style={styles.dashboardRoot}>
      <ScrollView
      ref={scrollViewRef}
      style={containers.screen}
      contentContainerStyle={{ paddingBottom: 30 }}
      scrollEnabled={draggingPracticeId === null}
      scrollEventThrottle={16}
      onScroll={(event) => {
        if (draggingPracticeIdRef.current) return;

        scrollYRef.current = event.nativeEvent.contentOffset.y;
      }}
      onContentSizeChange={(_width, height) => {
        scrollContentHeightRef.current = height;
      }}
      onLayout={(event) => {
        scrollViewHeightRef.current = event.nativeEvent.layout.height;
        updateScrollViewWindowMetrics();
      }}
    >
      <View
        style={{
          width: "100%",
          maxWidth: 700,
          alignSelf: "center"
        }}
        onLayout={(event) => {
          dashboardContentXRef.current = event.nativeEvent.layout.x;
        }}
      >
        <View style={styles.streakContainer}>
          <View style={styles.streakBadge}>
            <View style={styles.streakFireIconBox}>
              <MaterialIcons
                name="local-fire-department"
                size={streakFireSize}
                color={colors.primary}
              />
            </View>

            <Text style={styles.streakText}>
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
                color="#6B7280"
              />
            </Pressable>
          </View>
        </View>
        {practices.map((practice) => {

          const {
            practiceDisplayName,
            currentCycleProgress,
            dailyTargetCount,
            hasDailyTarget,
            targetReached,
            expectedTargetDate,
          } = getPracticeCardViewModel(practice);

          return (

            <Animated.View
              key={practice.id}
              style={[
                styles.card,
                draggingPracticeId === practice.id &&
                styles.cardDraggingPlaceholder,
              ]}
              onLayout={(event) => {
                practiceCardLayoutsRef.current[practice.id] = {
                  x: event.nativeEvent.layout.x,
                  y: event.nativeEvent.layout.y,
                  width: event.nativeEvent.layout.width,
                  height: event.nativeEvent.layout.height,
                };
              }}
            >
              <TouchableOpacity
                onPress={() => {
                  if (suppressCardPressRef.current) return;

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
                      {...createDragPanHandlers(practice.id)}
                      accessibilityRole="adjustable"
                      accessibilityLabel={`${t("dashboard.reorderPractice")}: ${practiceDisplayName}`}
                    >
                      <MaterialIcons
                        name="drag-indicator"
                        size={22}
                        color="#9CA3AF"
                      />
                    </View>

                    <Text numberOfLines={1} ellipsizeMode="tail" style={styles.practiceName}>
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
                          color={colors.primary}
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
                          color={colors.primary}
                        />
                      </Pressable>

                      <Pressable
                        style={({ pressed }) => [
                          styles.practiceActionButton,
                          pressed && styles.practiceActionButtonPressed
                        ]}
                        onPress={(event) => {
                          event.stopPropagation();
                          openPracticeCalendar(practice.id);
                        }}
                        hitSlop={6}
                        accessibilityRole="button"
                        accessibilityLabel={`${t("practiceMenu.calendar")}: ${practiceDisplayName}`}
                      >
                        <MaterialIcons
                          name="calendar-today"
                          size={17}
                          color={colors.primary}
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
                          color="#c62828"
                        />
                      </Pressable>
                    </View>
                  </View>

                  <Progress.Bar
                    progress={currentCycleProgress}
                    width={null}
                    height={10}
                    color={colors.primary}
                    unfilledColor="#E5E5E5"
                    borderWidth={0}
                    borderRadius={5}
                  />

                  <View style={styles.practiceBodyRow}>
                    <Image
                      source={practice.imageKey && practiceImages[practice.imageKey] ? practiceImages[practice.imageKey] : practiceImages["generic"]}
                      style={styles.icon}
                      resizeMode="contain"
                    />

                    <View style={styles.practiceMetricGroup}>
                      <Text style={styles.countText}>
                        {t("practice.totalProgress")}: {formatCountProgress(
                          practice.total,
                          practice.targetCount || null
                        )}
                      </Text>

                      <View style={styles.targetDateRow}>
                        {isCelebrating(practice.id) && (
                          <CelebrationOverlay
                            fade={celebrationFade}
                            sparkle1={sparkle1}
                            sparkle2={sparkle2}
                            sparkle3={sparkle3}
                          />
                        )}
                        <Text style={styles.countText}>
                          {t("practice.targetDate")}:{" "}
                          <Text style={targetReached ? { color: colors.primary } : undefined}>
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
                          style={styles.dailyGoalInline}
                          labelStyle={[styles.countText, styles.dailyGoalLabel]}
                          barStyle={styles.dailyGoalBar}
                          textStyle={styles.dailyGoalBarText}
                          labelNumberOfLines={1}
                        />
                      ) : (
                        <Pressable
                          style={({ pressed }) => [
                            styles.enableDailyTargetButton,
                            pressed && styles.enableDailyTargetButtonPressed
                          ]}
                          onPress={() => openDailyTargetPrompt(practice)}
                          accessibilityRole="button"
                          accessibilityLabel={`${t("practice.enableDailyTarget")}: ${practiceDisplayName}`}
                        >
                          <MaterialIcons
                            name="check-circle-outline"
                            size={16}
                            color={colors.primary}
                          />
                          <Text style={styles.enableDailyTargetText}>
                            {t("practice.enableDailyTarget")}
                          </Text>
                        </Pressable>
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
                <View style={styles.quickAddButton}>
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
                      count: formatNumber(practice.defaultSessionCount ?? 108),
                    })}: ${practiceDisplayName}`}
                  >
                    <Text style={styles.quickAddAmountText}>
                      +{formatNumber(practice.defaultSessionCount ?? 108)}
                    </Text>

                    <Text
                      style={styles.quickAddLabelText}
                      numberOfLines={1}
                    >
                      {t("practice.addDefaultSession")}
                    </Text>
                  </Pressable>

                  <Pressable
                    style={({ pressed }) => [
                      styles.quickAddEditButton,
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
                      color={colors.primary}
                    />
                  </Pressable>
                </View>
              </View>

            </Animated.View>

          );
        })}

        <Pressable
          style={({ pressed }) => [
            styles.addPracticeCard,
            pressed && styles.addPracticeCardPressed
          ]}
          onPress={() => router.push("/add-practice")}
          accessibilityRole="button"
          accessibilityLabel={t("dashboard.addPractice")}
        >
          <View style={styles.addPracticeCircle}>
            <MaterialIcons
              name="add"
              size={22}
              color={colors.primary}
            />
          </View>

          <View style={styles.addPracticeTextWrapper}>
            <Text style={styles.addPracticeText}>
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
        />

        {practiceActions.historyPractice && (
          <PracticeHistoryModal
            visible
            onClose={practiceActions.closePracticeHistory}
            practiceId={practiceActions.historyPractice.id}
            total={practiceActions.historyPractice.total}
          />
        )}

        <Modal
          visible={dailyTargetPromptPractice !== null}
          transparent
          animationType="fade"
          onRequestClose={closeDailyTargetPrompt}
        >
          <Pressable
            style={styles.modalOverlay}
            onPress={closeDailyTargetPrompt}
          >
            <Pressable
              style={styles.modalCard}
              onPress={() => { }}
            >
              <Text style={styles.modalTitle}>
                {t("dashboard.setDailyTarget")}
              </Text>

              <Text style={styles.modalSubtitle}>
                {dailyTargetPromptPractice?.name}
              </Text>

              <TextInput
                value={dailyTargetInput}
                onChangeText={(value) => {
                  const clean = digitsOnly(value);
                  if (Number(clean) > MAX_REPETITIONS_PER_DAY) return;
                  setDailyTargetInput(clean);
                }}
                keyboardType="numeric"
                returnKeyType="done"
                onSubmitEditing={saveDailyTarget}
                placeholder={t("dashboard.dailyTarget")}
                placeholderTextColor="#999"
                style={styles.modalInput}
                maxLength={String(MAX_REPETITIONS_PER_DAY).length}
                autoFocus
              />

              <View style={styles.modalButtons}>
                <Pressable
                  style={styles.modalButton}
                  onPress={closeDailyTargetPrompt}
                >
                  <Text>{t("common.cancel")}</Text>
                </Pressable>

                <Pressable
                  style={styles.modalButton}
                  onPress={saveDailyTarget}
                >
                  <Text>{t("common.save")}</Text>
                </Pressable>
              </View>
            </Pressable>
          </Pressable>
        </Modal>

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
                {
                  top: tooltipPosition.top,
                  left: tooltipPosition.left,
                }
              ]}
            >
              <Text style={styles.anchoredTooltipText}>
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
            style={styles.infoOverlay}
            onPress={() => setInfoOpen(false)}
          >
            <Pressable
              style={styles.infoModal}
              onPress={() => { }}
            >
              <Text style={styles.infoTitle}>
                {t("dashboard.infoTitle")}
              </Text>

              <Text style={styles.infoText}>
                {t("dashboard.infoStreak")}
              </Text>

              <Text style={styles.infoText}>
                {t("dashboard.infoQuickAdd")}
              </Text>

              <Text style={styles.infoText}>
                {t("dashboard.infoLongPressPractice")}
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
    gap: 6,
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

  enableDailyTargetButtonPressed: {
    opacity: 0.72,
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

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.25)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },

  modalCard: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: "white",
    borderRadius: 12,
    padding: 20,
  },

  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 8,
  },

  modalSubtitle: {
    fontSize: 14,
    color: "#666",
    marginBottom: 16,
  },

  modalInput: {
    borderWidth: 1,
    borderColor: "#ccc",
    padding: 10,
    marginBottom: 16,
    borderRadius: 8,
  },

  modalButtons: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
  },

  modalButton: {
    paddingVertical: 10,
    paddingHorizontal: 14,
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
