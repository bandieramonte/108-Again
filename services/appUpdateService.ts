import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { Alert, Linking, NativeModules, Platform } from "react-native";
import { getSupabase } from "../lib/supabase";
import {
    type AppUpdatePolicy,
    determineUpdateRequirement,
    type PlayUpdateAvailability,
    type RemoteSyncAccess,
    type UpdateRequirement,
} from "./appUpdatePolicy";

const ANDROID_PACKAGE_NAME = "com.bandieramonte.app108again";
const POLICY_CACHE_KEY = "appUpdatePolicy:android";
const PROMPTED_VERSION_KEY =
    "appUpdatePrompt:lastPromptedAndroidVersionCode";
const POLICY_TIMEOUT_MS = 4000;

type AppUpdateNativeModule = {
    getCurrentVersionCode?: () => Promise<number>;
    getUpdateAvailability?: () => Promise<PlayUpdateAvailability>;
    startImmediateUpdate?: () => Promise<boolean>;
};

type AppUpdatePolicyRow = {
    latest_version_code: number;
    minimum_supported_version_code: number;
    maintenance_mode: boolean;
    message: string | null;
};

type UpdateRequirementListener = (
    requirement: UpdateRequirement
) => void;

let checkInFlight: Promise<UpdateRequirement> | null = null;
let appAccessBlocked = false;
let currentRequirement: UpdateRequirement | null = null;
const requirementListeners = new Set<UpdateRequirementListener>();

function requirementsMatch(
    current: UpdateRequirement | null,
    next: UpdateRequirement
) {
    if (!current || current.kind !== next.kind) return false;
    if (current.kind === "none" && next.kind === "none") return true;

    if (current.kind === "optional" && next.kind === "optional") {
        return current.availableVersionCode === next.availableVersionCode;
    }

    if (current.kind === "required" && next.kind === "required") {
        return (
            current.reason === next.reason &&
            current.availableVersionCode === next.availableVersionCode &&
            current.message === next.message
        );
    }

    return false;
}

function applyUpdateRequirement(requirement: UpdateRequirement) {
    appAccessBlocked = requirement.kind === "required";

    if (requirementsMatch(currentRequirement, requirement)) return;

    currentRequirement = requirement;
    requirementListeners.forEach(listener => listener(requirement));
}

function timeout<T>(ms: number): Promise<T> {
    return new Promise((_, reject) => {
        setTimeout(
            () => reject(new Error("App update policy timeout")),
            ms
        );
    });
}

function normalizePolicy(row: AppUpdatePolicyRow): AppUpdatePolicy {
    return {
        latestVersionCode: Number(row.latest_version_code),
        minimumSupportedVersionCode: Number(
            row.minimum_supported_version_code
        ),
        maintenanceMode: row.maintenance_mode,
        message: row.message,
    };
}

async function readCachedPolicy(): Promise<AppUpdatePolicy | null> {
    const cached = await AsyncStorage.getItem(POLICY_CACHE_KEY);
    if (!cached) return null;

    try {
        return JSON.parse(cached) as AppUpdatePolicy;
    } catch {
        await AsyncStorage.removeItem(POLICY_CACHE_KEY);
        return null;
    }
}

async function fetchRemotePolicy(): Promise<AppUpdatePolicy | null> {
    const request = getSupabase()
        .from("app_update_policy")
        .select(
            "latest_version_code, minimum_supported_version_code, maintenance_mode, message"
        )
        .eq("platform", "android")
        .maybeSingle();
    const { data, error } = await Promise.race([
        request,
        timeout<never>(POLICY_TIMEOUT_MS),
    ]);

    if (error) throw error;
    if (!data) return null;

    const policy = normalizePolicy(data as AppUpdatePolicyRow);
    await AsyncStorage.setItem(POLICY_CACHE_KEY, JSON.stringify(policy));
    return policy;
}

async function getEffectivePolicy(): Promise<AppUpdatePolicy | null> {
    try {
        return await fetchRemotePolicy();
    } catch (error) {
        console.warn("App update policy check failed", error);
        return readCachedPolicy();
    }
}

export async function openPlayStore() {
    const marketUrl = `market://details?id=${ANDROID_PACKAGE_NAME}`;
    const webUrl =
        `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE_NAME}`;

    try {
        await Linking.openURL(marketUrl);
    } catch {
        await Linking.openURL(webUrl);
    }
}

