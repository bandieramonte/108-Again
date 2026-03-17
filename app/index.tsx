import { subscribe } from "@/utils/events";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  Button,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import * as Progress from "react-native-progress";
import * as dashboardService from "../services/dashboardService";
import * as sessionService from "../services/sessionService";

type Practice = {
  id: string;
  name: string;
  targetCount: number;
  total: number;
  today: number;
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

      <Text style={{ marginBottom: 20 }}>
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
                  pathname: "/practice/[id]",
                  params: {
                    id: practice.id,
                    name: practice.name
                  }
                })
              }
            >

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
    marginTop: 60,
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
  }

});