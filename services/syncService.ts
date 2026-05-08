import { getSupabase, recreateSupabase } from "@/lib/supabase";
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
let forceFreshClient = false;
let failureCount = 0;

export function setForceFreshClient(value: boolean) {
    forceFreshClient = value;
}
function setSyncState(next: SyncState) {
    syncState = next;
    emitSyncChanged();
}

export async function withTimeout<T>(
  promiseFactory: () => Promise<T>,
  ms = 6000
): Promise<T> {

  if (forceFreshClient) {
      console.log("Using fresh client (skip timeout)");
      forceFreshClient = false;
      return await promiseFactory();
  }

  const run = () =>
    Promise.race([
      promiseFactory(),
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error("Network timeout during sync")), ms)
      ),
    ]);

  try {
    const result = await run();
    failureCount = 0;
    return result;

  } catch (error: any) {

    if (error?.message !== "Network timeout during sync") throw error;

    failureCount++;
    console.log(`Timeout detected (${failureCount})`);

    await new Promise(r => setTimeout(r, 100)); // small buffer

    if (failureCount >= 2) {
        recreateSupabase();
        await new Promise(r => setTimeout(r, 300));
    }

    console.log("Retrying after recovery...");

    try {
        const retryResult = await run();
        failureCount = 0; 
        return retryResult;

    } catch (retryError) {

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

async function pushPendingPractices(userId: string) {
    const rows = practiceRepo.getDirtyPractices(userId);

    if (rows.length === 0) return;
    const payload = rows.map((row) => ({
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

    for (const row of rows) {
        practiceRepo.markPracticeSynced(row.id, syncedAt);
    }
}

async function pushPendingSessions(userId: string) {
    const rows = sessionRepo.getDirtySessions(userId);

    if (rows.length === 0) return;

    const payload = rows.map((row) => ({
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

    for (const row of rows) {
        sessionRepo.markSessionSynced(row.id, syncedAt);
    }
}

async function pushPendingDeletions(userId: string) {
    const rows = deletedRecordRepo.getPendingDeletedRecords(userId);
    for (const row of rows) {
        const tableName =
            row.entityType === "practice" ? "practices" : "sessions";

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
                };
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
        } catch (err) {
            console.error("pushPendingDeletions error for row:", row, err);
            throw err;
        }
    }
}

async function pullPractices(userId: string): Promise<any[]> {
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

    return data ?? [];
}

function applyRemotePractices(rows: any[]) {
    for (const row of rows) {
        const local = practiceRepo.getPracticeById(row.id as string);

        const remoteUpdatedAt = new Date(row.updated_at).getTime();
        const localUpdatedAt = local?.updatedAt ?? 0;

        if (row.deleted_at) {
            practiceRepo.deletePractice(row.id);
            continue;
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

    for (const row of data ?? []) {
        const local = localSessionsById.get(row.id as string);

        const remoteUpdatedAt = new Date(row.updated_at as string).getTime();
        const localUpdatedAt = local?.updatedAt ?? 0;

        if (row.deleted_at) {
            sessionRepo.deleteSessionById(row.id as string);
            continue;
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

export async function syncNow(userId: string | null) {
    if (!userId) return;

    lastUserId = userId;

    if (!getIsOnline()) {
        setSyncState("offline");
        return;
    }

    try {
        setSyncState("syncing");

        console.log("SYNC: claim");
        await claimAnonymousLocalDataIfNeeded(userId);

        await wipePendingBackupRestore(userId);

        console.log("SYNC: pushing practices");
        await pushPendingPractices(userId);

        console.log("SYNC: pushing sessions");
        await pushPendingSessions(userId);

        console.log("SYNC: pushing deletions");
        await pushPendingDeletions(userId);

        console.log("SYNC: pulling practices");
        const remotePractices = await pullPractices(userId);

        console.log("SYNC: applying remote practices");
        applyRemotePractices(remotePractices);

        console.log("SYNC: pulling sessions");
        await pullSessions(userId);

        console.log("SYNC: finished");
        
        appMetaRepo.setLocalDataOwnerUserId(userId);

        emitDataChanged();
        setSyncState("success");
        retryCount = 0;
    } catch (error: any) {
        console.error("syncNow error", error);

        if (await isUserDeleted()) {
            console.log("Auth invalid — signing out");
            emitAuthInvalid();
            return;
        }

        if (error?.message !== "Network timeout during sync") {
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
            return;
        }

        setSyncState("syncing");

        pendingSyncUserId = userId;

        const delay = getRetryDelay();
        retryCount++;

        setTimeout(() => {
            runQueuedSync();
        }, delay);
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
    
    const { data: sessionsDeleted, error: sessionError } = await withTimeout(async () => getSupabase()
        .from("sessions")
        .delete()
        .eq("user_id", userId)
        .select());

    if (sessionError) throw sessionError;

    const { data: practicesDeleted, error: practiceError } = await withTimeout( async () => getSupabase()
        .from("practices")
        .delete()
        .eq("user_id", userId)
        .select());

    if (practiceError) throw practiceError;
}

function getRetryDelay() {
    return Math.min(30000, 2000 * Math.pow(2, retryCount));
}

export async function isUserDeleted() {
    try {
        const { data } = await withTimeout( async () => 
            getSupabase().auth.getUser(),
            8000
        );

        return !data?.user;
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