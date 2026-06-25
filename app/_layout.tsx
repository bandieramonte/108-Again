import HeaderMenu from "@/components/HeaderMenu";
import HeaderTitle from "@/components/HeaderTitle";
import UpdateRequiredScreen from "@/components/UpdateRequiredScreen";
import { getSupabase } from "@/lib/supabase";
import { subscribeAuth } from "@/utils/events";
import { MaterialIcons } from "@expo/vector-icons";
import { Stack, router, usePathname } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, Linking, Pressable, View } from "react-native";
import * as appService from "../services/appService";
import type { UpdateRequirement } from "../services/appUpdatePolicy";
import * as appUpdateService from "../services/appUpdateService";
import * as authService from "../services/authService";
import * as lastPracticeScreenService from "../services/lastPracticeScreenService";
import * as practiceService from "../services/practiceService";
import * as practiceReminderService from "../services/practiceReminderService";
import * as syncService from "../services/syncService";

export default function Layout() {
    const [authState, setAuthState] = useState(authService.getAuthState());
    const [appInitialized, setAppInitialized] = useState(false);
    const [initialUrlChecked, setInitialUrlChecked] = useState(false);
    const [startupRouteHandled, setStartupRouteHandled] = useState(false);
    const [updateRequirement, setUpdateRequirement] =
        useState<UpdateRequirement | null>(null);
    const [checkingForUpdate, setCheckingForUpdate] = useState(true);
    const pathname = usePathname();
    const handledDeepLink = useRef(false);
    const initialUrlPresent = useRef(false);
    const restoringPracticeRoute = useRef(false);
    const reminderRouteHandled = useRef(false);
    const appInitializedRef = useRef(false);
    const initializationRef = useRef<Promise<void> | null>(null);

    const initializeAppOnce = useCallback(async () => {
        if (!initializationRef.current) {
            initializationRef.current = appService.initializeApp()
                .then(() => {
                    appInitializedRef.current = true;
                    setAppInitialized(true);
                });
        }

        await initializationRef.current;
    }, []);

    const checkAppAccess = useCallback(async () => {
        setCheckingForUpdate(true);
        const requirement =
            await appUpdateService.checkForAppUpdate();
        setUpdateRequirement(requirement);
        setCheckingForUpdate(false);
        return requirement.kind !== "required";
    }, []);

    useEffect(() => {
        practiceReminderService.initializePracticeReminderNotifications();

        return appUpdateService.subscribeAppUpdateRequirement(
            setUpdateRequirement
        );
    }, []);

    useEffect(() => {
        let cancelled = false;

        async function initialize() {
            const accessAllowed = await checkAppAccess();

            if (cancelled || !accessAllowed) return;
            await initializeAppOnce();
        }

        initialize();

        return () => {
            cancelled = true;
        };
    }, [checkAppAccess, initializeAppOnce]);


    useEffect(() => {
        appService.initAppStateListener(() => {
            void (async () => {
                const wasInitialized = appInitializedRef.current;
                const accessAllowed = await checkAppAccess();

                if (!accessAllowed) return;

                if (!wasInitialized) {
                    await initializeAppOnce();
                    return;
                }

                await appService.handleAppResume();
            })();
        });
    }, [checkAppAccess, initializeAppOnce]);

    useEffect(() => {
        if (
            !appInitialized ||
            !updateRequirement ||
            updateRequirement.kind === "required"
        ) {
            return;
        }

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
    }, [appInitialized, updateRequirement]);

    useEffect(() => {
        if (!appInitialized) return;

        function openReminderPractice(practiceId: string) {
            if (!practiceService.getPractice(practiceId)) return;

            reminderRouteHandled.current = true;

            router.push({
                pathname: "/practice",
                params: { id: practiceId },
            });
        }

        practiceReminderService.consumeLastPracticeReminderResponse(
            openReminderPractice
        );

        const subscription =
            practiceReminderService.subscribePracticeReminderResponses(
                openReminderPractice
            );

        return () => subscription.remove();
    }, [appInitialized]);

    useEffect(() => {
        if (!appInitialized || !initialUrlChecked) return;

        let cancelled = false;

        async function restorePracticeRoute() {
            if (handledDeepLink.current || initialUrlPresent.current) {
                setStartupRouteHandled(true);
                return;
            }

            if (reminderRouteHandled.current) {
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

            router.push({
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

    async function handleSignOut() {
        try {
            await authService.signOut();
            router.replace("/");
        } catch (error: any) {
            Alert.alert("Log out failed", error?.message ?? "Unknown error");
        }
    }

    async function retryUpdateCheck() {
        const wasInitialized = appInitializedRef.current;
        const accessAllowed = await checkAppAccess();
        if (!accessAllowed) return;

        await initializeAppOnce();

        if (!wasInitialized) return;

        const userId = authService.getCurrentUserId();
        if (!userId) return;

        await syncService.requestSync(userId, { immediate: true });
    }

    if (!updateRequirement) {
        return (
            <View
                style={{
                    flex: 1,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: "white",
                }}
            >
                <ActivityIndicator size="large" color="#1A5FCC" />
            </View>
        );
    }

    if (updateRequirement.kind === "required") {
        return (
            <UpdateRequiredScreen
                requirement={updateRequirement}
                checking={checkingForUpdate}
                onRetry={() => {
                    void retryUpdateCheck();
                }}
                onUpdate={() => {
                    void appUpdateService.startRequiredUpdate();
                }}
            />
        );
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
