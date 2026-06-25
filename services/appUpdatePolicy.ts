export type AppUpdatePolicy = {
    latestVersionCode: number;
    minimumSupportedVersionCode: number;
    maintenanceMode: boolean;
    message: string | null;
};

export type PlayUpdateAvailability = {
    isUpdateAvailable: boolean;
    isFlexibleUpdateAllowed: boolean;
    isImmediateUpdateAllowed: boolean;
    availableVersionCode: number;
    updatePriority: number;
    clientVersionStalenessDays: number | null;
};

export type RemoteSyncAccess = "allowed" | "blocked" | "unavailable";

export type UpdateRequirement =
    | { kind: "none" }
    | {
        kind: "optional";
        availableVersionCode: number;
    }
    | {
        kind: "required";
        reason: "maintenance" | "minimum-version";
        availableVersionCode: number | null;
        message: string;
    };

type DetermineUpdateRequirementOptions = {
    currentVersionCode: number;
    policy: AppUpdatePolicy | null;
    playUpdate: PlayUpdateAvailability | null;
};

const DEFAULT_MAINTENANCE_MESSAGE =
    "108 Again is temporarily unavailable while an important update is being prepared. Please try again shortly.";
const DEFAULT_UPDATE_MESSAGE =
    "This version of 108 Again is no longer supported. Please update to continue.";

export function determineUpdateRequirement({
    currentVersionCode,
    policy,
    playUpdate,
}: DetermineUpdateRequirementOptions): UpdateRequirement {
    const availableVersionCode = Math.max(
        policy?.latestVersionCode ?? 0,
        playUpdate?.availableVersionCode ?? 0
    );

    if (policy?.maintenanceMode) {
        return {
            kind: "required",
            reason: "maintenance",
            availableVersionCode:
                availableVersionCode > currentVersionCode
                    ? availableVersionCode
                    : null,
            message: policy.message?.trim() ||
                DEFAULT_MAINTENANCE_MESSAGE,
        };
    }

    if (
        policy &&
        currentVersionCode < policy.minimumSupportedVersionCode
    ) {
        return {
            kind: "required",
            reason: "minimum-version",
            availableVersionCode:
                availableVersionCode > currentVersionCode
                    ? availableVersionCode
                    : policy.minimumSupportedVersionCode,
            message: policy.message?.trim() || DEFAULT_UPDATE_MESSAGE,
        };
    }

    const playOffersUpdate =
        playUpdate?.isUpdateAvailable &&
        (
            playUpdate.isFlexibleUpdateAllowed ||
            playUpdate.isImmediateUpdateAllowed
        );
    const policyOffersUpdate =
        policy != null &&
        currentVersionCode < policy.latestVersionCode;

    if (playOffersUpdate || policyOffersUpdate) {
        return {
            kind: "optional",
            availableVersionCode,
        };
    }

    return { kind: "none" };
}
