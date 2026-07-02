import {
    languageOptions,
    useI18n,
    type LanguageCode,
} from "@/i18n";
import * as authService from "@/services/authService";
import { useAppTheme } from "@/styles/theme";
import { MaterialIcons } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import {
    Modal,
    Pressable,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";

type Props = {
    canGoBack: boolean;
    isAuthenticated: boolean;
    onBack: () => void;
};

export default function HeaderLeftControls({
    canGoBack,
    isAuthenticated,
    onBack,
}: Props) {
    const { colors, isDark, toggleTheme } = useAppTheme();
    const { language, locale, setLanguage, t } = useI18n();
    const [languageOpen, setLanguageOpen] = useState(false);
    const selectedLanguage =
        languageOptions.find(option => option.code === language) ??
        languageOptions[0];
    const sortedLanguageOptions = useMemo(
        () =>
            [...languageOptions].sort((left, right) =>
                t(left.labelKey).localeCompare(
                    t(right.labelKey),
                    locale,
                    { sensitivity: "base" }
                )
            ),
        [locale, t]
    );

    function handleLanguageSelect(nextLanguage: LanguageCode) {
        setLanguageOpen(false);
        void setLanguage(nextLanguage)
            .then(() => {
                if (!isAuthenticated) return;

                return authService.updatePreferredLanguage(nextLanguage);
            })
            .catch(error => {
                console.warn("Failed to update preferred language", error);
            });
    }

    return (
        <View style={styles.container}>
            <Pressable
                onPress={() => {
                    void toggleTheme();
                }}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={
                    isDark
                        ? t("theme.switchToLight")
                        : t("theme.switchToDark")
                }
                style={({ pressed }) => [
                    styles.iconButton,
                    {
                        borderColor: colors.borderSubtle,
                        backgroundColor: colors.surfaceElevated,
                    },
                    pressed && styles.pressed,
                ]}
            >
                <MaterialIcons
                    name={isDark ? "light-mode" : "dark-mode"}
                    size={20}
                    color={colors.icon}
                />
            </Pressable>

            <Pressable
                onPress={() => setLanguageOpen(true)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={t("language.switch")}
                style={({ pressed }) => [
                    styles.languageButton,
                    {
                        borderColor: colors.borderSubtle,
                        backgroundColor: colors.surfaceElevated,
                    },
                    pressed && styles.pressed,
                ]}
            >
                <Text style={styles.flagText}>
                    {selectedLanguage.flag}
                </Text>
            </Pressable>

            {canGoBack && (
                <Pressable
                    onPress={onBack}
                    hitSlop={10}
                    accessibilityRole="button"
                    accessibilityLabel={t("common.back")}
                    style={({ pressed }) => [
                        styles.backButton,
                        pressed && styles.pressed,
                    ]}
                >
                    <MaterialIcons
                        name="arrow-back"
                        size={23}
                        color={colors.icon}
                    />
                </Pressable>
            )}

            <Modal
                visible={languageOpen}
                transparent
                animationType="fade"
                onRequestClose={() => setLanguageOpen(false)}
            >
                <TouchableOpacity
                    style={[
                        styles.overlay,
                        { backgroundColor: colors.overlay },
                    ]}
                    activeOpacity={1}
                    onPress={() => setLanguageOpen(false)}
                >
                    <View
                        style={[
                            styles.languageMenu,
                            {
                                backgroundColor: colors.surfaceElevated,
                                borderColor: colors.borderSubtle,
                            },
                        ]}
                    >
                        {sortedLanguageOptions.map(option => {
                            const selected = option.code === language;

                            return (
                                <Pressable
                                    key={option.code}
                                    style={({ pressed }) => [
                                        styles.languageItem,
                                        selected && {
                                            backgroundColor:
                                                colors.surfaceSelected,
                                        },
                                        pressed && styles.pressed,
                                    ]}
                                    onPress={() => {
                                        handleLanguageSelect(option.code);
                                    }}
                                >
                                    <Text style={styles.languageFlag}>
                                        {option.flag}
                                    </Text>
                                    <Text
                                        style={[
                                            styles.languageText,
                                            { color: colors.textPrimary },
                                        ]}
                                    >
                                        {t(option.labelKey)}
                                    </Text>
                                    {selected && (
                                        <MaterialIcons
                                            name="check"
                                            size={18}
                                            color={colors.primary}
                                        />
                                    )}
                                </Pressable>
                            );
                        })}
                    </View>
                </TouchableOpacity>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        marginLeft: 8,
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
    },

    iconButton: {
        width: 30,
        height: 30,
        borderRadius: 15,
        borderWidth: 1,
        alignItems: "center",
        justifyContent: "center",
    },

    languageButton: {
        width: 30,
        height: 30,
        borderRadius: 15,
        borderWidth: 1,
        alignItems: "center",
        justifyContent: "center",
    },

    flagText: {
        fontSize: 18,
    },

    backButton: {
        width: 28,
        height: 30,
        alignItems: "center",
        justifyContent: "center",
    },

    pressed: {
        opacity: 0.55,
    },

    overlay: {
        flex: 1,
        justifyContent: "flex-start",
        alignItems: "flex-start",
        paddingTop: 55,
        paddingLeft: 8,
    },

    languageMenu: {
        borderRadius: 10,
        borderWidth: 1,
        paddingVertical: 6,
        width: 190,
        elevation: 5,
        marginTop: 4,
    },

    languageItem: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        paddingVertical: 10,
        paddingHorizontal: 14,
    },

    languageFlag: {
        fontSize: 20,
    },

    languageText: {
        flex: 1,
        fontSize: 15,
    },
});
