import { getSupabase, recreateSupabase, recreateSupabaseIfStaleAfterBackground } from "@/lib/supabase";
import * as appMetaRepo from "@/repositories/appMetaRepo";
import * as deletedRecordRepo from "@/repositories/deletedRecordRepo";
import * as practiceRepo from "@/repositories/practiceRepo";
import * as sessionRepo from "@/repositories/sessionRepo";
import { emitAuthInvalid, emitDataChanged, emitSyncChanged } from "@/utils/events";
import { SyncState } from "../types/sync";
import { getIsOnline, subscribeOnline } from "./networkService";
import {
    createSyncEngine,
    REMOTE_AUTHORITATIVE_SYNC_USER_ID_META,
} from "./syncEngine";
import type {
    RemotePracticeRow,
    RemoteSessionRow,
    SyncMode,
    SyncRemote,
} from "./syncEngine";

export type { SyncMode } from "./syncEngine";

let syncState: SyncState = "idle";
let syncInFlight: Promise<void> | null = null;
let scheduledSyncTimeout: ReturnType<typeof setTimeout> | null = null;
let pendingSyncUserId: string | null = null;
let pendingSyncMode: SyncMode | null = null;
let lastUserId: string | null = null;
let retryCount = 0;

const NETWORK_TIMEOUT_MESSAGE = "Network timeout during sync";

type UserDeletionCheckResult =
  | "deleted"
  | "active"
  | "inconclusive";

export type SyncNowResult =
  | "auth_invalid"
  | "offline"
  | "retry_scheduled"
  | "success"
  | "skipped";

export function resetStaleSyncStateAfterResume() {
    if (scheduledSyncTimeout) {
        clearTimeout(scheduledSyncTimeout);
        scheduledSyncTimeout = null;
    }

    syncInFlight = null;
    pendingSyncUserId = null;
    pendingSyncMode = null;
    retryCount = 0;
}

function setSyncState(next: SyncState) {
    syncState = next;
    emitSyncChanged();
}

