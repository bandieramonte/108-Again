import { getSupabase, recreateSupabase, recreateSupabaseIfStaleAfterBackground } from "@/lib/supabase";
import * as appMetaRepo from "@/repositories/appMetaRepo";
import * as deletedRecordRepo from "@/repositories/deletedRecordRepo";
import * as practiceRepo from "@/repositories/practiceRepo";
import * as sessionRepo from "@/repositories/sessionRepo";
import { emitAuthInvalid, emitDataChanged, emitSyncChanged } from "@/utils/events";
import { SyncState } from "../types/sync";
import { getIsOnline, subscribeOnline } from "./networkService";

let syncState: SyncState = "idle";
let syncInFlight: Promise<void> | null = null;
let scheduledSyncTimeout: ReturnType<typeof setTimeout> | null = null;
let pendingSyncUserId: string | null = null;
let lastUserId: string | null = null;
let retryCount = 0;
const NETWORK_TIMEOUT_MESSAGE = "Network timeout during sync";

type RemotePracticeRow = {
    id: string;
    user_id: string;
    name: string;
    target_count: number;
    order_index: number;
    image_key: string | null;
    default_add_count: number;
    total_offset: number;
    updated_at: string;
    deleted_at: string | null;
};

type RemoteSessionRow = {
    id: string;
    user_id: string;
    practice_id: string;
    count: number;
    created_at: string;
    updated_at: string;
    deleted_at: string | null;
};

export function resetStaleSyncStateAfterResume() {
    if (scheduledSyncTimeout) {
        clearTimeout(scheduledSyncTimeout);
        scheduledSyncTimeout = null;
    }

    syncInFlight = null;
    pendingSyncUserId = null;
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
    const result = await runWithTimeout(promiseFactory, ms);
    return result;

  } catch (error: any) {

    if (!isNetworkTimeout(error)) throw error;

    console.log("Network timeout detected");

    await recreateSupabase();
    await delay(300);

    console.log("Retrying after Supabase client recovery...");

    try {
        const retryResult = await runWithTimeout(promiseFactory, ms);
        return retryResult;

    } catch (retryError: any) {
        if (isNetworkTimeout(retryError)) {
            console.log("Retry timed out after Supabase client recovery");
        }

        console.log("Final retry failed");
        throw retryError;
    }
  }
}

export function getSyncState(): SyncState {
    return syncState;
}

export async function claimAnonymousLocalDataIfNeeded(userId: string | null) {
    if (!userId) return;

    const now = Date.now();

    practiceRepo.claimAnonymousPractices(userId, now);
    sessionRepo.claimAnonymousSessions(userId, now);
}

function isDirty(syncStatus: string | null | undefined) {
    return syncStatus === "pending" || syncStatus === "failed";
}

function toTimestamp(value: string | null | undefined): number {
    if (!value) return 0;

    const time = new Date(value).getTime();
    return Number.isFinite(time) ? time : 0;
}

function remoteTimestamp(row: { updated_at?: string | null; deleted_at?: string | null }) {
    return Math.max(toTimestamp(row.updated_at), toTimestamp(row.deleted_at));
}

async function getRemotePracticesById(
    userId: string,
    ids: string[]
): Promise<Map<string, RemotePracticeRow>> {
    if (ids.length === 0) return new Map();

    const { data, error } = await withTimeout(async () => getSupabase()
        .from("practices")
        .select(`
            id,
            user_id,
            name,
            target_count,
            order_index,
            image_key,
            default_add_count,
            total_offset,
            updated_at,
            deleted_at
        `)
        .eq("user_id", userId)
        .in("id", ids));

    if (error) throw error;

    return new Map((data ?? []).map((row) => [row.id as string, row as RemotePracticeRow]));
}

async function getRemoteSessionsById(
    userId: string,
    ids: string[]
): Promise<Map<string, RemoteSessionRow>> {
    if (ids.length === 0) return new Map();

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

    return new Map((data ?? []).map((row) => [row.id as string, row as RemoteSessionRow]));
}

