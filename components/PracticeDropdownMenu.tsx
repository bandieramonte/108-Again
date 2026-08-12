import { MaterialIcons } from "@expo/vector-icons";
import React, { useState } from "react";
import {
    Modal,
    Pressable,
    StyleSheet,
    Text,
    useWindowDimensions,
    View,
} from "react-native";
import { useI18n } from "../i18n";
import { useAppTheme } from "../styles/theme";

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
    const { colors } = useAppTheme();
    const { t } = useI18n();
    const {
        width: screenWidth,
        height: screenHeight,
        fontScale,
    } =
        useWindowDimensions();
    const screenMargin = 12;
    const itemCount = onCalendar ? 4 : 3;
    const menuWidth = Math.min(
        screenWidth - screenMargin * 2,
        Math.max(240, 240 * Math.min(fontScale, 1.4))
    );
    const fallbackMenuHeight =
        itemCount * Math.max(46, 24 + 36 * fontScale) + 12;
    const [measuredMenuHeight, setMeasuredMenuHeight] =
        useState<number | null>(null);
    const menuHeight = measuredMenuHeight ?? fallbackMenuHeight;

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
            preferredMenuTop + menuHeight >
            screenHeight - screenMargin
            ? Math.max(
                screenMargin,
                anchor.y - menuHeight - 8
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
                style={[
                    styles.overlay,
                    { backgroundColor: colors.overlay },
                ]}
                onPress={onClose}
            >
                {anchor && (
                    <View
                        style={[
                            styles.menu,
                            {
                                top: menuTop,
                                left: menuLeft,
                                width: menuWidth,
                                backgroundColor: colors.surfaceElevated,
                                shadowColor: colors.shadow,
                                borderColor: colors.borderSubtle,
                            },
                        ]}
                        onLayout={({ nativeEvent }) => {
                            const nextHeight = Math.ceil(
                                nativeEvent.layout.height
                            );

                            setMeasuredMenuHeight(currentHeight =>
                                currentHeight === nextHeight
                                    ? currentHeight
                                    : nextHeight
                            );
                        }}
                    >
                        <Pressable
                            style={styles.item}
                            onPress={onEdit}
                        >
                            <MaterialIcons
                                name="edit"
                                size={18}
                                color={colors.icon}
                            />
                            <Text
                                numberOfLines={2}
                                ellipsizeMode="tail"
                                style={[styles.text, { color: colors.textPrimary }]}
                            >
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
                                color={colors.icon}
                            />
                            <Text
                                numberOfLines={2}
                                ellipsizeMode="tail"
                                style={[styles.text, { color: colors.textPrimary }]}
                            >
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
                                    color={colors.icon}
                                />
                                <Text
                                    numberOfLines={2}
                                    ellipsizeMode="tail"
                                    style={[styles.text, { color: colors.textPrimary }]}
                                >
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
                                color={colors.destructive}
                            />
                            <Text
                                numberOfLines={2}
                                ellipsizeMode="tail"
                                style={[
                                    styles.deleteText,
                                    { color: colors.destructive },
                                ]}
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
        backgroundColor: "white",
        borderWidth: 1,
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
        flex: 1,
        flexShrink: 1,
        minWidth: 0,
        fontSize: 15,
        color: "#333",
    },

    deleteText: {
        flex: 1,
        flexShrink: 1,
        minWidth: 0,
        fontSize: 15,
        color: "#c62828",
    },
});
