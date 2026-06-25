import { AUTH_FIELD_LIMITS } from "@/constants/authFieldLimits";
import { getSupabase } from "@/lib/supabase";
import * as appMetaRepo from "@/repositories/appMetaRepo";
import * as profileRepo from "@/repositories/profileRepo";
import * as syncService from "@/services/syncService";
import { emitAuthChanged, subscribeAuthInvalid } from "@/utils/events";
import Constants from "expo-constants";
import { Alert } from "react-native";
import {
    deleteAccountCore,
    resetPasswordCore,
} from "./authAccountActions";
import {
    createAuthSessionEngine,
    type AuthState,
} from "./authSessionEngine";
import { isUnrecoverableRefreshTokenError } from "./authSessionPolicy";

let isPasswordRecoveryFlow = false;
let blockAuthStateHandler = false;

function validateAuthFieldLength(
    value: string,
    label: string,
    maxLength: number
) {
    if (value.length > maxLength) {
        throw new Error(`${label} must be ${maxLength} characters or fewer.`);
    }
}

export function setPasswordRecoveryFlow(value: boolean) {
    isPasswordRecoveryFlow = value;
}
export type { AuthState } from "./authSessionEngine";

let authInitialized = false;
let authSubscriptionInitialized = false;

const authSessionEngine = createAuthSessionEngine({
    appMetaRepo,
    claimAnonymousLocalDataIfNeeded:
        syncService.claimAnonymousLocalDataIfNeeded,
    emitAuthChanged,
    fetchRemoteProfile: async (userId) => {
        const { data, error } = await getSupabase()
            .from("profiles")
            .select("first_name")
            .eq("user_id", userId)
            .maybeSingle();

        if (error) throw error;

        return data
            ? { firstName: data.first_name ?? null }
            : null;
    },
    logger: console,
    now: Date.now,
    profileRepo,
    requestSync: (userId, options) => {
        void syncService.requestSync(userId, options);
    },
    requireRemoteAuthoritativeSync:
        syncService.requireRemoteAuthoritativeSync,
});

export function getAuthState(): AuthState {
    return authSessionEngine.getAuthState();
}

export function getCurrentUserId(): string | null {
    return getAuthState().userId;
}

export function getCurrentFirstName(): string | null {
    return getAuthState().firstName;
}

export function isAuthenticated(): boolean {
    return getAuthState().isAuthenticated;
}

export async function initializeAuth() {
    if (!authSubscriptionInitialized) {
        authSubscriptionInitialized = true;
        const supabase = getSupabase();
        supabase.auth.onAuthStateChange(async (event, session) => {

            if (blockAuthStateHandler) {
                console.log("Auth state handler blocked");
                return;
            }

            try {
                if (isPasswordRecoveryFlow) {
                    console.log("Skipping initializeAuth during password recovery");
                    return;
                }
                if (!session?.user) {
                    authSessionEngine.clearSession();
                    return;
                }

                await authSessionEngine.restoreSession(session.user);
            } catch (error) {
                console.error("onAuthStateChange error", error);
            }
        });
        
        subscribeAuthInvalid(async () => {
            console.log("Auth invalid — signing out");

            Alert.alert(
                "Account removed",
                "Your account was deleted on another device."
            );

            await signOutDeletedAccount();
        });
    }

    if (authInitialized) return;
    const {
        data: { session },
        error,
    } = await getSupabase().auth.getSession();

    if (error) {
        if (isUnrecoverableRefreshTokenError(error)) {
            const { error: signOutError } =
                await getSupabase().auth.signOut({ scope: "local" });

            if (
                signOutError &&
                !isUnrecoverableRefreshTokenError(signOutError)
            ) {
                console.warn(
                    "Failed to clear invalid local session",
                    signOutError
                );
            }

            authSessionEngine.clearSession();
            authInitialized = true;
            return;
        }

        throw error;
    }

    if (!session?.user) {
        authSessionEngine.clearSession();
        authInitialized = true;
        return;
    }

    await authSessionEngine.restoreSession(session.user);
    authInitialized = true;
}