async function pushPendingPractices(userId: string) {
    const rows = practiceRepo.getDirtyPractices(userId);

    if (rows.length === 0) return;

    const remoteById = await getRemotePracticesById(
        userId,
        rows.map((row) => row.id)
    );

    const rowsToPush = rows.filter((row) => {
        const remote = remoteById.get(row.id);
        if (!remote) return true;

        if (remoteTimestamp(remote) > (row.updatedAt ?? 0)) {
            practiceRepo.upsertPracticeFromRemote(remote);
            return false;
        }

        return true;
    });

    if (rowsToPush.length === 0) return;

    const payload = rowsToPush.map((row) => ({
        id: row.id,
        user_id: userId,
        name: row.name,
        target_count: row.targetCount,
        order_index: row.orderIndex,
        image_key: row.imageKey ?? null,
        default_add_count: row.defaultAddCount ?? 108,
        total_offset: row.totalOffset ?? 0,
        updated_at: new Date(row.updatedAt ?? Date.now()).toISOString(),
        deleted_at: null,
    }));

    const { error } = await withTimeout(async () => getSupabase()
        .from("practices")
        .upsert(payload, { onConflict: "id,user_id" }));

    if (error) {
        throw error;
    }

    const syncedAt = Date.now();

    for (const row of rowsToPush) {
        practiceRepo.markPracticeSynced(row.id, syncedAt, row.updatedAt ?? null);
    }
}

async function pushPendingSessions(userId: string) {
    const rows = sessionRepo.getDirtySessions(userId);

    if (rows.length === 0) return;

    const remoteById = await getRemoteSessionsById(
        userId,
        rows.map((row) => row.id)
    );

    const rowsToPush = rows.filter((row) => {
        const remote = remoteById.get(row.id);
        if (!remote) return true;

        if (remoteTimestamp(remote) > (row.updatedAt ?? 0)) {
            sessionRepo.upsertSessionFromRemote(remote);
            return false;
        }

        return true;
    });

    if (rowsToPush.length === 0) return;

    const payload = rowsToPush.map((row) => ({
        id: row.id,
        user_id: userId,
        practice_id: row.practiceId,
        count: row.count,
        created_at: new Date(row.createdAt).toISOString(),
        updated_at: new Date(row.updatedAt ?? Date.now()).toISOString(),
        deleted_at: null,
    }));
    const { error } = await withTimeout(async () => getSupabase()
        .from("sessions")
        .upsert(payload, { onConflict: "id" }));

    if (error) {
        throw error;
    }

    const syncedAt = Date.now();

    for (const row of rowsToPush) {
        sessionRepo.markSessionSynced(row.id, syncedAt, row.updatedAt ?? null);
    }
}

