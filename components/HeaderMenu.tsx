import PrivacyModal from "@/components/PrivacyModal";
import { useI18n } from "@/i18n";
import * as appService from "@/services/appService";
import { useAppTheme } from "@/styles/theme";
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
    disableAccountIcon?: boolean;
};

const PLAY_STORE_URL =
    "https://play.google.com/store/apps/details?id=com.bandieramonte.app108again";

export default function HeaderMenu({
    disableAccountIcon,
    isAuthenticated,
    onSignOut,
}: Props) {
    const router = useRouter();
    const { colors } = useAppTheme();
    const { t } = useI18n();
    const [moreOpen, setMoreOpen] = useState(false);
    const [accountOpen, setAccountOpen] = useState(false);
    const moreButtonRef = useRef<View | null>(null);
    const [menuAnchor, setMenuAnchor] = useState<{
        x: number;
        y: number;
        width: number;
        height: number;
    } | null>(null);
    const [privacyVisible, setPrivacyVisible] = useState(false);

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
            <Pressable
                onPress={() => {
                    if (disableAccountIcon) return;

                    if (isAuthenticated) {
                        router.push("/account");
                    } else {
                        setAccountOpen(true);
                    }
                }}
                disabled={disableAccountIcon}
                hitSlop={10}
                style={({ pressed }) => [
                    styles.iconButton,
                    disableAccountIcon && styles.iconButtonDisabled,
                    pressed && !disableAccountIcon && { opacity: 0.5 }
                ]}
            >
                <MaterialIcons
                    name="account-circle"
                    size={24}
                    color={colors.icon}
                />
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
                <MaterialIcons
                    name="more-vert"
                    size={24}
                    color={colors.icon}
                />
            </Pressable>

            <Modal
                visible={accountOpen}
                transparent
                animationType="fade"
                onRequestClose={() => setAccountOpen(false)}
            >
                <TouchableOpacity
                    style={[
                        styles.overlay,
                        { backgroundColor: colors.overlay },
                    ]}
                    activeOpacity={1}
                    onPress={() => setAccountOpen(false)}
                >
                    <View
                        style={[
                            styles.menu,
                            {
                                backgroundColor: colors.surfaceElevated,
                                borderColor: colors.borderSubtle,
                            },
                        ]}
                    >
                        {isAuthenticated ? (
                            <>
                                <Pressable
                                    style={styles.item}
                                    onPress={() => {
                                        setAccountOpen(false);
                                        router.push("/account");
                                    }}
                                >
                                    <Text style={{ color: colors.textPrimary }}>
                                        {t("menu.account")}
                                    </Text>
                                </Pressable>

                                <Pressable
                                    style={styles.item}
                                    onPress={() => {
                                        setAccountOpen(false);
                                        onSignOut();
                                    }}
                                >
                                    <Text style={{ color: colors.textPrimary }}>
                                        {t("menu.logOut")}
                                    </Text>
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
                                    <Text style={{ color: colors.textPrimary }}>
                                        {t("menu.logIn")}
                                    </Text>
                                </Pressable>

                                <Pressable
                                    style={styles.item}
                                    onPress={() => {
                                        setAccountOpen(false);
                                        router.push("/sign-up");
                                    }}
                                >
                                    <Text style={{ color: colors.textPrimary }}>
                                        {t("menu.createAccount")}
                                    </Text>
                                </Pressable>
                            </>
                        )}
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
                    style={[
                        styles.overlay,
                        { backgroundColor: colors.overlay },
                    ]}
                    activeOpacity={1}
                    onPress={() => setMoreOpen(false)}
                >
                    <View
                        style={[
                            styles.menu,
                            {
                                backgroundColor: colors.surfaceElevated,
                                borderColor: colors.borderSubtle,
                            },
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
                            <Text style={{ color: colors.textPrimary }}>
                                {t("menu.exportBackup")}
                            </Text>
                        </Pressable>

                        <Pressable
                            style={styles.item}
                            onPress={() => {
                                setMoreOpen(false);
                                importBackup();
                            }}
                        >
                            <Text style={{ color: colors.textPrimary }}>
                                {t("menu.importBackup")}
                            </Text>
                        </Pressable>

                        <Pressable
                            style={styles.item}
                            onPress={() => {
                                setMoreOpen(false);
                                handleRestoreDefaults();
                            }}
                        >
                            <Text
                                style={[
                                    styles.destructiveText,
                                    { color: colors.destructive },
                                ]}
                            >
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
                            <Text style={{ color: colors.textPrimary }}>
                                {t("menu.shareApp")}
                            </Text>
                        </Pressable>

                        <Pressable
                            style={styles.item}
                            onPress={() => {
                                setMoreOpen(false);
                                router.navigate("/about");
                            }}
                        >
                            <Text style={{ color: colors.textPrimary }}>
                                {t("menu.about")}
                            </Text>
                        </Pressable>

                        <Pressable
                            style={styles.item}
                            onPress={() => {
                                setMoreOpen(false);
                                setPrivacyVisible(true);
                            }}
                        >
                            <Text style={{ color: colors.textPrimary }}>
                                {t("menu.privacyData")}
                            </Text>
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

    iconButtonDisabled: {
        opacity: 0.45,
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
        borderRadius: 6,
        borderWidth: 1,
        paddingVertical: 10,
        width: 190,
        elevation: 5,
        marginTop: 4,
    },

    item: {
        paddingVertical: 10,
        paddingHorizontal: 15,
    },

    destructiveText: {
        color: "#c62828",
    },
});
