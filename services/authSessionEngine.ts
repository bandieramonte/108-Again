import type { AppMetaRepository } from "../repositories/appMetaRepoFactory";
import type { ProfileRepository } from "../repositories/profileRepoFactory";
import {
    assertCanCreateAccountOnDevice,
    assertCanSignInOnDevice,
} from "./authAccountGuard";
import type { SyncMode } from "./syncEngine";

export type AuthSessionUser = {
    id: string;
    email?: string | null;
};

export type AuthState = {
    isAuthenticated: boolean;
    userId: string | null;
    email: string | null;
    firstName: string | null;
};

type RemoteProfile = {
    firstName: string | null;
};

type AuthSessionEngineDeps = {
    appMetaRepo: Pick<
        AppMetaRepository,
        "getLocalDataOwnerUserId" | "setLocalDataOwnerUserId"
    >;
    claimAnonymousLocalDataIfNeeded(userId: string): Promise<void>;
    emitAuthChanged(): void;
    fetchRemoteProfile(userId: string): Promise<RemoteProfile | null>;
    logger: Pick<Console, "warn">;
    now(): number;
    profileRepo: Pick<
        ProfileRepository,
        "getUserProfileById" | "upsertUserProfile"
    >;
    requestSync(
        userId: string,
        options?: { immediate?: boolean; mode?: SyncMode }
    ): void;
    requireRemoteAuthoritativeSync(userId: string): void;
};

const SIGNED_OUT_STATE: AuthState = {
    isAuthenticated: false,
    userId: null,
    email: null,
    firstName: null,
};

export function createAuthSessionEngine(deps: AuthSessionEngineDeps) {
    let authState = SIGNED_OUT_STATE;

    function setAuthState(next: AuthState) {
        authState = next;
        deps.emitAuthChanged();
    }

    function getAuthState(): AuthState {
        return authState;
    }

    function clearSession() {
        setAuthState(SIGNED_OUT_STATE);
    }

    function getLoginSyncMode(userId: string): SyncMode {
        const ownerId = deps.appMetaRepo.getLocalDataOwnerUserId();

        if (!ownerId) return "remote_overwrite_local";

        return ownerId === userId
            ? "merge_local"
            : "remote_overwrite_local";
    }

    async function loadProfileIntoState(
        user: AuthSessionUser,
        syncMode: SyncMode
    ) {
        if (syncMode === "remote_overwrite_local") {
            deps.requireRemoteAuthoritativeSync(user.id);
        }

        const email = user.email ?? null;
        const localProfile = deps.profileRepo.getUserProfileById(user.id);

        setAuthState({
            isAuthenticated: true,
            userId: user.id,
            email,
            firstName: localProfile?.firstName ?? null,
        });

        const remoteProfile = await deps.fetchRemoteProfile(user.id);
        const firstName =
            remoteProfile?.firstName ?? localProfile?.firstName ?? null;

        deps.profileRepo.upsertUserProfile(
            user.id,
            email,
            firstName,
            deps.now()
        );

        setAuthState({
            isAuthenticated: true,
            userId: user.id,
            email,
            firstName,
        });

        deps.requestSync(user.id, {
            immediate: true,
            mode: syncMode,
        });
    }

    async function restoreSession(user: AuthSessionUser) {
        await loadProfileIntoState(
            user,
            getLoginSyncMode(user.id)
        );
    }

    function assertCanCreateAccount(email: string) {
        assertCanCreateAccountOnDevice(
            {
                appMetaRepo: deps.appMetaRepo,
                profileRepo: deps.profileRepo,
            },
            email
        );
    }

    async function completeSignIn(
        user: AuthSessionUser,
        signOutRejectedAccount: () => Promise<void>
    ) {
        const email = user.email ?? null;

        try {
            assertCanSignInOnDevice(
                {
                    appMetaRepo: deps.appMetaRepo,
                    profileRepo: deps.profileRepo,
                },
                user.id,
                email
            );
        } catch (error) {
            try {
                await signOutRejectedAccount();
            } catch (signOutError) {
                deps.logger.warn(
                    "Failed to sign out blocked account:",
                    signOutError
                );
            }

            throw error;
        }

        const syncMode = deps.appMetaRepo.getLocalDataOwnerUserId()
            ? "merge_local"
            : "remote_overwrite_local";

        deps.appMetaRepo.setLocalDataOwnerUserId(user.id);
        await loadProfileIntoState(user, syncMode);
    }

    async function completeSignUp(
        user: AuthSessionUser,
        firstName: string,
        hasSession: boolean
    ) {
        const email = user.email ?? null;

        deps.profileRepo.upsertUserProfile(
            user.id,
            email,
            firstName,
            deps.now()
        );
        deps.appMetaRepo.setLocalDataOwnerUserId(user.id);

        setAuthState({
            isAuthenticated: hasSession,
            userId: user.id,
            email,
            firstName,
        });

        if (!hasSession) return;

        await deps.claimAnonymousLocalDataIfNeeded(user.id);
        deps.requestSync(user.id);
    }

    return {
        assertCanCreateAccount,
        clearSession,
        completeSignIn,
        completeSignUp,
        getAuthState,
        restoreSession,
    };
}