async function pushPendingDeletions(userId: string) {
    const rows = deletedRecordRepo.getPendingDeletedRecords(userId);
    for (const row of rows) {
        const tableName =
            row.entityType === "practice" ? "practices" : "sessions";

        const activeLocal =
            row.entityType === "practice"
                ? practiceRepo.getPracticeById(row.recordId)
                : sessionRepo.getAllSessionsForSync()
                    .find((session) => session.id === row.recordId);

        if ((activeLocal?.updatedAt ?? 0) > row.deletedAt) {
            deletedRecordRepo.markDeletedRecordSynced(row.id);
            continue;
        }

        let payload: any = {
            id: row.recordId,
            user_id: userId,
            updated_at: new Date(row.deletedAt).toISOString(),
            deleted_at: new Date(row.deletedAt).toISOString(),
        };

        try {
            // -------------------------
            // SESSION DELETION
            // -------------------------
            if (row.entityType === "session") {
                if (!row.payload) {
                    console.error("Missing payload for session deletion", row);
                    continue;
                }

                const parsed = JSON.parse(row.payload);

                if (!parsed.practiceId || !parsed.createdAt) {
                    console.error("Invalid session payload", parsed);
                    continue;
                }

                payload = {
                    ...payload,
                    practice_id: parsed.practiceId,
                    created_at: new Date(parsed.createdAt).toISOString(),

                    // required NOT NULL fields
                    count: 0,
                };
            }

            // -------------------------
            // PRACTICE DELETION
            // -------------------------
            if (row.entityType === "practice") {
                if (!row.payload) {
                    console.error("Missing payload for practice deletion", row);
                    continue;
                }

                const parsed = JSON.parse(row.payload);

                if (
                    !parsed.name ||
                    parsed.targetCount == null ||
                    parsed.orderIndex == null
                ) {
                    console.error("Invalid practice payload", parsed);
                    continue;
                }

                payload = {
                    ...payload,
                    name: parsed.name,
                    target_count: parsed.targetCount,
                    order_index: parsed.orderIndex,
                    image_key: parsed.imageKey ?? null,
                    default_add_count: parsed.defaultAddCount ?? 108,
                    total_offset: parsed.totalOffset ?? 0,
                };
            }

            const remoteById =
                row.entityType === "practice"
                    ? await getRemotePracticesById(userId, [row.recordId])
                    : await getRemoteSessionsById(userId, [row.recordId]);

            const remote = remoteById.get(row.recordId);

            if (remote) {
                const remoteUpdatedAt = toTimestamp(remote.updated_at);
                const remoteDeletedAt = toTimestamp(remote.deleted_at);

                if (!remote.deleted_at && remoteUpdatedAt > row.deletedAt) {
                    deletedRecordRepo.markDeletedRecordSynced(row.id);
                    continue;
                }

                if (remote.deleted_at && remoteDeletedAt >= row.deletedAt) {
                    if (row.entityType === "practice") {
                        sessionRepo.deleteSessionsByPractice(row.recordId);
                        practiceRepo.deletePractice(row.recordId);
                    } else {
                        sessionRepo.deleteSessionById(row.recordId);
                    }

                    deletedRecordRepo.markDeletedRecordSynced(row.id);
                    continue;
                }
            }

            const onConflict =
                tableName === "practices"
                    ? "id,user_id"
                    : "id";

            const { data, error } = await withTimeout(async () =>
                getSupabase()
                    .from(tableName)
                    .upsert(payload, { onConflict })
                    .select()
            );

            if (error) {
                console.error("Deletion sync failed payload:", payload);
                throw error;
            }

            if (!data || data.length === 0) {
                console.warn("Deletion upsert had no effect", payload);
            }

            deletedRecordRepo.markDeletedRecordSynced(row.id);

            if (row.entityType === "practice") {
                sessionRepo.deleteSessionsByPractice(row.recordId);
                practiceRepo.deletePractice(row.recordId);
            } else {
                sessionRepo.deleteSessionById(row.recordId);
            }
        } catch (err) {
            console.error("pushPendingDeletions error for row:", row, err);
            throw err;
        }
    }
}

async function pullPractices(userId: string): Promise<RemotePracticeRow[]> {
    const { data, error } = await withTimeout( async () => getSupabase()
            .from("practices")
            .select(`
                id,
                user_id,
                name,
                target_count,
                order_index,
                image_key,
                default_add_count,
                total_offset,
                updated_at,
                deleted_at
            `)
            .eq("user_id", userId)
            .or(
                "deleted_at.is.null,deleted_at.gt." +
                new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString()
            )
            .order("order_index", { ascending: true })
    );

    if (error) throw error;

    return (data ?? []) as RemotePracticeRow[];
}

function applyRemotePractices(userId: string, rows: RemotePracticeRow[]) {
    for (const row of rows) {
        const local = practiceRepo.getPracticeById(row.id as string);

        const remoteUpdatedAt = new Date(row.updated_at).getTime();
        const remoteDeletedAt = toTimestamp(row.deleted_at);
        const localUpdatedAt = local?.updatedAt ?? 0;

        const pendingDeletion =
            deletedRecordRepo.getPendingDeletedRecordForRecord(
                userId,
                "practice",
                row.id as string
            );

        if (row.deleted_at) {
            if (local && isDirty(local.syncStatus) && localUpdatedAt > remoteDeletedAt) {
                continue;
            }

            sessionRepo.deleteSessionsByPractice(row.id);
            practiceRepo.deletePractice(row.id);
            continue;
        }

        if (pendingDeletion) {
            if (pendingDeletion.deletedAt >= remoteUpdatedAt) {
                continue;
            }

            deletedRecordRepo.markDeletedRecordSynced(pendingDeletion.id);
        }

        if (!local) {
            practiceRepo.upsertPracticeFromRemote(row);
            continue;
        }

        if (remoteUpdatedAt > localUpdatedAt) {
            practiceRepo.upsertPracticeFromRemote(row);
        }
    }
}

