import PrivacyModal from "@/components/PrivacyModal";
import * as appService from "@/services/appService";
import * as practiceService from "@/services/practiceService";
import { exportBackup, importBackup } from "@/utils/backup";
import { MAX_PRACTICE_COUNT } from "@/utils/numberUtils";
import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import {
    Alert,
    Modal,
    Pressable,
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

export default function HeaderMenu({
    isAuthenticated,
    onSignOut,
    hideAccountIcon,
}: Props) {
    const router = useRouter();
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
            "Restore Defaults?",
            "This will remove all your practices, sessions, and local data.",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Restore",
                    style: "destructive",
                    onPress: () => {
                        appService.restoreDefaults();
                    }
                }
            ]
        );
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
                                    <Text>Account</Text>
                                </Pressable>

                                <Pressable
                                    style={styles.item}
                                    onPress={() => {
                                        setAccountOpen(false);
                                        onSignOut();
                                    }}
                                >
                                    <Text>Sign Out</Text>
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
                                    <Text>Sign In</Text>
                                </Pressable>

                                <Pressable
                                    style={styles.item}
                                    onPress={() => {
                                        setAccountOpen(false);
                                        router.push("/sign-up");
                                    }}
                                >
                                    <Text>Sign Up</Text>
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
                                const practices = practiceService.getAllPractices();

                                if (practices.length >= MAX_PRACTICE_COUNT) {
                                    setMoreOpen(false);

                                    Alert.alert(
                                        "Maximum reached",
                                        "You can only have up to 10 practices."
                                    );

                                    return;
                                }

                                setMoreOpen(false);
                                router.push("/add-practice");
                            }}
                        >
                            <Text>Add Practice</Text>
                        </Pressable>

                        <Pressable
                            style={styles.item}
                            onPress={() => {
                                setMoreOpen(false);
                                exportBackup();
                            }}
                        >
                            <Text>Export Backup</Text>
                        </Pressable>

                        <Pressable
                            style={styles.item}
                            onPress={() => {
                                setMoreOpen(false);
                                importBackup();
                            }}
                        >
                            <Text>Import Backup</Text>
                        </Pressable>

                        <Pressable
                            style={styles.item}
                            onPress={() => {
                                setMoreOpen(false);
                                handleRestoreDefaults();
                            }}
                        >
                            <Text style={styles.destructiveText}>Restore Defaults</Text>
                        </Pressable>

                        <Pressable
                            style={styles.item}
                            onPress={() => {
                                setMoreOpen(false);
                                router.navigate("/about");
                            }}
                        >
                            <Text>About</Text>
                        </Pressable>

                        <Pressable
                            style={styles.item}
                            onPress={() => {
                                setMoreOpen(false);
                                setPrivacyVisible(true);
                            }}
                        >
                            <Text>Privacy & Data</Text>
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

    destructiveText: {
        color: "#c62828",
    },
});