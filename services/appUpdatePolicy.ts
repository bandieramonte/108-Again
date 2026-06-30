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
        message: string | null;
    };

type DetermineUpdateRequirementOptions = {
    currentVersionCode: number;
    policy: AppUpdatePolicy | null;
    playUpdate: PlayUpdateAvailability | null;
};

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
            message: policy.message?.trim() || null,
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
            message: policy.message?.trim() || null,
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