async function markLocalDataOwnerIfSessionIsCurrent(userId: string) {
    try {
        const { data, error } = await getSupabase().auth.getSession();

        if (error) {
            console.warn("Local data owner check failed:", error);
            return;
        }

        if (data.session?.user?.id === userId) {
            appMetaRepo.setLocalDataOwnerUserId(userId);
        }
    } catch (error) {
        console.warn("Local data owner check failed:", error);
    }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isNetworkTimeout(error: any): boolean {
  return error?.message === NETWORK_TIMEOUT_MESSAGE;
}

function isDeletedUserAuthError(error: any): boolean {
  const message = String(error?.message ?? "").toLowerCase();

  return (
    message.includes("user not found") ||
    message.includes("user from sub claim in jwt does not exist") ||
    message.includes("user does not exist") ||
    message.includes("user has been deleted")
  );
}

async function runWithTimeout<T>(
  promiseFactory: () => Promise<T>,
  ms: number
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(
      () => reject(new Error(NETWORK_TIMEOUT_MESSAGE)),
      ms
    );
  });

  try {
    return await Promise.race([
      promiseFactory(),
      timeoutPromise,
    ]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

export async function withTimeout<T>(
  promiseFactory: () => Promise<T>,
  ms = 6000
): Promise<T> {
  await recreateSupabaseIfStaleAfterBackground();

  try {
    return await runWithTimeout(promiseFactory, ms);
  } catch (error: any) {
    if (!isNetworkTimeout(error)) throw error;

    console.log("Network timeout detected");

    await recreateSupabase();
    await delay(300);

    console.log("Retrying after Supabase client recovery...");

    try {
        return await runWithTimeout(promiseFactory, ms);
    } catch (retryError: any) {
        if (isNetworkTimeout(retryError)) {
            console.log("Retry timed out after Supabase client recovery");
        }

        console.log("Final retry failed");
        throw retryError;
    }
  }
}

function createSupabaseRemote(): SyncRemote {
    return {
        async pullPractices(userId: string) {
            const { data, error } = await withTimeout(async () => getSupabase()
                .from("practices")
                .select(`
                    id,
                    user_id,
                    name,
                    target_count,
                    order_index,
                    image_key,
                    daily_target_count,
                    default_session_count,
                    total_offset,
                    updated_at,
                    deleted_at
                `)
                .eq("user_id", userId)
                .order("order_index", { ascending: true }));

            if (error) throw error;

            return (data ?? []) as RemotePracticeRow[];
        },

        async pullSessions(userId: string) {
            const { data, error } = await withTimeout(async () => getSupabase()
                .from("sessions")
                .select(`
                    id,
                    user_id,
                    practice_id,
                    count,
                    created_at,
                    updated_at,
                    deleted_at
                `)
                .eq("user_id", userId)
                .order("created_at", { ascending: true }));

            if (error) throw error;

            return (data ?? []) as RemoteSessionRow[];
        },

        async getPracticesById(userId: string, ids: string[]) {
            if (ids.length === 0) return new Map<string, RemotePracticeRow>();

            const { data, error } = await withTimeout(async () => getSupabase()
                .from("practices")
                .select(`
                    id,
                    user_id,
                    name,
                    target_count,
                    order_index,
                    image_key,
                    daily_target_count,
                    default_session_count,
                    total_offset,
                    updated_at,
                    deleted_at
                `)
                .eq("user_id", userId)
                .in("id", ids));

            if (error) throw error;

            return new Map(
                (data ?? []).map((row) => [
                    row.id as string,
                    row as RemotePracticeRow,
                ])
            );
        },

        async getSessionsById(userId: string, ids: string[]) {
            if (ids.length === 0) return new Map<string, RemoteSessionRow>();

            const { data, error } = await withTimeout(async () => getSupabase()
                .from("sessions")
                .select(`
                    id,
                    user_id,
                    practice_id,
                    count,
                    created_at,
                    updated_at,
                    deleted_at
                `)
                .eq("user_id", userId)
                .in("id", ids));

            if (error) throw error;

            return new Map(
                (data ?? []).map((row) => [
                    row.id as string,
                    row as RemoteSessionRow,
                ])
            );
        },

        async upsertPractices(rows: RemotePracticeRow[]) {
            if (rows.length === 0) return;

            const { error } = await withTimeout(async () => getSupabase()
                .from("practices")
                .upsert(rows, { onConflict: "id,user_id" }));

            if (error) throw error;
        },

        async upsertSessions(rows: RemoteSessionRow[]) {
            if (rows.length === 0) return;

            const { error } = await withTimeout(async () => getSupabase()
                .from("sessions")
                .upsert(rows, { onConflict: "id" }));

            if (error) throw error;
        },

        async softDeleteUserData(userId: string, deletedAt: number) {
            const deletedAtIso = new Date(deletedAt).toISOString();

            const { error: sessionError } = await withTimeout(async () =>
                getSupabase()
                    .from("sessions")
                    .update({
                        updated_at: deletedAtIso,
                        deleted_at: deletedAtIso,
                    })
                    .eq("user_id", userId)
                    .select()
            );

            if (sessionError) throw sessionError;

            const { error: practiceError } = await withTimeout(async () =>
                getSupabase()
                    .from("practices")
                    .update({
                        updated_at: deletedAtIso,
                        deleted_at: deletedAtIso,
                    })
                    .eq("user_id", userId)
                    .select()
            );

            if (practiceError) throw practiceError;
        },
    };
}

function createAppSyncEngine() {
    return createSyncEngine({
        appMetaRepo,
        deletedRecordRepo,
        practiceRepo,
        remote: createSupabaseRemote(),
        sessionRepo,
    });
}

export function getSyncState(): SyncState {
    return syncState;
}

function chooseSyncMode(
    current: SyncMode | null,
    next: SyncMode | undefined
): SyncMode | null {
    if (current === "remote_overwrite_local") {
        return current;
    }

    return next ?? current;
}

export function requireRemoteAuthoritativeSync(userId: string) {
    appMetaRepo.setMeta(
        REMOTE_AUTHORITATIVE_SYNC_USER_ID_META,
        userId
    );
}

export async function claimAnonymousLocalDataIfNeeded(userId: string | null) {
    await createAppSyncEngine().claimAnonymousLocalDataIfNeeded(userId);
}

export async function syncNow(
    userId: string | null,
    options?: {
        mode?: SyncMode;
    }
): Promise<SyncNowResult> {
    if (!userId) return "skipped";

    lastUserId = userId;
    const syncEngine = createAppSyncEngine();
    const mode = syncEngine.resolveSyncMode(
        userId,
        options?.mode
    );

    if (mode === "remote_overwrite_local") {
        requireRemoteAuthoritativeSync(userId);
    }

    if (!getIsOnline()) {
        if (mode === "remote_overwrite_local") {
            pendingSyncUserId = userId;
            pendingSyncMode = mode;
        }

        setSyncState("offline");
        return "offline";
    }

    if (await isUserDeleted()) {
        console.log("Auth invalid before sync - signing out");
        emitAuthInvalid();
        return "auth_invalid";
    }

    try {
        setSyncState("syncing");

        await syncEngine.executeSync(userId, mode);
        await markLocalDataOwnerIfSessionIsCurrent(userId);

        emitDataChanged();
        setSyncState("success");
        retryCount = 0;
        return "success";
    } catch (error: any) {
        console.error("syncNow error", error);

        if (await isUserDeleted()) {
            console.log("Auth invalid - signing out");
            emitAuthInvalid();
            return "auth_invalid";
        }

        if (!isNetworkTimeout(error)) {
            setSyncState("error");
            throw error;
        }

        if (retryCount >= 3) {
            console.warn("Max sync retries reached");
            retryCount = 0;

            try {
                await getSupabase().auth.getSession();
            } catch (e) {
                console.warn("Session validation failed after max retries", e);
            }

            setSyncState("error");
            return "retry_scheduled";
        }

        setSyncState("syncing");

        pendingSyncUserId = userId;
        pendingSyncMode = mode;

        const retryDelay = getRetryDelay();
        retryCount++;

        setTimeout(() => {
            runQueuedSync();
        }, retryDelay);

        return "retry_scheduled";
    } finally {
        emitSyncChanged();
    }
}

export async function requestSync(
    userId: string | null,
    options?: {
        immediate?: boolean;
        mode?: SyncMode;
    }
) {
    if (!userId) return;

    pendingSyncUserId = userId;
    pendingSyncMode = chooseSyncMode(
        pendingSyncMode,
        options?.mode
    );

    if (scheduledSyncTimeout) {
        clearTimeout(scheduledSyncTimeout);
        scheduledSyncTimeout = null;
    }

    if (options?.immediate) {
        runQueuedSync();
        return;
    }

    scheduledSyncTimeout = setTimeout(() => {
        scheduledSyncTimeout = null;
        runQueuedSync();
    }, 2000);
}

async function runQueuedSync() {
    if (syncInFlight) return;
    if (!pendingSyncUserId) return;

    const userId = pendingSyncUserId;
    const mode = pendingSyncMode ?? "merge_local";
    pendingSyncUserId = null;
    pendingSyncMode = null;

    syncInFlight = (async () => {
        try {
            await syncNow(userId, { mode });
        } catch (error) {
            console.warn("Queued sync error:", error);
        } finally {
            syncInFlight = null;

            if (pendingSyncUserId) {
                runQueuedSync();
            }
        }
    })();
}

export function initializeSyncRetry() {
    subscribeOnline(() => {
        if (!getIsOnline()) {
            setSyncState("offline");
            return;
        }

        if (lastUserId) {
            void requestSync(lastUserId);
        }
    });
}

export function getSyncLabel(state: SyncState): string {
    switch (state) {
        case "syncing":
            return "Syncing...";
        case "success":
            return "Up to date";
        case "error":
            return "Sync failed";
        case "offline":
            return "Offline";
        case "timeout":
            return "Timeout (try reopening app)";
        default:
            return "Idle";
    }
}

export async function resetLocalSyncState() {
    await createAppSyncEngine().resetLocalSyncState();
}

export async function wipeRemoteUserData(userId: string): Promise<number | null> {
    return createAppSyncEngine().wipeRemoteUserData(userId);
}

function getRetryDelay() {
    return Math.min(30000, 2000 * Math.pow(2, retryCount));
}

async function checkCurrentSessionUser(): Promise<UserDeletionCheckResult> {
    const { data: sessionData, error: sessionError } =
        await withTimeout(
            async () => getSupabase().auth.getSession(),
            8000
        );

    if (sessionError) {
        console.warn(
            "isUserDeleted session check error:",
            sessionError
        );
        return "inconclusive";
    }

    const expectedUserId = sessionData.session?.user?.id;

    if (!expectedUserId) {
        return "active";
    }

    const { data, error } = await withTimeout(async () =>
        getSupabase().auth.getUser(),
        8000
    );

    if (error) {
        return isDeletedUserAuthError(error)
            ? "deleted"
            : "inconclusive";
    }

    if (!data?.user) {
        return "deleted";
    }

    if (data.user.id !== expectedUserId) {
        console.warn(
            "isUserDeleted user mismatch",
            { expectedUserId, actualUserId: data.user.id }
        );
        return "inconclusive";
    }

    return "active";
}

export async function isUserDeleted() {
    try {
        const firstCheck = await checkCurrentSessionUser();

        if (firstCheck !== "deleted") {
            return false;
        }

        await recreateSupabase();
        await delay(300);

        const confirmationCheck =
            await checkCurrentSessionUser();

        return confirmationCheck === "deleted";
    } catch (error) {
        console.warn("isUserDeleted timeout/error:", error);

        return false;
    }
}

export async function reassignLocalDataToUser(userId: string) {
    const now = Date.now();

    practiceRepo.reassignAllPracticesToUser(userId, now);
    sessionRepo.reassignAllSessionsToUser(userId, now);
}
