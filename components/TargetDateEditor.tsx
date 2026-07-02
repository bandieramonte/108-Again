import React, { useEffect, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Calendar } from "react-native-calendars";
import { useI18n } from "../i18n";
import * as practiceService from "../services/practiceService";
import { useAppTheme } from "../styles/theme";

type Props = {
    visible: boolean;
    targetCount: number;
    total: number;
    currentTargetDate: Date | null;
    onClose: () => void;
    onSave: (newDailyCount: number, selectedDate: string) => void;
};

function todayString() {
    return new Date().toISOString().split("T")[0];
}

export default function TargetDateEditor({
    visible,
    targetCount,
    total,
    currentTargetDate,
    onClose,
    onSave
}: Props) {

    const { colors } = useAppTheme();
    const { t } = useI18n();
    const [selectedDate, setSelectedDate] = useState(
        currentTargetDate
            ? currentTargetDate.toISOString().split("T")[0]
            : todayString()
    );
    useEffect(() => {
        if (visible) {
            setSelectedDate(
                currentTargetDate
                    ? currentTargetDate.toISOString().split("T")[0]
                    : todayString()
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

    const today = todayString();

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
        >

            <Pressable
                style={[
                    styles.overlay,
                    { backgroundColor: colors.overlay },
                ]}
                onPress={onClose}
            >
                <Pressable
                    style={[
                        styles.card,
                        { backgroundColor: colors.surfaceElevated },
                    ]}
                    onPress={() => { }}
                >
                    <Text style={[styles.title, { color: colors.textPrimary }]}>
                        {t("targetDateEditor.title")}
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

                                backgroundColor: colors.surfaceElevated,
                                calendarBackground: colors.surfaceElevated,
                                dayTextColor: colors.textPrimary,
                                monthTextColor: colors.textPrimary,
                                textDisabledColor: colors.inputPlaceholder,

                                textDayFontWeight: "500",
                                textMonthFontWeight: "600",
                                textDayHeaderFontWeight: "600"
                            }}
                        />
                    )}

                    <View style={styles.buttons}>
                        <Pressable onPress={onClose}>
                            <Text style={{ color: colors.textSecondary }}>
                                {t("common.cancel")}
                            </Text>
                        </Pressable>

                        <Pressable onPress={save}>
                            <Text style={{ color: colors.primary }}>
                                {t("common.save")}
                            </Text>
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
