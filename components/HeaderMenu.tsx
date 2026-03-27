import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
    Modal,
    Pressable,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";

type Props = {
    onExport: () => void;
    onImport: () => void;
    onRestoreDefaults: () => void;
    isAuthenticated: boolean;
    firstName: string | null;
    onSignOut: () => void;
};

export default function HeaderMenu({
    onExport,
    onImport,
    onRestoreDefaults,
    isAuthenticated,
    onSignOut,
}: Props) {
    const router = useRouter();
    const [moreOpen, setMoreOpen] = useState(false);
    const [accountOpen, setAccountOpen] = useState(false);

    return (
        <View style={styles.container}>
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

            <Pressable
                onPress={() => setMoreOpen(true)}
                hitSlop={10}
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
                    <View style={styles.menu}>
                        <Pressable
                            style={styles.item}
                            onPress={() => {
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
                                onExport();
                            }}
                        >
                            <Text>Export Backup</Text>
                        </Pressable>

                        <Pressable
                            style={styles.item}
                            onPress={() => {
                                setMoreOpen(false);
                                onImport();
                            }}
                        >
                            <Text>Import Backup</Text>
                        </Pressable>

                        <Pressable
                            style={styles.item}
                            onPress={() => {
                                setMoreOpen(false);
                                onRestoreDefaults();
                            }}
                        >
                            <Text style={styles.destructiveText}>Restore Defaults</Text>
                        </Pressable>
                    </View>
                </TouchableOpacity>
            </Modal>
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
        paddingLeft: 8,
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