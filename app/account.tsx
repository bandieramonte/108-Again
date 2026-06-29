import HeaderMenu from "@/components/HeaderMenu";
import { router, Stack } from "expo-router";
import { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Pressable,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import PrivacyModal from "../components/PrivacyModal";
import { useI18n } from "../i18n";
import * as authService from "../services/authService";
import { getIsOnline } from "../services/networkService";
import * as syncService from "../services/syncService";
import { globalStyles } from "../styles/global";
import { subscribeAuth, subscribeSync } from "../utils/events";

export default function AccountScreen() {
    const { t } = useI18n();
    const initialAuthState = authService.getAuthState();
    const [authState, setAuthState] = useState(initialAuthState);
    const [authChecked, setAuthChecked] =
        useState(initialAuthState.isAuthenticated);
    const [syncState, setSyncState] = useState(syncService.getSyncState());
    const [syncing, setSyncing] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [privacyVisible, setPrivacyVisible] = useState(false);

    useEffect(() => {
        let active = true;

        const unsubscribeAuth = subscribeAuth(() => {
            const nextAuthState = authService.getAuthState();

            setAuthState(nextAuthState);

            if (nextAuthState.isAuthenticated) {
                setAuthChecked(true);
            }
        });

        const unsubscribeSync = subscribeSync(() => {
            setSyncState(syncService.getSyncState());
        });

        void authService
            .initializeAuth()
            .catch(error => {
                console.warn("Account auth verification failed", error);
            })
            .finally(() => {
                if (!active) return;

                setAuthState(authService.getAuthState());
                setAuthChecked(true);
            });

        return () => {
            active = false;
            unsubscribeAuth();
            unsubscribeSync();
        };
    }, []);

    useEffect(() => {
        if (authChecked && !authState.isAuthenticated) {
            router.replace("/");
        }
    }, [authChecked, authState.isAuthenticated]);

    async function handleSignOut() {
        try {
            await authService.signOut();
        } catch (error: any) {
            Alert.alert(
                t("account.logOutFailed"),
                error?.message ?? t("common.unknownError")
            );
        }
    }

    function getTranslatedSyncLabel(state: typeof syncState) {
        switch (state) {
            case "idle":
                return t("account.syncIdle");
            case "syncing":
                return t("account.syncing");
            case "success":
                return t("account.syncSuccess");
            case "error":
                return t("account.syncError");
            case "offline":
                return t("account.syncOffline");
            case "timeout":
                return t("account.syncTimeout");
            default:
                return String(state);
        }
    }

    async function handleSyncNow() {

        if (syncing) return;

        try {
            setSyncing(true);
            console.log("SYNC: start");

            if (!getIsOnline()) {
                Alert.alert(
                    t("account.offlineTitle"),
                    t("account.offlineMessage")
                );
                return;
            }

            const result = await syncService.syncNow(authState.userId);

            if (result === "auth_invalid") {
                return;
            }

            if (result === "policy_unavailable") {
                Alert.alert(
                    t("account.syncPostponedTitle"),
                    t("account.syncPostponedMessage")
                );
                return;
            }

            if (result === "update_required") {
                return;
            }

            console.log("SYNC: finished");
            const state = syncService.getSyncState();

            if (state === "success") {
                Alert.alert(
                    t("account.syncCompleteTitle"),
                    t("account.syncCompleteMessage")
                );
            } else if (state === "error") {
                Alert.alert(
                    t("account.syncFailedTitle"),
                    t("account.syncFailedMessage")
                );
            } else if (state === "timeout") {
                Alert.alert(
                    t("account.syncTimeoutTitle"),
                    t("account.syncTimeoutMessage")
                );
            }
        } catch (error: any) {
            Alert.alert(
                t("account.syncFailedTitle"),
                error?.message ?? t("common.unknownError")
            );
        } finally {
            setSyncing(false);
        }
    }

    async function handleDeleteAccount() {
        if (deleting) return;

        Alert.alert(
            t("account.deleteAccountTitle"),
            t("account.deleteAccountMessage"),
            [
                { text: t("common.cancel"), style: "cancel" },
                {
                    text: t("common.delete"),
                    style: "destructive",
                    onPress: async () => {
                        try {
                            setDeleting(true);

                            await authService.deleteAccount();

                            Alert.alert(
                                t("account.accountDeletedTitle"),
                                t("account.accountDeletedMessage")
                            );

                        } catch (e: any) {
                            Alert.alert(t("account.errorTitle"), e.message);
                        } finally {
                            setDeleting(false);
                        }
                    },
                },
            ]
        );
    }

    if (!authChecked && !authState.isAuthenticated) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#1A5FCC" />
            </View>
        );
    }

    return (
        <>
            <Stack.Screen
                options={{
                    headerRight: () => (
                        <HeaderMenu
                            hideAccountIcon
                            isAuthenticated={authState.isAuthenticated}
                            firstName={authState.firstName}
                            onSignOut={() => { }}
                        />
                    ),
                }}
            />

            <View style={[globalStyles.sidePadding, styles.container]}>
                <Text style={styles.title}>{t("account.title")}</Text>

                <View style={styles.card}>
                    <Text style={styles.label}>{t("account.status")}</Text>
                    <Text style={styles.value}>
                        {authState.isAuthenticated
                            ? t("account.signedIn")
                            : t("account.signedOut")}
                    </Text>

                    <Text style={styles.label}>{t("account.firstName")}</Text>
                    <Text style={styles.value}>{authState.firstName ?? "—"}</Text>

                    <Text style={styles.label}>{t("account.email")}</Text>
                    <Text style={styles.value}>{authState.email ?? "—"}</Text>

                    <Text style={styles.label}>{t("account.syncStatus")}</Text>
                    <View style={styles.syncContainer}>
                        <Text
                            style={[
                                styles.syncLabel,
                                syncState === "error" && { color: "red" },
                                syncState === "offline" && { color: "orange" },
                                syncState === "success" && { color: "green" },
                                syncState === "timeout" && { color: "orange" },
                            ]}
                        >
                            {getTranslatedSyncLabel(syncState)}
                        </Text>
                    </View>
                </View>

                {authState.isAuthenticated && (
                    <>
                        <Pressable
                            style={({ pressed }) => [
                                styles.button,
                                pressed && styles.buttonPressed,
                                (syncing || !getIsOnline()) && styles.buttonDisabled,
                            ]}
                            onPress={handleSyncNow}
                            disabled={syncing || !getIsOnline()}
                        >
                            {syncing ? (
                                <ActivityIndicator />
                            ) : (
                                <Text style={styles.buttonText}>
                                    {t("account.syncNow")}
                                </Text>
                            )}
                        </Pressable>

                        <Pressable
                            style={({ pressed }) => [
                                styles.button,
                                styles.secondaryButton,
                                pressed && styles.buttonPressed,
                            ]}
                            onPress={handleSignOut}
                        >
                            <Text style={styles.buttonText}>
                                {t("menu.logOut")}
                            </Text>
                        </Pressable>

                        <TouchableOpacity
                            onPress={() => setPrivacyVisible(true)}
                            style={[styles.button, styles.secondaryButton]}
                        >
                            <Text style={styles.buttonText}>
                                {t("menu.privacyData")}
                            </Text>
                        </TouchableOpacity>

                        <Pressable
                            onPress={handleDeleteAccount}
                            disabled={deleting}
                            style={({ pressed }) => [
                                styles.deleteButton,
                                pressed && { opacity: 0.7 },
                                deleting && { opacity: 0.5 }
                            ]}
                        >
                            {deleting ? (
                                <ActivityIndicator color="white" />
                            ) : (
                                <Text style={styles.deleteButtonText}>
                                    {t("account.deleteAccount")}
                                </Text>
                            )}
                        </Pressable>
                    </>
                )}
                <PrivacyModal
                    visible={privacyVisible}
                    onClose={() => setPrivacyVisible(false)}
                />

            </View></>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingVertical: 14,
        backgroundColor: "white",
    },

    loadingContainer: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "white",
    },

    title: {
        fontSize: 28,
        fontWeight: "bold",
        marginBottom: 24,
    },

    card: {
        backgroundColor: "#f5f5f5",
        borderRadius: 12,
        padding: 16,
    },

    label: {
        fontSize: 13,
        color: "#666",
        marginTop: 10,
    },

    value: {
        fontSize: 16,
        marginTop: 4,
    },

    button: {
        marginTop: 24,
        backgroundColor: "#e5e7eb",
        borderRadius: 8,
        paddingVertical: 14,
        alignItems: "center",
    },

    secondaryButton: {
        marginTop: 12,
    },

    buttonPressed: {
        opacity: 0.7,
    },

    buttonDisabled: {
        opacity: 0.6,
    },

    buttonText: {
        fontSize: 16,
        fontWeight: "600",
    },

    syncContainer: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        marginTop: 8,
    },

    syncLabel: {
        fontSize: 14,
        opacity: 0.7,
    },

    deleteButton: {
        marginTop: 12,
        padding: 14,
        backgroundColor: "#ff3b30",
        borderRadius: 8,
    },

    deleteButtonText: {
        color: "white",
        textAlign: "center",
        fontWeight: "600",
        fontSize: 16,
    },
});
