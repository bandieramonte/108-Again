import React, { useEffect, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Calendar } from "react-native-calendars";
import * as practiceService from "../services/practiceService";
import { colors } from "../styles/theme";

type Props = {
    visible: boolean;
    targetCount: number;
    total: number;
    currentTargetDate: Date | null;
    onClose: () => void;
    onSave: (newDailyCount: number, selectedDate: string) => void;
};

export default function TargetDateEditor({
    visible,
    targetCount,
    total,
    currentTargetDate,
    onClose,
    onSave
}: Props) {

    const [selectedDate, setSelectedDate] = useState(
        currentTargetDate
            ? currentTargetDate.toISOString().split("T")[0]
            : ""
    );
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

        onSave(required, selectedDate);
        onClose();
    }

    const today = new Date().toISOString().split("T")[0];

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
        >

            <Pressable
                style={styles.overlay}
                onPress={onClose}
            >
                <Pressable
                    style={styles.card}
                    onPress={() => { }}
                >
                    <Text style={styles.title}>
                        Edit target date
                    </Text>

                    {selectedDate && (
                        <Calendar
                            key={selectedDate}
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
                            theme={{
                                selectedDayBackgroundColor: colors.primary,
                                selectedDayTextColor: "#fff",

                                todayTextColor: colors.primary,

                                arrowColor: colors.primary,

                                monthTextColor: "#111",

                                textDayFontWeight: "500",
                                textMonthFontWeight: "600",
                                textDayHeaderFontWeight: "600"
                            }}
                        />
                    )}

                    <View style={styles.buttons}>
                        <Pressable onPress={onClose}>
                            <Text>Cancel</Text>
                        </Pressable>

                        <Pressable onPress={save}>
                            <Text>Save</Text>
                        </Pressable>
                    </View>

                </Pressable>
            </Pressable>

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
        width: "100%",
        maxWidth: 420,
        alignSelf: "center"
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