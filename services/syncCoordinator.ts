import type { SyncState } from "../types/sync";
import type { SyncMode } from "./syncEngine";

export type SyncNowResult =
    | "auth_invalid"
    | "offline"
    | "retry_scheduled"
    | "success"
    | "skipped";

type CoordinatorSyncEngine = {
    executeSync(userId: string, mode: SyncMode): Promise<void>;
    resolveSyncMode(
        userId: string,
        requestedMode?: SyncMode
    ): SyncMode;
};

type TimerHandle = ReturnType<typeof setTimeout>;

type SyncCoordinatorDeps = {
    cancelTimer(handle: TimerHandle): void;
    createSyncEngine(): CoordinatorSyncEngine;
    emitAuthInvalid(): void;
    emitDataChanged(): void;
    emitSyncChanged(): void;
    getIsOnline(): boolean;
    isAppAccessBlocked(): boolean;
    isNetworkTimeout(error: unknown): boolean;
    isUserDeleted(): Promise<boolean>;
    logger: Pick<Console, "error" | "log" | "warn">;
    markLocalDataOwnerIfSessionIsCurrent(userId: string): Promise<void>;
    requireRemoteAuthoritativeSync(userId: string): void;
    scheduleTimer(callback: () => void, delayMs: number): TimerHandle;
    validateSessionAfterMaxRetries(): Promise<void>;
};

export function createSyncCoordinator(deps: SyncCoordinatorDeps) {
    let syncState: SyncState = "idle";
    let syncInFlight: Promise<void> | null = null;
    let scheduledSyncTimeout: TimerHandle | null = null;
    let pendingSyncUserId: string | null = null;
    let pendingSyncMode: SyncMode | null = null;
    let lastUserId: string | null = null;
    let retryCount = 0;

    function setSyncState(next: SyncState) {
        syncState = next;
        deps.emitSyncChanged();
    }

    function getSyncState(): SyncState {
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

    function getRetryDelay() {
        return Math.min(30000, 2000 * Math.pow(2, retryCount));
    }

    function resetStaleSyncStateAfterResume() {
        if (scheduledSyncTimeout) {
            deps.cancelTimer(scheduledSyncTimeout);
            scheduledSyncTimeout = null;
        }

        syncInFlight = null;
        pendingSyncUserId = null;
        pendingSyncMode = null;
        retryCount = 0;
    }

    async function syncNow(
        userId: string | null,
        options?: { mode?: SyncMode }
    ): Promise<SyncNowResult> {
        if (deps.isAppAccessBlocked()) return "skipped";
        if (!userId) return "skipped";

        lastUserId = userId;
        const syncEngine = deps.createSyncEngine();
        const mode = syncEngine.resolveSyncMode(
            userId,
            options?.mode
        );

        if (mode === "remote_overwrite_local") {
            deps.requireRemoteAuthoritativeSync(userId);
        }

        if (!deps.getIsOnline()) {
            if (mode === "remote_overwrite_local") {
                pendingSyncUserId = userId;
                pendingSyncMode = mode;
            }

            setSyncState("offline");
            return "offline";
        }

        if (await deps.isUserDeleted()) {
            deps.logger.log("Auth invalid before sync - signing out");
            deps.emitAuthInvalid();
            return "auth_invalid";
        }

        try {
            setSyncState("syncing");

            await syncEngine.executeSync(userId, mode);
            await deps.markLocalDataOwnerIfSessionIsCurrent(userId);

            deps.emitDataChanged();
            setSyncState("success");
            retryCount = 0;
            return "success";
        } catch (error: unknown) {
            deps.logger.error("syncNow error", error);

            if (await deps.isUserDeleted()) {
                deps.logger.log("Auth invalid - signing out");
                deps.emitAuthInvalid();
                return "auth_invalid";
            }

            if (!deps.isNetworkTimeout(error)) {
                setSyncState("error");
                throw error;
            }

            if (retryCount >= 3) {
                deps.logger.warn("Max sync retries reached");
                retryCount = 0;

                try {
                    await deps.validateSessionAfterMaxRetries();
                } catch (sessionError) {
                    deps.logger.warn(
                        "Session validation failed after max retries",
                        sessionError
                    );
                }

                setSyncState("error");
                return "retry_scheduled";
            }

            setSyncState("syncing");
            pendingSyncUserId = userId;
            pendingSyncMode = mode;

            const retryDelay = getRetryDelay();
            retryCount += 1;

            scheduledSyncTimeout = deps.scheduleTimer(() => {
                scheduledSyncTimeout = null;
                void runQueuedSync();
            }, retryDelay);

            return "retry_scheduled";
        } finally {
            deps.emitSyncChanged();
        }
    }

    async function requestSync(
        userId: string | null,
        options?: {
            immediate?: boolean;
            mode?: SyncMode;
        }
    ) {
        if (deps.isAppAccessBlocked()) return;
        if (!userId) return;

        pendingSyncUserId = userId;
        pendingSyncMode = chooseSyncMode(
            pendingSyncMode,
            options?.mode
        );

        if (scheduledSyncTimeout) {
            deps.cancelTimer(scheduledSyncTimeout);
            scheduledSyncTimeout = null;
        }

        if (options?.immediate) {
            void runQueuedSync();
            return;
        }

        scheduledSyncTimeout = deps.scheduleTimer(() => {
            scheduledSyncTimeout = null;
            void runQueuedSync();
        }, 2000);
    }

    async function runQueuedSync() {
        if (deps.isAppAccessBlocked()) return;
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
                deps.logger.warn("Queued sync error:", error);
            } finally {
                syncInFlight = null;

                if (pendingSyncUserId) {
                    void runQueuedSync();
                }
            }
        })();

        await syncInFlight;
    }

    function handleConnectivityChanged() {
        if (!deps.getIsOnline()) {
            setSyncState("offline");
            return;
        }

        if (lastUserId) {
            void requestSync(lastUserId);
        }
    }

    return {
        getSyncState,
        handleConnectivityChanged,
        requestSync,
        resetStaleSyncStateAfterResume,
        syncNow,
    };
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
