import { getSupabase, recreateSupabase, recreateSupabaseIfStaleAfterBackground } from "@/lib/supabase";
import * as appMetaRepo from "@/repositories/appMetaRepo";
import * as deletedRecordRepo from "@/repositories/deletedRecordRepo";
import * as practiceRepo from "@/repositories/practiceRepo";
import * as sessionRepo from "@/repositories/sessionRepo";
import { emitAuthInvalid, emitDataChanged, emitSyncChanged } from "@/utils/events";
import { getIsOnline, subscribeOnline } from "./networkService";
import {
    isAppAccessBlocked,
    verifyRemoteSyncAccess,
} from "./appUpdateService";
import * as practiceReminderRefreshService from "./practiceReminderRefreshService";
import { createSupabaseSyncRemote } from "./supabaseSyncRemote";
import { createSyncCoordinator } from "./syncCoordinator";
import {
    createSyncEngine,
    REMOTE_AUTHORITATIVE_SYNC_USER_ID_META,
} from "./syncEngine";
import type { SyncMode } from "./syncEngine";

export type { SyncMode } from "./syncEngine";
export { getSyncLabel } from "./syncCoordinator";
export type { SyncNowResult } from "./syncCoordinator";

const NETWORK_TIMEOUT_MESSAGE = "Network timeout during sync";

type UserDeletionCheckResult =
  | "deleted"
  | "active"
  | "inconclusive";

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

function isNetworkTimeout(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    error.message === NETWORK_TIMEOUT_MESSAGE
  );
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

function createAppSyncEngine() {
    return createSyncEngine({
        appMetaRepo,
        deletedRecordRepo,
        practiceRepo,
        remote: createSupabaseSyncRemote(getSupabase, withTimeout),
        sessionRepo,
    });
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

let syncCoordinator: ReturnType<typeof createSyncCoordinator> | null = null;

function getSyncCoordinator() {
    if (!syncCoordinator) {
        syncCoordinator = createSyncCoordinator({
            cancelTimer: clearTimeout,
            createSyncEngine: createAppSyncEngine,
            emitAuthInvalid,
            emitDataChanged,
            emitSyncChanged,
            getIsOnline,
            isAppAccessBlocked,
            isNetworkTimeout,
            isUserDeleted,
            logger: console,
            markLocalDataOwnerIfSessionIsCurrent,
            requireRemoteAuthoritativeSync,
            refreshAllReminders:
                practiceReminderRefreshService.queueRefreshAllPracticeReminders,
            scheduleTimer: setTimeout,
            validateSessionAfterMaxRetries: async () => {
                await getSupabase().auth.getSession();
            },
            verifyRemoteSyncAccess,
        });
    }

    return syncCoordinator;
}

export function resetStaleSyncStateAfterResume() {
    getSyncCoordinator().resetStaleSyncStateAfterResume();
}

export function getSyncState() {
    return getSyncCoordinator().getSyncState();
}

export async function syncNow(
    userId: string | null,
    options?: {
        mode?: SyncMode;
    }
) {
    return getSyncCoordinator().syncNow(userId, options);
}

export async function requestSync(
    userId: string | null,
    options?: {
        immediate?: boolean;
        mode?: SyncMode;
    }
) {
    return getSyncCoordinator().requestSync(userId, options);
}

export function initializeSyncRetry() {
    subscribeOnline(() => {
        getSyncCoordinator().handleConnectivityChanged();
    });
}

export async function resetLocalSyncState() {
    await createAppSyncEngine().resetLocalSyncState();
}

export async function wipeRemoteUserData(userId: string): Promise<number | null> {
    return createAppSyncEngine().wipeRemoteUserData(userId);
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
