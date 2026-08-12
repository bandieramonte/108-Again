export type AppUpdatePolicy = {
    latestVersionCode: number;
    minimumSupportedVersionCode: number;
    maintenanceMode: boolean;
    message: string | null;
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
};

function getPolicyMessage(message: string | null | undefined) {
    const trimmed = message?.trim();

    if (
        trimmed === "update.maintenanceMessage" ||
        trimmed === "update.requiredMessage"
    ) {
        return null;
    }

    return trimmed || null;
}

export function determineUpdateRequirement({
    currentVersionCode,
    policy,
}: DetermineUpdateRequirementOptions): UpdateRequirement {
    const availableVersionCode = policy?.latestVersionCode ?? 0;

    if (policy?.maintenanceMode) {
        return {
            kind: "required",
            reason: "maintenance",
            availableVersionCode:
                availableVersionCode > currentVersionCode
                    ? availableVersionCode
                    : null,
            message: getPolicyMessage(policy.message),
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
            message: getPolicyMessage(policy.message),
        };
    }

    const policyOffersUpdate =
        policy != null &&
        currentVersionCode < policy.latestVersionCode;

    if (policyOffersUpdate) {
        return {
            kind: "optional",
            availableVersionCode,
        };
    }

    return { kind: "none" };
}
