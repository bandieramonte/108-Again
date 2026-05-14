import { getSupabase } from "@/lib/supabase";
import { AUTH_FIELD_LIMITS } from "@/constants/authFieldLimits";
import * as appMetaRepo from "@/repositories/appMetaRepo";
import * as profileRepo from "@/repositories/profileRepo";
import * as syncService from "@/services/syncService";
import { emitAuthChanged, subscribeAuthInvalid } from "@/utils/events";
import Constants from "expo-constants";
import { Alert } from "react-native";

let isPasswordRecoveryFlow = false;
let blockAuthStateHandler = false;
const ONE_ACCOUNT_PER_DEVICE_MESSAGE =
    "Only one account can be used on this device at a time.\n\nLog in with the existing account for this device, or delete that account before creating or using another one.";

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
export type AuthState = {
    isAuthenticated: boolean;
    userId: string | null;
    email: string | null;
    firstName: string | null;
};

let authState: AuthState = {
    isAuthenticated: false,
    userId: null,
    email: null,
    firstName: null,
};

let authInitialized = false;
let authSubscriptionInitialized = false;

function setAuthState(next: AuthState) {
    authState = next;
    emitAuthChanged();
}

export function getAuthState(): AuthState {
    return authState;
}

export function getCurrentUserId(): string | null {
    return authState.userId;
}

export function getCurrentFirstName(): string | null {
    return authState.firstName;
}

export function isAuthenticated(): boolean {
    return authState.isAuthenticated;
}

async function loadProfileIntoState(userId: string, email: string | null) {
    const localProfile = profileRepo.getUserProfileById(userId);

    if (localProfile) {
        setAuthState({
            isAuthenticated: true,
            userId,
            email,
            firstName: localProfile.firstName,
        });
    } else {
        setAuthState({
            isAuthenticated: true,
            userId,
            email,
            firstName: null,
        });
    }
    
    const { data, error } = await getSupabase()
        .from("profiles")
        .select("first_name, updated_at")
        .eq("user_id", userId)
        .maybeSingle();

    if (error) {
        throw error;
    }

    const firstName = data?.first_name ?? localProfile?.firstName ?? null;

    profileRepo.upsertUserProfile(
        userId,
        email,
        firstName,
        Date.now()
    );

    setAuthState({
        isAuthenticated: true,
        userId,
        email,
        firstName,
    });

    void syncService.requestSync(userId, {
        immediate: true
    });
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
                    setAuthState({
                        isAuthenticated: false,
                        userId: null,
                        email: null,
                        firstName: null,
                    });
                    return;
                }

                await loadProfileIntoState(
                    session.user.id,
                    session.user.email ?? null
                );
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
    authInitialized = true;

    const {
        data: { session },
        error,
    } = await getSupabase().auth.getSession();

    if (error) {
        throw error;
    }

    if (!session?.user) {
        setAuthState({
            isAuthenticated: false,
            userId: null,
            email: null,
            firstName: null,
        });
        return;
    }

    await loadProfileIntoState(
        session.user.id,
        session.user.email ?? null
    );
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

    if (hasLocalDataOwner()) {
        throw new Error(ONE_ACCOUNT_PER_DEVICE_MESSAGE);
    }

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

        profileRepo.upsertUserProfile(
            user.id,
            user.email ?? trimmedEmail,
            trimmedFirstName,
            Date.now()
        );

        appMetaRepo.setLocalDataOwnerUserId(user.id);

        setAuthState({
            isAuthenticated: !!data.session,
            userId: data.session?.user.id ?? user.id,
            email: user.email ?? trimmedEmail,
            firstName: trimmedFirstName,
        });

        if (!data.session) {
            // Email confirmation required
            return { needsEmailConfirmation: true };
        }

        if (data.session?.user.id) {
            await syncService.claimAnonymousLocalDataIfNeeded(data.session.user.id);
            await syncService.requestSync(data.session.user.id);
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

        if (isDifferentLocalDataOwner(user.id)) {
            try {
                await signOut();
            } catch (error) {
                console.warn("Failed to sign out blocked account:", error);
            }

            throw new Error(ONE_ACCOUNT_PER_DEVICE_MESSAGE);
        }

        appMetaRepo.setLocalDataOwnerUserId(user.id);
        await loadProfileIntoState(user.id, user.email ?? trimmedEmail);
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

    setAuthState({
        isAuthenticated: false,
        userId: null,
        email: null,
        firstName: null,
    });
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
    try {
        const { error } = await syncService.withTimeout(
            () => getSupabase().functions.invoke("delete-user"),
            15000
        );

        if (error) {
            console.warn("Delete account error:", error);

            const deleted = await syncService.isUserDeleted();

            if (deleted) {
                Alert.alert(
                    "Account deleted",
                    "Your account has been deleted."
                );

                await signOutDeletedAccount();
                return;
            }

            throw new Error(
                "Failed to delete account. Please try again."
            );
        }

        await signOutDeletedAccount();

    } catch (e: any) {
        if (e?.message?.includes("timeout")) {
            throw new Error(
                "Request timed out. Please try again in a few minutes. If the issue persists, please reopen the app and try again."
            );
        }

        throw e;
    }
}

export async function resetPassword(email: string) {

    const trimmedEmail = email.trim().toLowerCase();
    const redirectTo = `${Constants.expoConfig?.scheme ?? 'app108again'}://reset-password`;

    if (!trimmedEmail) {
        throw new Error("Email is required.");
    }

    validateAuthFieldLength(
        trimmedEmail,
        "Email",
        AUTH_FIELD_LIMITS.email
    );

    const { error } = await getSupabase().auth.resetPasswordForEmail(trimmedEmail, {
        redirectTo,
    });

    if (error) {
        throw new Error(error.message);
    }
}

function hasLocalDataOwner(): boolean {
    return !!appMetaRepo.getLocalDataOwnerUserId();
}

function isDifferentLocalDataOwner(nextUserId: string): boolean {

    const ownerId = appMetaRepo.getLocalDataOwnerUserId();

    if (!ownerId) {
        return false;
    }

    return ownerId !== nextUserId;
}
