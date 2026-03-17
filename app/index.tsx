import { subscribe } from "@/utils/events";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  Button,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import * as Progress from "react-native-progress";
import { practiceImages } from "../constants/practiceImages";
import * as dashboardService from "../services/dashboardService";
import * as sessionService from "../services/sessionService";

type Practice = {
  id: string;
  name: string;
  targetCount: number;
  total: number;
  today: number;
  imageKey?: string | null;
};

export default function Dashboard() {

  const router = useRouter();
  const [practices, setPractices] = useState<Practice[]>([]);
  const [streak, setStreak] = useState(0);

  useFocusEffect(
    useCallback(() => {

      refreshDashboard();

    }, [])
  );

  useEffect(() => {

    const refresh = () => {
      refreshDashboard()
    };

    subscribe(refresh);

  }, []);

  function refreshDashboard() {
    const rows = dashboardService.getDashboardPractices();
    setPractices(rows);
    setStreak(dashboardService.getCurrentStreak());
  }

  function addQuick108(practiceId: string) {
    sessionService.addSession(practiceId, 108);
    setPractices(dashboardService.getDashboardPractices());
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
                </View>
              </View>

            </TouchableOpacity>

            <View style={styles.quickButtons}>
              <Button
                title="+108"
                onPress={() => addQuick108(practice.id)}
              />
            </View>

          </View>

        );
      })}

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
  }

});