export async function signUp(
    firstName: string,
    email: string,
    password: string
) {
    const trimmedFirstName = firstName.trim();
    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedFirstName) {
        throw new Error("First name is required.");
    }

    validateAuthFieldLength(
        trimmedFirstName,
        "First name",
        AUTH_FIELD_LIMITS.firstName
    );

    if (!trimmedEmail) {
        throw new Error("Email is required.");
    }

    validateAuthFieldLength(
        trimmedEmail,
        "Email",
        AUTH_FIELD_LIMITS.email
    );

    if (!password) {
        throw new Error("Password is required.");
    }

    validateAuthFieldLength(
        password,
        "Password",
        AUTH_FIELD_LIMITS.password
    );

    authSessionEngine.assertCanCreateAccount(trimmedEmail);

    blockAuthStateHandler = true;
    try {
        const { data, error } = await getSupabase().auth.signUp({
            email: trimmedEmail,
            password,
            options: {
                emailRedirectTo: `${Constants.expoConfig?.scheme ?? 'app108again'}://sign-in?confirmed=true`,
                data: {
                    first_name: trimmedFirstName,
                },
            },
        });

        if (error) {
            throw error;
        }

        const user = data.user;

        if (!user) {
            throw new Error("Account creation succeeded but no user was returned.");
        }

        await authSessionEngine.completeSignUp(
            {
                id: user.id,
                email: user.email ?? trimmedEmail,
            },
            trimmedFirstName,
            !!data.session
        );

        if (!data.session) {
            // Email confirmation required
            return { needsEmailConfirmation: true };
        }

        return { needsEmailConfirmation: false };
    } finally {
        blockAuthStateHandler = false;
    }
}

export async function signIn(email: string, password: string) {
    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedEmail) {
        throw new Error("Email is required.");
    }

    validateAuthFieldLength(
        trimmedEmail,
        "Email",
        AUTH_FIELD_LIMITS.email
    );

    if (!password) {
        throw new Error("Password is required.");
    }

    validateAuthFieldLength(
        password,
        "Password",
        AUTH_FIELD_LIMITS.password
    );

    blockAuthStateHandler = true;
    try {
        const { data, error } = await getSupabase().auth.signInWithPassword({
            email: trimmedEmail,
            password,
        });

        if (error) {
            throw error;
        }

        const user = data.user;

        if (!user) {
            throw new Error("Log in succeeded but no user was returned.");
        }

        await authSessionEngine.completeSignIn(
            {
                id: user.id,
                email: user.email ?? trimmedEmail,
            },
            signOut
        );
    } finally {
        blockAuthStateHandler = false;
    }
}

export async function signOut() {
    const { error } = await syncService.withTimeout(
        () => getSupabase().auth.signOut({
            scope: "local",
        }),
        5000
    );

    if (error) {
        throw error;
    }

    authSessionEngine.clearSession();
}

async function releaseLocalDataFromDeletedAccount() {
    appMetaRepo.clearLocalDataOwnerUserId();
    await syncService.resetLocalSyncState();
}

async function signOutDeletedAccount() {
    try {
        await signOut();
    } finally {
        await releaseLocalDataFromDeletedAccount();
    }
}

export async function deleteAccount() {
    await deleteAccountCore({
        invokeDeleteUser: () => getSupabase().functions.invoke("delete-user"),
        isUserDeleted: syncService.isUserDeleted,
        logger: console,
        onAccountDeletedDespiteInvokeError: () => {
                Alert.alert(
                    "Account deleted",
                    "Your account has been deleted."
                );
        },
        signOutDeletedAccount,
        withTimeout: syncService.withTimeout,
    });
}

export async function resetPassword(email: string) {

    const redirectTo = `${Constants.expoConfig?.scheme ?? 'app108again'}://reset-password`;

    await resetPasswordCore(
        {
            redirectTo,
            resetPasswordForEmail: (trimmedEmail, options) =>
                getSupabase().auth.resetPasswordForEmail(
                    trimmedEmail,
                    options
                ),
        },
        email
    );
}
