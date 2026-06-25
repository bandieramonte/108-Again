import { MaterialIcons } from "@expo/vector-icons";
import React from "react";
import {
    Modal,
    Pressable,
    StyleSheet,
    Text,
    useWindowDimensions,
    View,
} from "react-native";
import { useI18n } from "../i18n";

export type PracticeMenuAnchor = {
    x: number;
    y: number;
    width: number;
    height: number;
};

type Props = {
    visible: boolean;
    anchor: PracticeMenuAnchor | null;
    onClose: () => void;
    onEdit: () => void;
    onHistory: () => void;
    onCalendar?: () => void;
    onDelete: () => void;
};

export default function PracticeDropdownMenu({
    visible,
    anchor,
    onClose,
    onEdit,
    onHistory,
    onCalendar,
    onDelete,
}: Props) {
    const { t } = useI18n();
    const { width: screenWidth, height: screenHeight } =
        useWindowDimensions();
    const menuWidth = 220;
    const estimatedMenuHeight = onCalendar ? 184 : 138;
    const screenMargin = 12;

    const menuLeft = anchor
        ? Math.min(
            screenWidth - menuWidth - screenMargin,
            Math.max(
                screenMargin,
                anchor.x + anchor.width / 2 - menuWidth / 2
            )
        )
        : screenMargin;

    const preferredMenuTop = anchor
        ? anchor.y + anchor.height + 8
        : screenMargin;

    const menuTop =
        anchor &&
            preferredMenuTop + estimatedMenuHeight >
            screenHeight - screenMargin
            ? Math.max(
                screenMargin,
                anchor.y - estimatedMenuHeight - 8
            )
            : preferredMenuTop;

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
                {anchor && (
                    <View
                        style={[
                            styles.menu,
                            {
                                top: menuTop,
                                left: menuLeft,
                            },
                        ]}
                    >
                        <Pressable
                            style={styles.item}
                            onPress={onEdit}
                        >
                            <MaterialIcons
                                name="edit"
                                size={18}
                                color="#333"
                            />
                            <Text style={styles.text}>
                                {t("practiceMenu.edit")}
                            </Text>
                        </Pressable>

                        <Pressable
                            style={styles.item}
                            onPress={onHistory}
                        >
                            <MaterialIcons
                                name="show-chart"
                                size={18}
                                color="#333"
                            />
                            <Text style={styles.text}>
                                {t("practiceMenu.history")}
                            </Text>
                        </Pressable>

                        {onCalendar && (
                            <Pressable
                                style={styles.item}
                                onPress={onCalendar}
                            >
                                <MaterialIcons
                                    name="calendar-today"
                                    size={18}
                                    color="#333"
                                />
                                <Text style={styles.text}>
                                    {t("practiceMenu.calendar")}
                                </Text>
                            </Pressable>
                        )}

                        <Pressable
                            style={styles.item}
                            onPress={onDelete}
                        >
                            <MaterialIcons
                                name="delete-outline"
                                size={18}
                                color="#c62828"
                            />
                            <Text
                                style={styles.deleteText}
                            >
                                {t("practiceMenu.delete")}
                            </Text>
                        </Pressable>
                    </View>
                )}
            </Pressable>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
    },

    menu: {
        position: "absolute",
        width: 220,
        backgroundColor: "white",
        borderRadius: 10,
        paddingVertical: 6,
        shadowColor: "#000",
        shadowOpacity: 0.12,
        shadowRadius: 8,
        shadowOffset: {
            width: 0,
            height: 3,
        },
        elevation: 8,
    },

    item: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        paddingVertical: 12,
        paddingHorizontal: 14,
    },

    text: {
        fontSize: 15,
        color: "#333",
    },

    deleteText: {
        fontSize: 15,
        color: "#c62828",
    },
});
