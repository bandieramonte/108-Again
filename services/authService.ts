import { supabase } from "@/lib/supabase";
import * as profileRepo from "@/repositories/profileRepo";
import * as syncService from "@/services/syncService";
import { emitAuthChanged } from "@/utils/events";

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

    const { data, error } = await supabase
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

    setTimeout(() => {
        void syncService.requestSync(userId);
    }, 200);
}

export async function initializeAuth() {
    if (!authSubscriptionInitialized) {
        authSubscriptionInitialized = true;

        supabase.auth.onAuthStateChange(async (_event, session) => {
            try {
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
    }

    if (authInitialized) return;
    authInitialized = true;

    const {
        data: { session },
        error,
    } = await supabase.auth.getSession();

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

    if (!trimmedEmail) {
        throw new Error("Email is required.");
    }

    if (!password) {
        throw new Error("Password is required.");
    }

    const { data, error } = await supabase.auth.signUp({
        email: trimmedEmail,
        password,
        options: {
            emailRedirectTo: "ngondrotracker://sign-in?confirmed=true",
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
        throw new Error("Sign up succeeded but no user was returned.");
    }

    profileRepo.upsertUserProfile(
        user.id,
        user.email ?? trimmedEmail,
        trimmedFirstName,
        Date.now()
    );

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
}

export async function signIn(email: string, password: string) {
    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedEmail) {
        throw new Error("Email is required.");
    }

    if (!password) {
        throw new Error("Password is required.");
    }

    const { data, error } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
    });

    if (error) {
        throw error;
    }

    const user = data.user;

    if (!user) {
        throw new Error("Sign in succeeded but no user was returned.");
    }

    await loadProfileIntoState(user.id, user.email ?? trimmedEmail);
}

export async function signOut() {
    const { error } = await supabase.auth.signOut();

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

export async function deleteAccount() {
    const { error } = await supabase.functions.invoke("delete-user");

    if (error) {
        console.error("Delete account failed:", error);
        throw new Error("Failed to delete account. Please try again.");
    }

    await signOut();
    await syncService.resetLocalSyncState();
}

export async function resetPassword(email: string) {

    const redirectTo =
      "ngondrotracker:///reset-password";

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo,
    });

    if (error) {
        throw new Error(error.message);
    }
}