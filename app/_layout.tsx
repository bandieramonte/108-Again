import HeaderLeftControls from "@/components/HeaderLeftControls";
import HeaderMenu from "@/components/HeaderMenu";
import HeaderTitle from "@/components/HeaderTitle";
import UpdateRequiredScreen from "@/components/UpdateRequiredScreen";
import { I18nProvider, useI18n } from "@/i18n";
import { AppThemeProvider, useAppTheme } from "@/styles/theme";
import { subscribeAuth } from "@/utils/events";
import { Stack, router, usePathname } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import * as appService from "../services/appService";
import type { UpdateRequirement } from "../services/appUpdatePolicy";
import * as appUpdateService from "../services/appUpdateService";
import * as authService from "../services/authService";
import * as lastPracticeScreenService from "../services/lastPracticeScreenService";
import * as practiceService from "../services/practiceService";
import * as practiceReminderService from "../services/practiceReminderService";
import * as syncService from "../services/syncService";

export default function Layout() {
    return (
        <SafeAreaProvider>
            <I18nProvider>
                <AppThemeProvider>
                    <LayoutContent />
                </AppThemeProvider>
            </I18nProvider>
        </SafeAreaProvider>
    );
}

function LayoutContent() {
    const { colors } = useAppTheme();
    const { t } = useI18n();
    const [authState, setAuthState] = useState(authService.getAuthState());
    const [appInitialized, setAppInitialized] = useState(false);
    const [startupRouteHandled, setStartupRouteHandled] = useState(false);
    const [updateRequirement, setUpdateRequirement] =
        useState<UpdateRequirement | null>(null);
    const [checkingForUpdate, setCheckingForUpdate] = useState(true);
    const pathname = usePathname();
    const pathnameRef = useRef(pathname);
    const restoringPracticeRoute = useRef(false);
    const reminderRouteHandled = useRef(false);
    const startupRouteRestoreAttempted = useRef(false);
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
        pathnameRef.current = pathname;
    }, [pathname]);

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
        if (!appInitialized) return;
        if (startupRouteRestoreAttempted.current) return;

        startupRouteRestoreAttempted.current = true;

        let cancelled = false;

        async function restorePracticeRoute() {
            const startupPathname = pathnameRef.current;

            if (startupPathname !== "/") {
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
    }, [appInitialized]);

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
            Alert.alert(
                t("menu.logOut"),
                error?.message ?? t("common.unknownError")
            );
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
                    backgroundColor: colors.background,
                }}
            >
                <ActivityIndicator size="large" color={colors.primary} />
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

    if (!appInitialized) {
        return (
            <View
                style={{
                    flex: 1,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: colors.background,
                }}
            >
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    return (
        // _layout.tsx
        <Stack
            screenOptions={{
                headerTitleAlign: "center",
                headerStyle: {
                    backgroundColor: colors.headerBackground,
                },
                headerTintColor: colors.icon,
                headerShadowVisible: true,
                contentStyle: {
                    backgroundColor: colors.background,
                },

                headerLeft: ({ canGoBack }) => (
                    <HeaderLeftControls
                        canGoBack={!!canGoBack}
                        onBack={() => router.back()}
                    />
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
