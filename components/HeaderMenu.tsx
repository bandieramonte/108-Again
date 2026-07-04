import PrivacyModal from "@/components/PrivacyModal";
import {
    languageOptions,
    useI18n,
    type LanguageCode,
} from "@/i18n";
import * as appService from "@/services/appService";
import * as authService from "@/services/authService";
import {
    useAppTheme,
    type AppThemePreference,
} from "@/styles/theme";
import { exportBackup, importBackup } from "@/utils/backup";
import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
    Alert,
    Modal,
    Pressable,
    ScrollView,
    Share,
    StyleSheet,
    Text,
    View,
} from "react-native";

type Props = {
    isAuthenticated: boolean;
    firstName: string | null;
    onSignOut: () => void;
    disableAccountLink?: boolean;
};

type IconName = keyof typeof MaterialIcons.glyphMap;

type SettingsRowProps = {
    icon: IconName;
    label: string;
    value?: string;
    destructive?: boolean;
    disabled?: boolean;
    expanded?: boolean;
    selected?: boolean;
    onPress: () => void;
};

const PLAY_STORE_URL =
    "https://play.google.com/store/apps/details?id=com.bandieramonte.app108again";

export default function HeaderMenu({
    disableAccountLink,
    firstName,
    isAuthenticated,
    onSignOut,
}: Props) {
    const router = useRouter();
    const {
        colors,
        isDark,
        setThemePreference,
        themePreference,
    } = useAppTheme();
    const { language, locale, setLanguage, t } = useI18n();
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [themeExpanded, setThemeExpanded] = useState(false);
    const [languageExpanded, setLanguageExpanded] = useState(false);
    const [privacyVisible, setPrivacyVisible] = useState(false);
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

    function closeSettings() {
        setThemeExpanded(false);
        setLanguageExpanded(false);
        setSettingsOpen(false);
    }

    function handleRestoreDefaults() {
        closeSettings();

        Alert.alert(
            t("menu.restoreDefaultsTitle"),
            t("menu.restoreDefaultsMessage"),
            [
                { text: t("common.cancel"), style: "cancel" },
                {
                    text: t("common.restore"),
                    style: "destructive",
                    onPress: () => {
                        appService.restoreDefaults();
                    }
                }
            ]
        );
    }

    async function handleShareApp() {
        closeSettings();

        try {
            await Share.share({
                title: "108 Again",
                message: t("menu.shareMessage", { url: PLAY_STORE_URL }),
                url: PLAY_STORE_URL,
            });
        } catch (error: any) {
            Alert.alert(
                t("menu.shareFailed"),
                error?.message ?? t("menu.shareUnavailable")
            );
        }
    }

    function handleLanguageSelect(nextLanguage: LanguageCode) {
        closeSettings();
        void setLanguage(nextLanguage)
            .then(() => {
                if (!isAuthenticated) return;

                return authService.updatePreferredLanguage(nextLanguage);
            })
            .catch(error => {
                console.warn("Failed to update preferred language", error);
            });
    }

    function handleThemeSelect(nextThemePreference: AppThemePreference) {
        setThemeExpanded(false);
        void setThemePreference(nextThemePreference);
    }

    function getThemePreferenceLabel(
        nextThemePreference: AppThemePreference
    ) {
        switch (nextThemePreference) {
            case "system":
                return t("settings.systemTheme");
            case "dark":
                return t("settings.darkTheme");
            case "light":
            default:
                return t("settings.lightTheme");
        }
    }

    function getThemePreferenceIcon(
        nextThemePreference: AppThemePreference
    ): IconName {
        switch (nextThemePreference) {
            case "system":
                return "phone-android";
            case "dark":
                return "dark-mode";
            case "light":
            default:
                return "light-mode";
        }
    }

    function navigateTo(path: "/account" | "/about" | "/sign-in" | "/sign-up") {
        closeSettings();
        router.push(path);
    }

    function handleExportBackup() {
        closeSettings();
        exportBackup();
    }

    function handleImportBackup() {
        closeSettings();
        importBackup();
    }

    function handlePrivacyPress() {
        closeSettings();
        setPrivacyVisible(true);
    }

    function handleSignOutPress() {
        closeSettings();
        onSignOut();
    }

    function renderSection(title: string) {
        return (
            <Text
                style={[
                    styles.sectionTitle,
                    { color: colors.textSecondary },
                ]}
            >
                {title}
            </Text>
        );
    }

    function renderRow({
        icon,
        label,
        value,
        destructive,
        disabled,
        expanded,
        selected,
        onPress,
    }: SettingsRowProps) {
        const textColor = destructive ? colors.destructive : colors.textPrimary;

        return (
            <Pressable
                onPress={onPress}
                disabled={disabled}
                accessibilityRole="button"
                style={({ pressed }) => [
                    styles.item,
                    pressed && !disabled && {
                        backgroundColor: colors.surfaceSelected,
                    },
                    disabled && styles.itemDisabled,
                ]}
            >
                <MaterialIcons
                    name={icon}
                    size={21}
                    color={destructive ? colors.destructive : colors.icon}
                />
                <Text
                    numberOfLines={1}
                    style={[
                        styles.itemLabel,
                        { color: textColor },
                    ]}
                >
                    {label}
                </Text>
                {value && (
                    <Text
                        numberOfLines={1}
                        style={[
                            styles.itemValue,
                            { color: colors.textSecondary },
                        ]}
                    >
                        {value}
                    </Text>
                )}
                {expanded !== undefined && (
                    <MaterialIcons
                        name={
                            expanded
                                ? "keyboard-arrow-up"
                                : "keyboard-arrow-down"
                        }
                        size={22}
                        color={colors.iconMuted}
                    />
                )}
                {selected && (
                    <MaterialIcons
                        name="check"
                        size={18}
                        color={colors.primary}
                    />
                )}
            </Pressable>
        );
    }

    return (
        <View style={styles.container}>
            <Pressable
                onPress={() => setSettingsOpen(true)}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel={t("settings.open")}
                style={({ pressed }) => [
                    styles.settingsButton,
                    pressed && styles.pressed,
                ]}
            >
                <MaterialIcons
                    name="tune"
                    size={20}
                    color={colors.icon}
                />
            </Pressable>

            <Modal
                visible={settingsOpen}
                transparent
                animationType="fade"
                onRequestClose={closeSettings}
            >
                <View style={styles.modalRoot}>
                    <Pressable
                        style={[
                            StyleSheet.absoluteFill,
                            { backgroundColor: colors.overlay },
                        ]}
                        onPress={closeSettings}
                    />

                    <View
                        style={[
                            styles.menu,
                            {
                                backgroundColor: colors.surfaceElevated,
                                borderColor: colors.borderSubtle,
                            },
                        ]}
                    >
                        <ScrollView
                            bounces={false}
                            showsVerticalScrollIndicator={false}
                            contentContainerStyle={styles.menuContent}
                        >
                            <Text
                                style={[
                                    styles.title,
                                    { color: colors.textPrimary },
                                ]}
                            >
                                {t("settings.title")}
                            </Text>

                            {renderSection(t("settings.account"))}
                            {isAuthenticated ? (
                                <>
                                    {renderRow({
                                        icon: "account-circle",
                                        label: t("menu.account"),
                                        value:
                                            firstName ??
                                            t("account.signedIn"),
                                        disabled: disableAccountLink,
                                        onPress: () => navigateTo("/account"),
                                    })}
                                    {renderRow({
                                        icon: "logout",
                                        label: t("menu.logOut"),
                                        onPress: handleSignOutPress,
                                    })}
                                </>
                            ) : (
                                <>
                                    {renderRow({
                                        icon: "login",
                                        label: t("menu.logIn"),
                                        onPress: () => navigateTo("/sign-in"),
                                    })}
                                    {renderRow({
                                        icon: "person-add",
                                        label: t("menu.createAccount"),
                                        onPress: () => navigateTo("/sign-up"),
                                    })}
                                </>
                            )}

                            {renderSection(t("settings.preferences"))}
                            {renderRow({
                                icon: themePreference === "system"
                                    ? "phone-android"
                                    : isDark
                                        ? "dark-mode"
                                        : "light-mode",
                                label: t("settings.theme"),
                                value: getThemePreferenceLabel(
                                    themePreference
                                ),
                                expanded: themeExpanded,
                                onPress: () => {
                                    setLanguageExpanded(false);
                                    setThemeExpanded(value => !value);
                                },
                            })}
                            {themeExpanded && (
                                <View
                                    style={[
                                        styles.languageList,
                                        {
                                            borderColor:
                                                colors.borderSubtle,
                                        },
                                    ]}
                                >
                                    {(["light", "dark", "system"] as const)
                                        .map(option => {
                                            const selected =
                                                option === themePreference;

                                            return (
                                                <Pressable
                                                    key={option}
                                                    onPress={() =>
                                                        handleThemeSelect(
                                                            option
                                                        )
                                                    }
                                                    style={({ pressed }) => [
                                                        styles.languageItem,
                                                        selected && {
                                                            backgroundColor:
                                                                colors.surfaceSelected,
                                                        },
                                                        pressed && {
                                                            backgroundColor:
                                                                colors.surfaceSelected,
                                                        },
                                                    ]}
                                                >
                                                    <MaterialIcons
                                                        name={
                                                            getThemePreferenceIcon(
                                                                option
                                                            )
                                                        }
                                                        size={20}
                                                        color={colors.icon}
                                                    />
                                                    <Text
                                                        numberOfLines={1}
                                                        style={[
                                                            styles.languageText,
                                                            {
                                                                color:
                                                                    colors.textPrimary,
                                                            },
                                                        ]}
                                                    >
                                                        {getThemePreferenceLabel(
                                                            option
                                                        )}
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
                            )}
                            {renderRow({
                                icon: "language",
                                label: t("settings.language"),
                                value: `${selectedLanguage.flag} ${t(
                                    selectedLanguage.labelKey
                                )}`,
                                expanded: languageExpanded,
                                onPress: () => {
                                    setThemeExpanded(false);
                                    setLanguageExpanded(value => !value);
                                },
                            })}
                            {languageExpanded && (
                                <View
                                    style={[
                                        styles.languageList,
                                        {
                                            borderColor:
                                                colors.borderSubtle,
                                        },
                                    ]}
                                >
                                    {sortedLanguageOptions.map(option => {
                                        const selected =
                                            option.code === language;

                                        return (
                                            <Pressable
                                                key={option.code}
                                                onPress={() =>
                                                    handleLanguageSelect(
                                                        option.code
                                                    )
                                                }
                                                style={({ pressed }) => [
                                                    styles.languageItem,
                                                    selected && {
                                                        backgroundColor:
                                                            colors.surfaceSelected,
                                                    },
                                                    pressed && {
                                                        backgroundColor:
                                                            colors.surfaceSelected,
                                                    },
                                                ]}
                                            >
                                                <Text
                                                    style={styles.languageFlag}
                                                >
                                                    {option.flag}
                                                </Text>
                                                <Text
                                                    numberOfLines={1}
                                                    style={[
                                                        styles.languageText,
                                                        {
                                                            color:
                                                                colors.textPrimary,
                                                        },
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
                            )}

                            {renderSection(t("settings.backupRestore"))}
                            {renderRow({
                                icon: "file-download",
                                label: t("menu.exportBackup"),
                                onPress: handleExportBackup,
                            })}
                            {renderRow({
                                icon: "file-upload",
                                label: t("menu.importBackup"),
                                onPress: handleImportBackup,
                            })}
                            {renderRow({
                                icon: "restore",
                                label: t("menu.restoreDefaults"),
                                destructive: true,
                                onPress: handleRestoreDefaults,
                            })}

                            {renderSection(t("settings.app"))}
                            {renderRow({
                                icon: "share",
                                label: t("menu.shareApp"),
                                onPress: handleShareApp,
                            })}
                            {renderRow({
                                icon: "info-outline",
                                label: t("menu.about"),
                                onPress: () => navigateTo("/about"),
                            })}
                            {renderRow({
                                icon: "lock-outline",
                                label: t("menu.privacyData"),
                                onPress: handlePrivacyPress,
                            })}
                        </ScrollView>
                    </View>
                </View>
            </Modal>
            <PrivacyModal
                visible={privacyVisible}
                onClose={() => setPrivacyVisible(false)}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        marginRight: 10,
        flexDirection: "row",
        alignItems: "center",
    },

    settingsButton: {
        width: 34,
        height: 34,
        alignItems: "center",
        justifyContent: "center",
    },

    pressed: {
        opacity: 0.55,
    },

    modalRoot: {
        flex: 1,
        alignItems: "flex-end",
        paddingTop: 55,
        paddingRight: 8,
    },

    menu: {
        width: 286,
        maxWidth: "94%",
        maxHeight: "86%",
        borderRadius: 10,
        borderWidth: 1,
        elevation: 5,
        shadowOpacity: 0.2,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
        overflow: "hidden",
    },

    menuContent: {
        paddingVertical: 10,
    },

    title: {
        fontSize: 18,
        fontWeight: "700",
        paddingHorizontal: 16,
        paddingTop: 4,
        paddingBottom: 8,
    },

    sectionTitle: {
        fontSize: 12,
        fontWeight: "700",
        paddingHorizontal: 16,
        paddingTop: 13,
        paddingBottom: 5,
        textTransform: "uppercase",
    },

    item: {
        minHeight: 44,
        flexDirection: "row",
        alignItems: "center",
        gap: 11,
        paddingVertical: 9,
        paddingHorizontal: 16,
    },

    itemDisabled: {
        opacity: 0.45,
    },

    itemLabel: {
        flex: 1,
        fontSize: 15,
    },

    itemValue: {
        maxWidth: 108,
        fontSize: 14,
    },

    languageList: {
        marginHorizontal: 12,
        borderWidth: 1,
        borderRadius: 8,
        overflow: "hidden",
    },

    languageItem: {
        minHeight: 42,
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        paddingVertical: 8,
        paddingHorizontal: 12,
    },

    languageFlag: {
        fontSize: 20,
    },

    languageText: {
        flex: 1,
        fontSize: 15,
    },
});
