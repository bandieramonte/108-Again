import { subscribeData } from "@/utils/events";
import { MaterialIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Animated, Dimensions, Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import * as Progress from "react-native-progress";
import CelebrationOverlay from "../components/CelebrationOverlay";
import PracticeActionsMenu, {
  type PracticeMenuAnchor,
} from "../components/PracticeActionsMenu";
import QuickAddEditor from "../components/QuickAddEditor";
import WelcomeModal from "../components/WelcomeModal";
import PracticeHistoryModal from "../components/PracticeHistoryModal";
import { practiceImages } from "../constants/practiceImages";
import { usePracticeActions } from "../hooks/usePracticeActions";
import { useReachedCelebration } from "../hooks/useReachedCelebration";
import * as dashboardService from "../services/dashboardService";
import * as practiceService from "../services/practiceService";
import * as sessionService from "../services/sessionService";
import { colors, containers } from "../styles/theme";
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

export default function Dashboard() {

  const router = useRouter();
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
  const quickAddRefs = useRef<Record<string, View | null>>({});
  const practiceRowRefs = useRef<Record<string, View | null>>({});
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
  const practiceActions = usePracticeActions({
    onDeleted: refreshDashboard,
  });

  useFocusEffect(
    useCallback(() => {
      scheduleDashboardRefresh();
    }, [])
  );

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
  }, []);

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

  function scheduleDashboardRefresh() {
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current);
    }

    refreshTimeoutRef.current = setTimeout(() => {
      refreshTimeoutRef.current = null;
      refreshDashboard();
    }, 0);
  }

  function refreshDashboard() {
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
  }

  async function quickAdd(practiceId: string, count: number) {
    try {
      sessionService.addSession(practiceId, count);
    } catch (error: any) {
      alert(error.message);
    }
    await maybeShowQuickAddHint(practiceId);
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

    (target as any).measureInWindow(
      (x: number, y: number, width: number, height: number) => {
        setMenuPractice(practice);
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
      name: practice.name,
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
        "Daily target"
      );

    if (error) {
      alert(error);
      return;
    }

    const value = Number(dailyTargetInput);

    if (value <= 0) {
      alert("Daily target must be greater than 0");
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

  return (

    <ScrollView style={containers.screen} contentContainerStyle={{ paddingBottom: 30 }}>
      <View
        style={{
          width: "100%",
          maxWidth: 700,
          alignSelf: "center"
        }}
      >
        <View style={styles.streakContainer}>
          <View style={styles.streakBadge}>
            <Text style={styles.streakText}>
              Streak: {streak} {streak === 1 ? "day" : "days"}
            </Text>

            <Pressable
              onPress={() => setInfoOpen(true)}
            >
              <MaterialIcons
                name="info-outline"
                size={20}
                color="#666"
                hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
              />
            </Pressable>
          </View>
        </View>
        {practices.map((practice) => {

          const currentCycleProgress = practice.total >= practice.targetCount ? 1 : (practice.total % practice.targetCount) / practice.targetCount;
          const dailyTargetCount = practice.dailyTargetCount ?? null;
          const hasDailyTarget =
            dailyTargetCount != null &&
            dailyTargetCount > 0;
          const todayTargetProgress =
            hasDailyTarget
              ? Math.min(practice.today / dailyTargetCount, 1)
              : 0;
          const isTodayTargetFinished =
            hasDailyTarget &&
            practice.today >= dailyTargetCount;
          const targetDate =
            hasDailyTarget
              ? practiceService.getExpectedTargetDate(
                practice.targetCount,
                practice.total,
                dailyTargetCount
              )
              : null;

          const expectedTargetDate =
            practice.targetCount > 0 && practice.total >= practice.targetCount
              ? <Text style={{ color: colors.primary }}>Reached!</Text>
              : !hasDailyTarget
                ? "Set daily target 1st"
                : targetDate
                  ? targetDate.toLocaleDateString("en-US", {
                    month: "long",
                    day: "2-digit",
                    year: "numeric"
                  })
                  : "No estimate";

          return (

            <View key={practice.id} style={styles.card}>
              <TouchableOpacity
                onPress={() =>
                  router.push({
                    pathname: "/practice",
                    params: {
                      id: practice.id
                    }
                  })
                }
                onLongPress={() => openPracticeMenu(practice)}
                delayLongPress={350}
                accessibilityHint="Long press for practice actions"
              >

                <View
                  ref={(node) => {
                    practiceRowRefs.current[practice.id] = node;
                  }}
                  style={styles.row}
                >
                  <Image
                    source={practice.imageKey && practiceImages[practice.imageKey] ? practiceImages[practice.imageKey] : practiceImages["generic"]}
                    style={styles.icon}
                    resizeMode="contain"
                  />

                  <View style={{ flex: 1 }}>
                    <View style={styles.practiceNameRow}>
                      <Text numberOfLines={2} ellipsizeMode="tail" style={styles.practiceName}>
                        {practice.name}
                      </Text>

                      <View style={styles.practiceActionButtons}>
                        <Pressable
                          style={({ pressed }) => [
                            styles.practiceActionButton,
                            pressed && styles.practiceActionButtonPressed
                          ]}
                          onPress={(event) => {
                            event.stopPropagation();
                            practiceActions.editPractice(practice);
                          }}
                          hitSlop={6}
                          accessibilityRole="button"
                          accessibilityLabel={`Edit ${practice.name}`}
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
                            practiceActions.openPracticeHistory(practice);
                          }}
                          hitSlop={6}
                          accessibilityRole="button"
                          accessibilityLabel={`View statistics for ${practice.name}`}
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
                          accessibilityLabel={`View calendar for ${practice.name}`}
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
                            practiceActions.confirmDeletePractice(practice);
                          }}
                          hitSlop={6}
                          accessibilityRole="button"
                          accessibilityLabel={`Delete ${practice.name}`}
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

                    <View
                      style={[
                        styles.practiceMetricGroup,
                        !practice.imageKey && styles.practiceMetricGroupNoImage
                      ]}
                    >
                      <Text style={styles.countText}>
                        Total Progress: {formatCountProgress(
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
                          Target date: {expectedTargetDate ?? "No estimate"}
                        </Text>

                        {expectedTargetDate === "Reached!" && isCelebrating(practice.id) && (
                          <Animated.Text
                            style={[
                              styles.congratsText,
                              { opacity: celebrationFade }
                            ]}
                          >
                            Congratulations!!
                          </Animated.Text>
                        )}
                      </View>

                      {hasDailyTarget ? (
                        <View style={styles.todayMetricRow}>
                          <Text style={styles.countText}>
                            Today&apos;s goal:
                          </Text>

                          <View
                            style={[
                              styles.todayTargetBar,
                              isTodayTargetFinished &&
                              styles.todayTargetBarFinished
                            ]}
                          >
                            <View
                              style={[
                                styles.todayTargetBarFill,
                                {
                                  width: `${todayTargetProgress * 100}%`,
                                }
                              ]}
                            />
                            <View style={styles.todayTargetBarTextOverlay}>
                              <Text
                                style={[
                                  styles.todayTargetBarText,
                                  isTodayTargetFinished &&
                                  styles.todayTargetBarTextFinished
                                ]}
                              >
                                {isTodayTargetFinished
                                  ? "Finished!"
                                  : formatCountProgress(
                                    practice.today,
                                    dailyTargetCount
                                  )}
                              </Text>
                            </View>
                          </View>
                        </View>
                      ) : (
                        <Pressable
                          style={({ pressed }) => [
                            styles.enableDailyTargetButton,
                            pressed && styles.enableDailyTargetButtonPressed
                          ]}
                          onPress={() => openDailyTargetPrompt(practice)}
                          accessibilityRole="button"
                          accessibilityLabel={`Enable daily target for ${practice.name}`}
                        >
                          <MaterialIcons
                            name="check-circle-outline"
                            size={16}
                            color={colors.primary}
                          />
                          <Text style={styles.enableDailyTargetText}>
                            Enable daily target
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
                <Pressable
                  style={({ pressed }) => [
                    styles.quickAddButton,
                    pressed && styles.quickAddButtonPressed
                  ]}
                  onPress={() => quickAdd(practice.id, practice.defaultSessionCount ?? 108)}
                  onLongPress={() =>
                    openEditDefaultModal(
                      practice.id,
                      practice.name,
                      practice.defaultSessionCount ?? 108
                    )
                  }
                  delayLongPress={350}
                >
                  <Text style={styles.quickAddButtonText}>
                    +{formatNumber(practice.defaultSessionCount ?? 108)}
                  </Text>
                </Pressable>
              </View>

            </View>

          );
        })}

        <Pressable
          style={({ pressed }) => [
            styles.addPracticeCard,
            pressed && styles.addPracticeCardPressed
          ]}
          onPress={() => router.push("/add-practice")}
          accessibilityRole="button"
          accessibilityLabel="Add Practice"
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
              Add Practice
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
                Set daily target
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
                placeholder="Daily target"
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
                  <Text>Cancel</Text>
                </Pressable>

                <Pressable
                  style={styles.modalButton}
                  onPress={saveDailyTarget}
                >
                  <Text>Save</Text>
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
                Tip: Long press this button to change the default session count.
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
                Dashboard Info
              </Text>

              <Text style={styles.infoText}>
                Your streak shows how many consecutive days
                you did any practice at least once.
              </Text>

              <Text style={styles.infoText}>
                Tip: Long press the quick add button to change
                the default session count.
              </Text>

              <Text style={styles.infoText}>
                Long press a practice to edit it, view its history,
                or delete it.
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
      <WelcomeModal
        visible={welcomeOpen}
        onClose={() => setWelcomeOpen(false)}
      />
    </ScrollView>
  );
}

const screenWidth = Dimensions.get("window").width;
const iconSize = screenWidth < 360 ? 60 : 70;
const addPracticeCardHeight = Math.round(iconSize);
const todayTargetBarWidth = screenWidth < 360 ? 105 : 128;
const styles = StyleSheet.create({

  title: {
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 30,
  },

  card: {
    marginBottom: 25,
    position: "relative",
    marginHorizontal: 8,
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
    flex: 1,
  },

  practiceNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 6,
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
  },

  practiceMetricGroup: {
    marginTop: 8,
    gap: 5,
  },

  practiceMetricGroupNoImage: {
    marginBottom: 10,
  },

  todayMetricRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  todayTargetBar: {
    width: todayTargetBarWidth,
    height: 15,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    backgroundColor: "#F9FAFB",
    overflow: "hidden",
  },

  todayTargetBarFinished: {
    borderColor: colors.primary,
  },

  todayTargetBarFill: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: "rgba(107, 114, 128, 0.28)",
  },

  todayTargetBarTextOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },

  todayTargetBarText: {
    color: "#111",
    fontSize: 14,
    fontWeight: "400",
    lineHeight: 14,
    textAlign: "center",
    includeFontPadding: false,
    transform: [{ translateY: -0.5 }],
  },

  todayTargetBarTextFinished: {
    color: colors.primary,
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
    marginTop: -8,
    alignItems: "flex-start",
  },

  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  icon: {
    width: iconSize,
    height: iconSize,
    borderRadius: 8,
  },

  quickAddButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },

  quickAddButton: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: "#e5e7eb",
    borderRadius: 8,
    alignSelf: "flex-start",
  },

  quickAddButtonPressed: {
    opacity: 0.65,
    transform: [{ scale: 1.15 }],
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
    fontWeight: "bold",
    fontStyle: "italic"
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
    gap: 8,
    backgroundColor: "#f3f4f6",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.primary,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },

});
