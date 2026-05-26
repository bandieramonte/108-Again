export const ONE_ACCOUNT_PER_DEVICE_MESSAGE =
    "Only one account can be used on this device at a time.\n\nLog in with the existing account for this device, or delete that account before creating or using another one.";

type UserProfileRow = {
    userId: string;
    email: string | null;
    firstName: string | null;
    updatedAt: number;
};

type AuthAccountGuardDeps = {
    appMetaRepo: {
        getLocalDataOwnerUserId(): string | null;
    };
    profileRepo: {
        getUserProfileById(userId: string): UserProfileRow | null;
    };
};

function normalizeEmail(email: string | null | undefined): string | null {
    const normalized = email?.trim().toLowerCase();
    return normalized || null;
}

export function hasDifferentLocalAccountForEmail(
    deps: AuthAccountGuardDeps,
    nextEmail: string
): boolean {
    const ownerId = deps.appMetaRepo.getLocalDataOwnerUserId();

    if (!ownerId) {
        return false;
    }

    const ownerProfile = deps.profileRepo.getUserProfileById(ownerId);

    if (!ownerProfile?.email) {
        return false;
    }

    return normalizeEmail(ownerProfile.email) !== normalizeEmail(nextEmail);
}

export function isDifferentLocalDataOwner(
    deps: AuthAccountGuardDeps,
    nextUserId: string,
    nextEmail: string | null
): boolean {
    const ownerId = deps.appMetaRepo.getLocalDataOwnerUserId();

    if (!ownerId) {
        return false;
    }

    if (ownerId === nextUserId) {
        return false;
    }

    if (deps.profileRepo.getUserProfileById(nextUserId)) {
        return false;
    }

    const ownerProfile = deps.profileRepo.getUserProfileById(ownerId);

    if (!ownerProfile?.email) {
        return false;
    }

    if (
        normalizeEmail(ownerProfile.email) ===
        normalizeEmail(nextEmail)
    ) {
        return false;
    }

    return ownerId !== nextUserId;
}

export function assertCanCreateAccountOnDevice(
    deps: AuthAccountGuardDeps,
    nextEmail: string
) {
    if (hasDifferentLocalAccountForEmail(deps, nextEmail)) {
        throw new Error(ONE_ACCOUNT_PER_DEVICE_MESSAGE);
    }
}

export function assertCanSignInOnDevice(
    deps: AuthAccountGuardDeps,
    nextUserId: string,
    nextEmail: string | null
) {
    if (isDifferentLocalDataOwner(deps, nextUserId, nextEmail)) {
        throw new Error(ONE_ACCOUNT_PER_DEVICE_MESSAGE);
    }
}
