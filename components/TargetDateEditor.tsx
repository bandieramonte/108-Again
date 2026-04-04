import React, { useEffect, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Calendar } from "react-native-calendars";
import * as practiceService from "../services/practiceService";

type Props = {
    visible: boolean;
    targetCount: number;
    total: number;
    currentTargetDate: Date | null;
    onClose: () => void;
    onSave: (newDailyCount: number) => void;
};

export default function TargetDateEditor({
    visible,
    targetCount,
    total,
    currentTargetDate,
    onClose,
    onSave
}: Props) {

    const [selectedDate, setSelectedDate] = useState("");

    useEffect(() => {
        if (visible && currentTargetDate) {
            setSelectedDate(
                currentTargetDate.toISOString().split("T")[0]
            );
        }
    }, [visible, currentTargetDate]);

    function save() {

        const date = new Date(selectedDate);

        const required =
            practiceService.calculateRequiredDailyCount(
                targetCount,
                total,
                date
            );

        onSave(required);
        onClose();
    }

    const today = new Date().toISOString().split("T")[0];

    return (
        <Modal visible={visible} transparent animationType="fade">

            <View style={styles.overlay}>
                <View style={styles.card}>

                    <Text style={styles.title}>
                        Edit target date
                    </Text>

                    <Calendar
                        current={selectedDate}
                        minDate={today}
                        markedDates={{
                            [selectedDate]: {
                                selected: true
                            }
                        }}
                        onDayPress={(day) => {
                            setSelectedDate(day.dateString);
                        }}
                    />

                    <View style={styles.buttons}>
                        <Pressable onPress={onClose}>
                            <Text>Cancel</Text>
                        </Pressable>

                        <Pressable onPress={save}>
                            <Text>Save</Text>
                        </Pressable>
                    </View>

                </View>
            </View>

        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "rgba(0,0,0,0.25)"
    },

    card: {
        backgroundColor: "white",
        padding: 20,
        borderRadius: 12,
        width: 340
    },

    title: {
        fontSize: 18,
        fontWeight: "600",
        marginBottom: 12
    },

    buttons: {
        flexDirection: "row",
        justifyContent: "flex-end",
        gap: 12,
        marginTop: 12
    }
});