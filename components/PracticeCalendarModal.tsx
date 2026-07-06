import { MaterialIcons } from "@expo/vector-icons";
import {
    Dimensions,
    Modal,
    Pressable,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useState } from "react";
import { useI18n } from "../i18n";
import { useAppTheme } from "../styles/theme";
import PracticeCalendar from "./PracticeCalendar";

type CalendarDayData = {
    count: number;
    date: string;
};

type Props = {
    data: CalendarDayData[];
    endDate: Date;
    onClose: () => void;
    onEditDay: (date: string, value: number) => void;
    startDate: Date;
    visible: boolean;
};

export default function PracticeCalendarModal({
    data,
    endDate,
    onClose,
    onEditDay,
    startDate,
    visible,
}: Props) {
    const insets = useSafeAreaInsets();
    const { colors } = useAppTheme();
    const { t } = useI18n();
    const [infoOpen, setInfoOpen] = useState(false);
    const sheetBottomPadding = Math.max(10, insets.bottom);

    return (
        <>
            <Modal
                visible={visible}
                transparent
                animationType="slide"
                statusBarTranslucent
                onRequestClose={onClose}
            >
                <Pressable
                    style={[
                        styles.calendarOverlay,
                        { backgroundColor: colors.overlay },
                    ]}
                    onPress={onClose}
                >
                    <Pressable
                        style={[
                            styles.calendarSheet,
                            {
                                backgroundColor: colors.background,
                                shadowColor: colors.shadow,
                                paddingBottom: sheetBottomPadding,
                            },
                        ]}
                        onPress={() => { }}
                    >
                        <View
                            style={[
                                styles.sheetHandle,
                                { backgroundColor: colors.borderStrong },
                            ]}
                        />

                        <View
                            style={[
                                styles.calendarHeader,
                                { borderColor: colors.borderSubtle },
                            ]}
                        >
                            <Pressable onPress={onClose}>
                                <Text
                                    style={[
                                        styles.calendarClose,
                                        { color: colors.primary },
                                    ]}
                                >
                                    {t("common.close")}
                                </Text>
                            </Pressable>

                            <Pressable
                                onPress={() => setInfoOpen(true)}
                                style={styles.calendarInfoIcon}
                                hitSlop={{
                                    top: 10,
                                    right: 10,
                                    bottom: 10,
                                    left: 10,
                                }}
                                accessibilityRole="button"
                                accessibilityLabel={t("practice.calendarInfoA11y")}
                            >
                                <MaterialIcons
                                    name="info-outline"
                                    size={20}
                                    color={colors.iconMuted}
                                />
                            </Pressable>
                        </View>

                        <PracticeCalendar
                            data={data}
                            startDate={startDate}
                            endDate={endDate}
                            onEditDay={onEditDay}
                        />
                    </Pressable>
                </Pressable>
            </Modal>

            <Modal
                visible={infoOpen}
                transparent
                animationType="fade"
                onRequestClose={() => setInfoOpen(false)}
            >
                <Pressable
                    style={[
                        styles.infoOverlay,
                        { backgroundColor: colors.overlay },
                    ]}
                    onPress={() => setInfoOpen(false)}
                >
                    <Pressable
                        style={[
                            styles.infoModal,
                            { backgroundColor: colors.surfaceElevated },
                        ]}
                        onPress={() => { }}
                    >
                        <Text style={[styles.infoTitle, { color: colors.textPrimary }]}>
                            {t("practice.calendarInfoTitle")}
                        </Text>

                        <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                            {t("practice.calendarInfoText1")}
                        </Text>

                        <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                            {t("practice.calendarInfoText2")}
                        </Text>

                        <Pressable
                            style={styles.infoButton}
                            onPress={() => setInfoOpen(false)}
                        >
                            <Text
                                style={[
                                    styles.infoButtonText,
                                    { color: colors.primary },
                                ]}
                            >
                                {t("common.ok")}
                            </Text>
                        </Pressable>
                    </Pressable>
                </Pressable>
            </Modal>
        </>
    );
}

const styles = StyleSheet.create({
    calendarHeader: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 20,
        paddingBottom: 10,
        borderBottomWidth: 1,
        borderColor: "#eee",
    },

    calendarClose: {
        fontSize: 16,
        fontWeight: "600",
    },

    calendarInfoIcon: {
        width: 28,
        height: 28,
        alignItems: "center",
        justifyContent: "center",
        marginRight: 2,
    },

    calendarOverlay: {
        flex: 1,
        justifyContent: "flex-end",
        backgroundColor: "rgba(0,0,0,0.15)",
    },

    calendarSheet: {
        height: Dimensions.get("window").width > 700 ? "70%" : "60%",
        backgroundColor: "white",
        borderTopLeftRadius: 18,
        borderTopRightRadius: 18,
        paddingTop: 6,
        shadowColor: "#000",
        shadowOpacity: 0.1,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: -3 },
        elevation: 8,
    },

    sheetHandle: {
        width: 40,
        height: 4,
        backgroundColor: "#ddd",
        alignSelf: "center",
        borderRadius: 2,
        marginTop: 6,
        marginBottom: 8,
    },

    infoOverlay: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.35)",
        justifyContent: "center",
        alignItems: "center",
        padding: 20,
    },

    infoModal: {
        width: "100%",
        maxWidth: 420,
        backgroundColor: "white",
        borderRadius: 12,
        padding: 20,
    },

    infoTitle: {
        fontSize: 18,
        fontWeight: "bold",
        marginBottom: 12,
    },

    infoText: {
        fontSize: 14,
        color: "#333",
        marginBottom: 10,
        lineHeight: 20,
    },

    infoButton: {
        marginTop: 10,
        alignSelf: "flex-end",
        paddingVertical: 8,
        paddingHorizontal: 16,
    },

    infoButtonText: {
        fontSize: 15,
        fontWeight: "600",
    },
});
