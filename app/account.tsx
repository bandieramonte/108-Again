import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Pressable,
    StyleSheet,
    Text,
    View,
} from "react-native";
import * as authService from "../services/authService";
import * as syncService from "../services/syncService";
import { getSyncLabel } from "../services/syncService";
import { subscribeAuth, subscribeSync } from "../utils/events";

export default function AccountScreen() {
    const [authState, setAuthState] = useState(authService.getAuthState());
    const [syncState, setSyncState] = useState(syncService.getSyncState());
    const [syncing, setSyncing] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [deletedMessage, setDeletedMessage] = useState(false);

    useEffect(() => {
        const unsubscribeAuth = subscribeAuth(() => {
            setAuthState(authService.getAuthState());
        });

        const unsubscribeSync = subscribeSync(() => {
            setSyncState(syncService.getSyncState());
        });

        return () => {
            unsubscribeAuth();
            unsubscribeSync();
        };
    }, []);

    useEffect(() => {
        if (!authState.isAuthenticated) {
            router.replace("/");
        }
    }, [authState.isAuthenticated]);

    async function handleSignOut() {
        try {
            await authService.signOut();
        } catch (error: any) {
            Alert.alert("Sign out failed", error?.message ?? "Unknown error");
        }
    }

    async function handleSyncNow() {
        if (syncing) return;

        try {
            setSyncing(true);
            await syncService.syncNow(authState.userId);
            Alert.alert("Sync complete", "Local changes were pushed to the cloud.");
        } catch (error: any) {
            Alert.alert("Sync failed", error?.message ?? "Unknown error");
        } finally {
            setSyncing(false);
        }
    }

    async function handleDeleteAccount() {
        if (deleting) return;

        Alert.alert(
            "Delete account",
            "This will permanently delete your online data. Your local data will remain on this device.",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            setDeleting(true);

                            await authService.deleteAccount();

                            Alert.alert(
                                "Account deleted",
                                "Your account has been deleted."
                            );

                        } catch (e: any) {
                            Alert.alert("Error", e.message);
                        } finally {
                            setDeleting(false);
                        }
                    },
                },
            ]
        );
    }

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Account</Text>

            <View style={styles.card}>
                <Text style={styles.label}>Status</Text>
                <Text style={styles.value}>
                    {authState.isAuthenticated ? "Signed in" : "Signed out"}
                </Text>

                <Text style={styles.label}>First name</Text>
                <Text style={styles.value}>{authState.firstName ?? "—"}</Text>

                <Text style={styles.label}>Email</Text>
                <Text style={styles.value}>{authState.email ?? "—"}</Text>

                <Text style={styles.label}>Sync status</Text>
                <View style={styles.syncContainer}>
                    <Text
                        style={[
                            styles.syncLabel,
                            syncState === "error" && { color: "red" },
                            syncState === "offline" && { color: "orange" },
                            syncState === "success" && { color: "green" },
                        ]}
                    >
                        {getSyncLabel(syncState)}
                    </Text>

                    {syncState === "syncing" && (
                        <ActivityIndicator size="small" />
                    )}
                </View>
            </View>

            {authState.isAuthenticated && (
                <>
                    <Pressable
                        style={({ pressed }) => [
                            styles.button,
                            pressed && styles.buttonPressed,
                            syncing && styles.buttonDisabled,
                        ]}
                        onPress={handleSyncNow}
                        disabled={syncing}
                    >
                        {syncing ? (
                            <ActivityIndicator />
                        ) : (
                            <Text style={styles.buttonText}>Sync Now</Text>
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
                        <Text style={styles.buttonText}>Sign Out</Text>
                    </Pressable>

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
                                Delete Account
                            </Text>
                        )}
                    </Pressable>
                </>
            )}
            {deletedMessage && (
                <View style={styles.deletedToast}>
                    <Text style={styles.deletedToastText}>
                        Account deleted successfully
                    </Text>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 20,
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
    },
    deletedToast: {
        position: "absolute",
        bottom: 30,
        left: 20,
        right: 20,
        backgroundColor: "#111",
        padding: 14,
        borderRadius: 8,
        alignItems: "center",
    },

    deletedToastText: {
        color: "white",
        fontSize: 14,
    },
});