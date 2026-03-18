import { subscribe } from "@/utils/events";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import * as Progress from "react-native-progress";
import { practiceImages } from "../constants/practiceImages";
import * as dashboardService from "../services/dashboardService";
import * as practiceService from "../services/practiceService";
import * as sessionService from "../services/sessionService";

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

  useFocusEffect(
    useCallback(() => {

      refreshDashboard();

    }, [])
  );

  useEffect(() => {

    const refresh = () => {
      refreshDashboard();
    };

    const unsubscribe = subscribe(refresh);

    return unsubscribe;

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
      }, 4000);
    });
  }

  function refreshDashboard() {
    const rows = dashboardService.getDashboardPractices();
    setPractices(rows);
    setStreak(dashboardService.getCurrentStreak());
  }

  async function quickAdd(practiceId: string, count: number) {
    sessionService.addSession(practiceId, count);
    refreshDashboard();
    await maybeShowQuickAddHint(practiceId);
  }

  function openEditDefaultModal(practiceId: string, practiceName: string, currentDefault: number) {
    setSelectedPracticeId(practiceId);
    setSelectedPracticeName(practiceName);
    setDefaultAddInput(String(currentDefault));
    setEditDefaultOpen(true);
  }

  function saveDefaultAddAmount() {
    const value = Number(defaultAddInput);

    if (!selectedPracticeId) return;

    if (!Number.isFinite(value)) {
      alert("Please enter a valid number");
      return;
    }

    if (!Number.isInteger(value)) {
      alert("Please enter a whole number");
      return;
    }

    if (value <= 0) {
      alert("Value must be greater than zero");
      return;
    }

    practiceService.updatePracticeDefaultAddCount(selectedPracticeId, value);
    setEditDefaultOpen(false);
    setSelectedPracticeId(null);
    setSelectedPracticeName("");
    setDefaultAddInput("");
    refreshDashboard();
  }

  function getExpectedTargetDate(practice: Practice) {
    const dailyAmount = practice.defaultAddCount ?? 108;

    if (!Number.isFinite(dailyAmount) || dailyAmount <= 0) {
      return null;
    }

    const remaining = practice.targetCount - practice.total;

    if (remaining <= 0) {
      return "Reached";
    }

    const daysNeeded = Math.ceil(remaining / dailyAmount);

    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + daysNeeded);

    return targetDate.toLocaleDateString("en-US", {
      month: "long",
      day: "2-digit",
      year: "numeric",
    });
  }

  return (

    <ScrollView style={styles.container}>

      <Text style={{ marginBottom: 20, fontWeight: "bold", fontStyle: "italic" }}>
        Streak: {streak} {streak === 1 ? "day" : "days"}
      </Text>

      {practices.map((practice) => {

        const cycleSize = practice.targetCount;
        const completedCycles = Math.floor(practice.total / cycleSize);
        const currentCycleProgress = (practice.total % cycleSize) / cycleSize;
        const expectedTargetDate = getExpectedTargetDate(practice);

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
                  />

                  <Text style={styles.countText}>
                    {practice.total + ' ' + (!!cycleSize ? '/ ' + cycleSize * (completedCycles + 1) : '')}
                  </Text>

                  <Text style={{ fontSize: 12, color: "#666" }}>
                    Today: {practice.today}
                  </Text>

                  <Text style={{ fontSize: 12, color: "#666", marginTop: 2 }}>
                    Target date: {expectedTargetDate ?? "No estimate"}
                  </Text>
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
                  +{practice.defaultAddCount ?? 108}
                </Text>
              </Pressable>
            </View>

          </View>

        );
      })}

      <Modal
        visible={editDefaultOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setEditDefaultOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Edit repetitions per session</Text>

            <Text style={styles.modalSubtitle}>
              {selectedPracticeName}
            </Text>

            <TextInput
              value={defaultAddInput}
              onChangeText={setDefaultAddInput}
              keyboardType="numeric"
              style={styles.modalInput}
              placeholder="Repetitions per session"
            />

            <View style={styles.modalButtons}>
              <Pressable
                style={styles.modalButton}
                onPress={() => {
                  setEditDefaultOpen(false);
                  setSelectedPracticeId(null);
                  setSelectedPracticeName("");
                  setDefaultAddInput("");
                }}
              >
                <Text>Cancel</Text>
              </Pressable>

              <Pressable
                style={styles.modalButton}
                onPress={saveDefaultAddAmount}
              >
                <Text>Save</Text>
              </Pressable>
            </View>
          </View>
        </View>
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
              Tip: Long press this button to change the default amount.
            </Text>
          </View>
        </Pressable>
      )}

    </ScrollView>

  );
}

const styles = StyleSheet.create({

  container: {
    padding: 20,
    marginTop: 12,
    marginBottom: 10,
  },

  title: {
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 30,
  },

  card: {
    marginBottom: 25,
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
    transform: [{ scale: 1.08 }],
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

});