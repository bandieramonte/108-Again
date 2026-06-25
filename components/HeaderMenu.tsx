import PrivacyModal from "@/components/PrivacyModal";
import { languageOptions, useI18n } from "@/i18n";
import * as appService from "@/services/appService";
import { exportBackup, importBackup } from "@/utils/backup";
import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import {
    Alert,
    Modal,
    Pressable,
    Share,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";

type Props = {
    isAuthenticated: boolean;
    firstName: string | null;
    onSignOut: () => void;
    hideAccountIcon?: boolean;
};

const PLAY_STORE_URL =
    "https://play.google.com/store/apps/details?id=com.bandieramonte.app108again";

export default function HeaderMenu({
    isAuthenticated,
    onSignOut,
    hideAccountIcon,
}: Props) {
    const router = useRouter();
    const { language, setLanguage, t } = useI18n();
    const [moreOpen, setMoreOpen] = useState(false);
    const [accountOpen, setAccountOpen] = useState(false);
    const [languageOpen, setLanguageOpen] = useState(false);
    const moreButtonRef = useRef<View | null>(null);
    const [menuAnchor, setMenuAnchor] = useState<{
        x: number;
        y: number;
        width: number;
        height: number;
    } | null>(null);
    const [privacyVisible, setPrivacyVisible] = useState(false);
    const selectedLanguage =
        languageOptions.find(option => option.code === language) ??
        languageOptions[0];

    function handleRestoreDefaults() {
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

    return (
        <View style={styles.container}>
            {!hideAccountIcon ? (
                <Pressable
                    onPress={() => {
                        if (isAuthenticated) {
                            router.push("/account");
                        } else {
                            setAccountOpen(true);
                        }
                    }}
                    hitSlop={10}
                    style={({ pressed }) => [
                        styles.iconButton,
                        pressed && { opacity: 0.5 }
                    ]}
                >
                    <MaterialIcons name="account-circle" size={24} />
                </Pressable>
            ) : (
                <View style={{ width: 32 }} />
            )}

            <Pressable
                onPress={() => setLanguageOpen(true)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={t("language.switch")}
                style={({ pressed }) => [
                    styles.languageButton,
                    pressed && { opacity: 0.5 }
                ]}
            >
                <Text style={styles.flagText}>
                    {selectedLanguage.flag}
                </Text>
            </Pressable>

            <Pressable
                ref={moreButtonRef}
                onPress={() => {
                    const target = moreButtonRef.current;

                    if (!target) {
                        setMoreOpen(true);
                        return;
                    }

                    (target as any).measure(
                        (
                            _x: number,
                            _y: number,
                            width: number,
                            height: number,
                            pageX: number,
                            pageY: number
                        ) => {
                            setMenuAnchor({
                                x: pageX,
                                y: pageY,
                                width,
                                height,
                            });

                            setMoreOpen(true);
                        }
                    );
                }}
                hitSlop={4}
                style={styles.iconButton}
            >
                <MaterialIcons name="more-vert" size={24} />
            </Pressable>

            <Modal
                visible={accountOpen}
                transparent
                animationType="fade"
                onRequestClose={() => setAccountOpen(false)}
            >
                <TouchableOpacity
                    style={styles.overlay}
                    activeOpacity={1}
                    onPress={() => setAccountOpen(false)}
                >
                    <View style={styles.menu}>
                        {isAuthenticated ? (
                            <>
                                <Pressable
                                    style={styles.item}
                                    onPress={() => {
                                        setAccountOpen(false);
                                        router.push("/account");
                                    }}
                                >
                                    <Text>{t("menu.account")}</Text>
                                </Pressable>

                                <Pressable
                                    style={styles.item}
                                    onPress={() => {
                                        setAccountOpen(false);
                                        onSignOut();
                                    }}
                                >
                                    <Text>{t("menu.logOut")}</Text>
                                </Pressable>
                            </>
                        ) : (
                            <>
                                <Pressable
                                    style={styles.item}
                                    onPress={() => {
                                        setAccountOpen(false);
                                        router.push("/sign-in");
                                    }}
                                >
                                    <Text>{t("menu.logIn")}</Text>
                                </Pressable>

                                <Pressable
                                    style={styles.item}
                                    onPress={() => {
                                        setAccountOpen(false);
                                        router.push("/sign-up");
                                    }}
                                >
                                    <Text>{t("menu.createAccount")}</Text>
                                </Pressable>
                            </>
                        )}
                    </View>
                </TouchableOpacity>
            </Modal>

            <Modal
                visible={languageOpen}
                transparent
                animationType="fade"
                onRequestClose={() => setLanguageOpen(false)}
            >
                <TouchableOpacity
                    style={styles.overlay}
                    activeOpacity={1}
                    onPress={() => setLanguageOpen(false)}
                >
                    <View style={styles.languageMenu}>
                        {languageOptions.map(option => {
                            const selected = option.code === language;

                            return (
                                <Pressable
                                    key={option.code}
                                    style={[
                                        styles.languageItem,
                                        selected && styles.languageItemSelected
                                    ]}
                                    onPress={() => {
                                        setLanguageOpen(false);
                                        void setLanguage(option.code);
                                    }}
                                >
                                    <Text style={styles.languageFlag}>
                                        {option.flag}
                                    </Text>
                                    <Text style={styles.languageText}>
                                        {t(option.labelKey)}
                                    </Text>
                                    {selected && (
                                        <MaterialIcons
                                            name="check"
                                            size={18}
                                            color="#1A5FCC"
                                        />
                                    )}
                                </Pressable>
                            );
                        })}
                    </View>
                </TouchableOpacity>
            </Modal>

            <Modal
                visible={moreOpen}
                transparent
                animationType="fade"
                onRequestClose={() => setMoreOpen(false)}
            >
                <TouchableOpacity
                    style={styles.overlay}
                    activeOpacity={1}
                    onPress={() => setMoreOpen(false)}
                >
                    <View
                        style={[
                            styles.menu,
                            menuAnchor && {
                                position: "absolute",
                                top: menuAnchor.y + menuAnchor.height + 6,
                                right: 10
                            }
                        ]}
                    >
                        <Pressable
                            style={styles.item}
                            onPress={() => {
                                setMoreOpen(false);
                                exportBackup();
                            }}
                        >
                            <Text>{t("menu.exportBackup")}</Text>
                        </Pressable>

                        <Pressable
                            style={styles.item}
                            onPress={() => {
                                setMoreOpen(false);
                                importBackup();
                            }}
                        >
                            <Text>{t("menu.importBackup")}</Text>
                        </Pressable>

                        <Pressable
                            style={styles.item}
                            onPress={() => {
                                setMoreOpen(false);
                                handleRestoreDefaults();
                            }}
                        >
                            <Text style={styles.destructiveText}>
                                {t("menu.restoreDefaults")}
                            </Text>
                        </Pressable>

                        <Pressable
                            style={styles.item}
                            onPress={() => {
                                setMoreOpen(false);
                                handleShareApp();
                            }}
                        >
                            <Text>{t("menu.shareApp")}</Text>
                        </Pressable>

                        <Pressable
                            style={styles.item}
                            onPress={() => {
                                setMoreOpen(false);
                                router.navigate("/about");
                            }}
                        >
                            <Text>{t("menu.about")}</Text>
                        </Pressable>

                        <Pressable
                            style={styles.item}
                            onPress={() => {
                                setMoreOpen(false);
                                setPrivacyVisible(true);
                            }}
                        >
                            <Text>{t("menu.privacyData")}</Text>
                        </Pressable>

                    </View>
                </TouchableOpacity>
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

    iconButton: {
        marginLeft: 8,
    },

    languageButton: {
        marginLeft: 8,
        minWidth: 28,
        minHeight: 28,
        alignItems: "center",
        justifyContent: "center",
    },

    flagText: {
        fontSize: 20,
    },

    overlay: {
        flex: 1,
        justifyContent: "flex-start",
        alignItems: "flex-end",
        paddingTop: 55,
        paddingRight: 6,
        backgroundColor: "rgba(0,0,0,0.1)",
    },

    menu: {
        backgroundColor: "white",
        borderRadius: 6,
        paddingVertical: 10,
        width: 190,
        elevation: 5,
        marginTop: 4,
    },

    item: {
        paddingVertical: 10,
        paddingHorizontal: 15,
    },

    languageMenu: {
        backgroundColor: "white",
        borderRadius: 10,
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

    languageItemSelected: {
        backgroundColor: "#EEF2FF",
    },

    languageFlag: {
        fontSize: 20,
    },

    languageText: {
        flex: 1,
        fontSize: 15,
        color: "#111",
    },

    destructiveText: {
        color: "#c62828",
    },
});
