import HeaderMenu from "@/components/HeaderMenu";
import HeaderTitle from "@/components/HeaderTitle";
import { getSupabase } from "@/lib/supabase";
import { subscribeAuth } from "@/utils/events";
import { MaterialIcons } from "@expo/vector-icons";
import { Stack, router, usePathname } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Alert, Linking, Pressable, View } from "react-native";
import * as appService from "../services/appService";
import * as authService from "../services/authService";
import * as lastPracticeScreenService from "../services/lastPracticeScreenService";
import * as practiceService from "../services/practiceService";

export default function Layout() {
    const [authState, setAuthState] = useState(authService.getAuthState());
    const [appInitialized, setAppInitialized] = useState(false);
    const [initialUrlChecked, setInitialUrlChecked] = useState(false);
    const [startupRouteHandled, setStartupRouteHandled] = useState(false);
    const pathname = usePathname();
    const handledDeepLink = useRef(false);
    const initialUrlPresent = useRef(false);
    const restoringPracticeRoute = useRef(false);

    useEffect(() => {
        let cancelled = false;

        async function initialize() {
            await appService.initializeApp();

            if (!cancelled) {
                setAppInitialized(true);
            }
        }

        initialize();

        return () => {
            cancelled = true;
        };
    }, []);


    useEffect(() => {
        appService.initAppStateListener(() => {
            appService.handleAppResume();
        });
    }, []);

    useEffect(() => {
        async function handleInitialUrl() {
            const url = await Linking.getInitialURL();
            if (url) {
                initialUrlPresent.current = true;
                handleDeepLink(url);
            }

            setInitialUrlChecked(true);
        }

        async function handleDeepLink(url: string) {
            if (handledDeepLink.current) return;

            const fragment = url.split("#")[1];
            if (!fragment) return;

            const params = new URLSearchParams(fragment);
            const access_token = params.get("access_token");
            const refresh_token = params.get("refresh_token");
            const type = params.get("type");

            if (type === "recovery" && access_token && refresh_token) {
                authService.setPasswordRecoveryFlow(true);

                handledDeepLink.current = true;

                console.log("Setting recovery session...");
                const supabase = getSupabase();
                const { error } = await supabase.auth.setSession({
                    access_token,
                    refresh_token,
                });

                if (error) {
                    console.error("setSession failed:", error);
                    Alert.alert(
                        "Reset failed",
                        "Invalid or expired password reset link."
                    );
                    return;
                }

                console.log("Recovery session established");

                router.replace("/reset-password");
            }
        }

        handleInitialUrl();

        const sub = Linking.addEventListener("url", (event) => {
            handleDeepLink(event.url);
        });

        return () => sub.remove();
    }, []);

    useEffect(() => {
        if (!appInitialized || !initialUrlChecked) return;

        let cancelled = false;

        async function restorePracticeRoute() {
            if (handledDeepLink.current || initialUrlPresent.current) {
                setStartupRouteHandled(true);
                return;
            }

            const practiceId =
                await lastPracticeScreenService
                    .getRestorableLastPracticeScreen(
                        (id) => !!practiceService.getPractice(id)
                    );

            if (cancelled) return;

            if (!practiceId) {
                setStartupRouteHandled(true);
                return;
            }

            restoringPracticeRoute.current = true;

            router.replace({
                pathname: "/practice",
                params: { id: practiceId },
            });

            if (!cancelled) {
                setStartupRouteHandled(true);
            }
        }

        restorePracticeRoute();

        return () => {
            cancelled = true;
        };
    }, [appInitialized, initialUrlChecked]);

    useEffect(() => {
        if (!startupRouteHandled) return;

        if (pathname.startsWith("/practice")) {
            restoringPracticeRoute.current = false;
            return;
        }

        if (restoringPracticeRoute.current) return;

        void lastPracticeScreenService
            .clearLastPracticeScreenIfNonPracticePath(pathname);
    }, [pathname, startupRouteHandled]);

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
                    onPress: async () => {
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
            Alert.alert("Log out failed", error?.message ?? "Unknown error");
        }
    }

    return (
        // _layout.tsx
        <Stack
            screenOptions={{
                headerTitleAlign: "center",

                headerLeft: ({ canGoBack, tintColor }) => (
                    <View style={{ width: 44, alignItems: "center", justifyContent: "center" }}>
                        {canGoBack ? (
                            <Pressable onPress={() => router.back()} hitSlop={10}>
                                <MaterialIcons name="arrow-back" size={24} color={tintColor ?? "#333"} />
                            </Pressable>
                        ) : (
                            <View style={{ width: 24, height: 24 }} />
                        )}
                    </View>
                ),

                headerTitle: () => (
                    <HeaderTitle
                        isAuthenticated={authState.isAuthenticated}
                        firstName={authState.firstName}
                    />
                ),

                headerRight: () => (
                    <HeaderMenu
                        isAuthenticated={authState.isAuthenticated}
                        firstName={authState.firstName}
                        onSignOut={handleSignOut}
                    />
                ),
            }}
        />
    );
}
