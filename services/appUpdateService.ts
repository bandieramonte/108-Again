import AsyncStorage from "@react-native-async-storage/async-storage";
import { Alert, Linking, NativeModules, Platform } from "react-native";

const ANDROID_PACKAGE_NAME = "com.bandieramonte.app108again";
const PROMPTED_VERSION_KEY = "appUpdatePrompt:lastPromptedAndroidVersionCode";

type PlayUpdateAvailability = {
    isUpdateAvailable: boolean;
    isFlexibleUpdateAllowed: boolean;
    isImmediateUpdateAllowed: boolean;
    availableVersionCode: number;
    updatePriority: number;
    clientVersionStalenessDays: number | null;
};

type AppUpdateNativeModule = {
    getUpdateAvailability: () => Promise<PlayUpdateAvailability>;
};

let checkInFlight: Promise<void> | null = null;

async function openPlayStore() {
    const marketUrl = `market://details?id=${ANDROID_PACKAGE_NAME}`;
    const webUrl = `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE_NAME}`;

    try {
        await Linking.openURL(marketUrl);
    } catch {
        await Linking.openURL(webUrl);
    }
}

function showUpdatePrompt(availableVersionCode: number) {
    Alert.alert(
        "Update available",
        "A newer version of 108 Again is available. Please update for stability improvements and the latest features.",
        [
            {
                text: "Later",
                style: "cancel",
            },
            {
                text: "Update",
                onPress: () => {
                    void openPlayStore();
                },
            },
        ]
    );

    void AsyncStorage.setItem(
        PROMPTED_VERSION_KEY,
        String(availableVersionCode)
    );
}

async function runUpdateCheck() {
    if (Platform.OS !== "android") return;

    const appUpdateModule =
        NativeModules.AppUpdateModule as AppUpdateNativeModule | undefined;

    if (!appUpdateModule) return;

    const updateInfo =
        await appUpdateModule.getUpdateAvailability();

    if (!updateInfo.isUpdateAvailable) {
        return;
    }

    if (
        !updateInfo.isFlexibleUpdateAllowed &&
        !updateInfo.isImmediateUpdateAllowed
    ) {
        return;
    }

    const lastPromptedVersion =
        await AsyncStorage.getItem(PROMPTED_VERSION_KEY);

    if (
        lastPromptedVersion ===
        String(updateInfo.availableVersionCode)
    ) {
        return;
    }

    showUpdatePrompt(updateInfo.availableVersionCode);
}

export function checkForAppUpdate() {
    if (checkInFlight) return;

    checkInFlight = runUpdateCheck()
        .catch((error) => {
            console.warn("App update check failed", error);
        })
        .finally(() => {
            checkInFlight = null;
        });
}
