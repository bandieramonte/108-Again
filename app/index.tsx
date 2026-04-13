import { subscribeData } from "@/utils/events";
import { MaterialIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Animated, Image, Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import * as Progress from "react-native-progress";
import CelebrationOverlay from "../components/CelebrationOverlay";
import QuickAddEditor from "../components/QuickAddEditor";
import { practiceImages } from "../constants/practiceImages";
import { useReachedCelebration } from "../hooks/useReachedCelebration";
import * as dashboardService from "../services/dashboardService";
import * as practiceService from "../services/practiceService";
import * as sessionService from "../services/sessionService";
import { colors, containers } from "../styles/theme";
import { formatNumber } from "../utils/numberUtils";

type Practice = {
  id: string;
  name: string;
  targetCount: number;
  total: number;
  today: number;
  imageKey?: string | null;
  defaultAddCount?: number | null;
};

export default function Dashboard() {

  const router = useRouter();
  const [practices, setPractices] = useState<Practice[]>([]);
  const [streak, setStreak] = useState(0);

  const [editDefaultOpen, setEditDefaultOpen] = useState(false);
  const [selectedPracticeId, setSelectedPracticeId] = useState<string | null>(null);
  const [selectedPracticeName, setSelectedPracticeName] = useState("");
  const [defaultAddInput, setDefaultAddInput] = useState("");
  const [showQuickAddHint, setShowQuickAddHint] = useState(false);
  const quickAddRefs = useRef<Record<string, View | null>>({});
  const [tooltipPosition, setTooltipPosition] = useState<{ top: number; left: number } | null>(null);
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

  useFocusEffect(
    useCallback(() => {
      scheduleDashboardRefresh();
    }, [])
  );

  useEffect(() => {
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

  async function maybeShowQuickAddHint(practiceId: string) {
    const seen = await AsyncStorage.getItem("quickAddLongPressHintSeen");

    if (seen) return;

    const target = quickAddRefs.current[practiceId];
    if (!target) return;

    // Prefer measuring via the ref; UIManager.measureInWindow is deprecated.
    (target as any).measureInWindow(async (x: number, y: number, width: number, height: number) => {
      setTooltipPosition({
        top: y - 108,
        left: x + width / 2 - 120
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

  function openEditDefaultModal(practiceId: string, practiceName: string, currentDefault: number) {
    setSelectedPracticeId(practiceId);
    setSelectedPracticeName(practiceName);
    setDefaultAddInput(String(currentDefault));
    setEditDefaultOpen(true);
  }

  return (

    <ScrollView style={containers.screen}>
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
              />
            </Pressable>
          </View>
        </View>
        {practices.map((practice) => {

          const currentCycleProgress = practice.total >= practice.targetCount ? 1 : (practice.total % practice.targetCount) / practice.targetCount;
          const targetDate =
            practiceService.getExpectedTargetDate(
              practice.targetCount,
              practice.total,
              practice.defaultAddCount
            );

          const expectedTargetDate =
            practice.targetCount > 0 && practice.total >= practice.targetCount
              ? <Text style={{ color: colors.primary }}>Reached!</Text>
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
              >

                <View style={styles.row}>
                  {practice.imageKey && practiceImages[practice.imageKey] && (
                    <Image
                      source={practiceImages[practice.imageKey]}
                      style={styles.icon}
                      resizeMode="contain"
                    />
                  )}

                  <View style={{ flex: 1 }}>
                    <Text style={styles.practiceName}>
                      {practice.name}
                    </Text>

                    <Progress.Bar
                      progress={currentCycleProgress}
                      width={null}
                      height={10}
                      color={colors.primary}
                      unfilledColor="#E5E5E5"
                      borderWidth={0}
                      borderRadius={5}
                    />

                    <Text style={styles.countText}>
                      {formatNumber(practice.total) + ' ' + (!!practice.targetCount ? '/ ' + formatNumber(practice.targetCount) : '')}
                    </Text>

                    <Text style={{ fontSize: 12, color: "#666" }}>
                      Today: {formatNumber(practice.today)}
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
                      <Text
                        style={
                          !!practice.imageKey
                            ? { fontSize: 12, color: "#666", marginTop: 2 }
                            : { fontSize: 12, color: "#666", marginTop: 2, marginBottom: 10 }
                        }
                      >
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
                  </View>
                </View>

              </TouchableOpacity>

              <View
                ref={(node) => {
                  quickAddRefs.current[practice.id] = node;
                }}
              >
                <Pressable
                  style={({ pressed }) => [
                    styles.quickAddButton,
                    pressed && styles.quickAddButtonPressed
                  ]}
                  onPress={() => quickAdd(practice.id, practice.defaultAddCount ?? 108)}
                  onLongPress={() =>
                    openEditDefaultModal(
                      practice.id,
                      practice.name,
                      practice.defaultAddCount ?? 108
                    )
                  }
                  delayLongPress={350}
                >
                  <Text style={styles.quickAddButtonText}>
                    +{formatNumber(practice.defaultAddCount ?? 108)}
                  </Text>
                </Pressable>
              </View>

            </View>

          );
        })}

        <QuickAddEditor
          visible={editDefaultOpen}
          practiceId={selectedPracticeId}
          practiceName={selectedPracticeName}
          defaultValue={Number(defaultAddInput)}
          onClose={() => setEditDefaultOpen(false)}
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
                {
                  top: tooltipPosition.top,
                  left: tooltipPosition.left,
                }
              ]}
            >
              <Text style={styles.anchoredTooltipText}>
                Tip: Long press this button to change the expected amount of daily repetitions.
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
                you practiced at least once.
              </Text>

              <Text style={styles.infoText}>
                Tip: Long press the quick add button to change
                the daily repetition count.
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
  );
}

const styles = StyleSheet.create({

  title: {
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 30,
  },

  card: {
    marginBottom: 25,
    position: "relative",
    marginHorizontal: 8
  },

  practiceName: {
    fontSize: 18,
    marginBottom: 6,
  },

  countText: {
    marginTop: 6,
    fontSize: 14,
  },

  quickButtons: {
    marginTop: 6,
    alignItems: "flex-start"
  },

  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  icon: {
    width: 70,
    height: 70,
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
    transform: [{ scale: 1.18 }],
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