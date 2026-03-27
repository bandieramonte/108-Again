import HeaderMenu from "@/components/HeaderMenu";
import HeaderTitle from "@/components/HeaderTitle";
import { supabase } from "@/lib/supabase";
import { exportBackup, importBackup } from "@/utils/backup";
import { subscribeAuth } from "@/utils/events";
import { Stack, router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Alert, Linking } from "react-native";
import * as appService from "../services/appService";
import * as authService from "../services/authService";

export default function Layout() {
    const [authState, setAuthState] = useState(authService.getAuthState());
    const handledDeepLink = useRef(false);

    useEffect(() => {
        async function handleInitialUrl() {
            const url = await Linking.getInitialURL();
            if (url) {
                handleDeepLink(url);
            }
        }

        function handleDeepLink(url: string) {
            if (handledDeepLink.current) return;

            const fragment = url.split("#")[1];
            if (!fragment) return;

            const params = new URLSearchParams(fragment);
            const access_token = params.get("access_token");
            const refresh_token = params.get("refresh_token");
            const type = params.get("type");

            if (type === "recovery" && access_token && refresh_token) {
                handledDeepLink.current = true;

                supabase.auth.setSession({
                    access_token,
                    refresh_token,
                });
            }
        }

        handleInitialUrl();

        const sub = Linking.addEventListener("url", (event) => {
            handleDeepLink(event.url);
        });

        return () => sub.remove();
    }, []);

    useEffect(() => {
        const unsubscribe = subscribeAuth(() => {
            setAuthState(authService.getAuthState());
        });

        return unsubscribe;
    }, []);

    function handleRestoreDefaults() {
        Alert.alert(
            "Restore Defaults?",
            "This will remove all your practices, sessions, adjustments, and local data, and restore the original default practices. This cannot be undone.",
            [
                {
                    text: "Cancel",
                    style: "cancel",
                },
                {
                    text: "Restore",
                    style: "destructive",
                    onPress: () => {
                        appService.restoreDefaults();
                        router.replace("/");
                    },
                },
            ]
        );
    }

    async function handleSignOut() {
        try {
            await authService.signOut();
            router.replace("/");
        } catch (error: any) {
            Alert.alert("Sign out failed", error?.message ?? "Unknown error");
        }
    }

    return (
        <Stack
            screenOptions={{
                headerTitle: () => (
                    <HeaderTitle
                        isAuthenticated={authState.isAuthenticated}
                        firstName={authState.firstName}
                    />
                ),
                headerRight: () => (
                    <HeaderMenu
                        onExport={exportBackup}
                        onImport={importBackup}
                        onRestoreDefaults={handleRestoreDefaults}
                        isAuthenticated={authState.isAuthenticated}
                        firstName={authState.firstName}
                        onSignOut={handleSignOut}
                    />
                ),
            }}
        />
    );
}