async function pullSessions(userId: string) {
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
        .or("deleted_at.is.null,deleted_at.gt." + new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString()) // keep very recent deletions only
        .order("created_at", { ascending: true }));

    if (error) {
        throw error;
    }

    const localSessionsById = new Map(
        sessionRepo.getAllSessionsForSync().map((row) => [row.id, row])
    );

    for (const row of (data ?? []) as RemoteSessionRow[]) {
        const local = localSessionsById.get(row.id as string);

        const remoteUpdatedAt = new Date(row.updated_at as string).getTime();
        const remoteDeletedAt = toTimestamp(row.deleted_at);
        const localUpdatedAt = local?.updatedAt ?? 0;

        const pendingDeletion =
            deletedRecordRepo.getPendingDeletedRecordForRecord(
                userId,
                "session",
                row.id as string
            );

        if (row.deleted_at) {
            if (local && isDirty(local.syncStatus) && localUpdatedAt > remoteDeletedAt) {
                continue;
            }

            sessionRepo.deleteSessionById(row.id as string);
            continue;
        }

        if (pendingDeletion) {
            if (pendingDeletion.deletedAt >= remoteUpdatedAt) {
                continue;
            }

            deletedRecordRepo.markDeletedRecordSynced(pendingDeletion.id);
        }

        if (!local) {
            sessionRepo.upsertSessionFromRemote(row as any);
            continue;
        }

        if (remoteUpdatedAt > localUpdatedAt) {
            sessionRepo.upsertSessionFromRemote(row as any);
        }
    }
}

export async function syncNow(userId: string | null): Promise<SyncNowResult> {
    if (!userId) return "skipped";

    lastUserId = userId;

    if (!getIsOnline()) {
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

        console.log("SYNC: claim");
        await claimAnonymousLocalDataIfNeeded(userId);

        await wipePendingBackupRestore(userId);

        console.log("SYNC: pulling practices");
        const remotePractices = await pullPractices(userId);

        console.log("SYNC: applying remote practices");
        applyRemotePractices(userId, remotePractices);

        console.log("SYNC: pulling sessions");
        await pullSessions(userId);

        console.log("SYNC: pushing practices");
        await pushPendingPractices(userId);

        console.log("SYNC: pushing sessions");
        await pushPendingSessions(userId);

        console.log("SYNC: pushing deletions");
        await pushPendingDeletions(userId);

        console.log("SYNC: finished");
        
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

        const delay = getRetryDelay();
        retryCount++;

        setTimeout(() => {
            runQueuedSync();
        }, delay);

        return "retry_scheduled";
    } finally {
        emitSyncChanged();
    }
}

export async function requestSync(
    userId: string | null,
    options?: {
        immediate?: boolean;
    }
) {
    if (!userId) return;

    pendingSyncUserId = userId;

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
    pendingSyncUserId = null;

    syncInFlight = (async () => {

        try {
            await syncNow(userId);
        } catch (error) {
            console.warn("Queued sync error:", error);
        }
        finally {
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
    practiceRepo.resetAllSyncState();
    sessionRepo.resetAllSyncState();
}

export async function wipeRemoteUserData(userId: string) {
    if (!userId) return;
    
    const { error: sessionError } = await withTimeout(async () => getSupabase()
        .from("sessions")
        .delete()
        .eq("user_id", userId)
        .select());

    if (sessionError) throw sessionError;

    const { error: practiceError } = await withTimeout( async () => getSupabase()
        .from("practices")
        .delete()
        .eq("user_id", userId)
        .select());

    if (practiceError) throw practiceError;
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

    const { data, error } = await withTimeout( async () =>
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

        // If auth check itself fails,
        // do not assume account deleted
        return false;
    }
}

export async function reassignLocalDataToUser(userId: string) {
    const now = Date.now();

    practiceRepo.reassignAllPracticesToUser(userId, now);
    sessionRepo.reassignAllSessionsToUser(userId, now);
}

async function wipePendingBackupRestore(userId: string){
    const pendingBackupRestore =
    appMetaRepo.getMeta("pendingBackupRestore");

    if (pendingBackupRestore === "true") {
        console.log( "SYNC: backup restore detected -> wiping remote");
        await wipeRemoteUserData(userId);
        appMetaRepo.setMeta(
            "pendingBackupRestore",
            "false"
        );
    }
}