function showOptionalUpdatePrompt(availableVersionCode: number) {
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

async function maybeShowOptionalPrompt(
    requirement: UpdateRequirement
) {
    if (requirement.kind !== "optional") return;

    const lastPromptedVersion =
        await AsyncStorage.getItem(PROMPTED_VERSION_KEY);

    if (
        lastPromptedVersion ===
        String(requirement.availableVersionCode)
    ) {
        return;
    }

    showOptionalUpdatePrompt(requirement.availableVersionCode);
}

async function getPlayUpdateAvailability(
    appUpdateModule: AppUpdateNativeModule | null
): Promise<PlayUpdateAvailability | null> {
    if (typeof appUpdateModule?.getUpdateAvailability !== "function") {
        return null;
    }

    try {
        return await appUpdateModule.getUpdateAvailability();
    } catch (error) {
        console.warn("Google Play update check failed", error);
        return null;
    }
}

function getAppUpdateModule(): AppUpdateNativeModule | null {
    const module = NativeModules.AppUpdateModule as
        | AppUpdateNativeModule
        | undefined;

    return module ?? null;
}

async function getCurrentAndroidVersionCode(
    appUpdateModule: AppUpdateNativeModule | null
): Promise<number> {
    if (typeof appUpdateModule?.getCurrentVersionCode === "function") {
        try {
            return await appUpdateModule.getCurrentVersionCode();
        } catch (error) {
            console.warn("Native app version check failed", error);
        }
    }

    const manifestVersionCode =
        Constants.platform?.android?.versionCode;

    if (
        typeof manifestVersionCode === "number" &&
        Number.isSafeInteger(manifestVersionCode) &&
        manifestVersionCode > 0
    ) {
        return manifestVersionCode;
    }

    throw new Error("Android version code is unavailable");
}

async function runUpdateCheck(): Promise<UpdateRequirement> {
    if (Platform.OS !== "android") {
        const requirement = { kind: "none" } as const;
        applyUpdateRequirement(requirement);
        return requirement;
    }

    const appUpdateModule = getAppUpdateModule();
    const currentVersionCode =
        await getCurrentAndroidVersionCode(appUpdateModule);
    const [policy, playUpdate] = await Promise.all([
        getEffectivePolicy(),
        getPlayUpdateAvailability(appUpdateModule),
    ]);
    const requirement = determineUpdateRequirement({
        currentVersionCode,
        policy,
        playUpdate,
    });

    applyUpdateRequirement(requirement);
    await maybeShowOptionalPrompt(requirement);
    return requirement;
}

export function checkForAppUpdate(): Promise<UpdateRequirement> {
    if (checkInFlight) return checkInFlight;

    checkInFlight = runUpdateCheck()
        .catch((error) => {
            console.warn("App update check failed", error);
            const requirement = { kind: "none" } as UpdateRequirement;
            applyUpdateRequirement(requirement);
            return requirement;
        })
        .finally(() => {
            checkInFlight = null;
        });

    return checkInFlight;
}

export async function verifyRemoteSyncAccess(): Promise<RemoteSyncAccess> {
    if (Platform.OS !== "android") return "allowed";
    if (appAccessBlocked) return "blocked";

    try {
        const appUpdateModule = getAppUpdateModule();
        const currentVersionCode =
            await getCurrentAndroidVersionCode(appUpdateModule);
        const policy = await fetchRemotePolicy();

        if (!policy) {
            throw new Error("Android app update policy is not configured");
        }

        const requirement = determineUpdateRequirement({
            currentVersionCode,
            policy,
            playUpdate: null,
        });

        applyUpdateRequirement(requirement);
        return requirement.kind === "required" ? "blocked" : "allowed";
    } catch (error) {
        console.warn("Remote sync update-policy check failed", error);
        return "unavailable";
    }
}

export function subscribeAppUpdateRequirement(
    listener: UpdateRequirementListener
) {
    requirementListeners.add(listener);

    return () => {
        requirementListeners.delete(listener);
    };
}

export function isAppAccessBlocked() {
    return appAccessBlocked;
}

export async function startRequiredUpdate() {
    const appUpdateModule = getAppUpdateModule();

    if (typeof appUpdateModule?.startImmediateUpdate === "function") {
        try {
            const started =
                await appUpdateModule.startImmediateUpdate();
            if (started) return;
        } catch (error) {
            console.warn("Immediate app update failed", error);
        }
    }

    await openPlayStore();
}
