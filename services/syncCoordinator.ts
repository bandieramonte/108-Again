import type { SyncState } from "../types/sync";
import type { RemoteSyncAccess } from "./appUpdatePolicy";
import type { SyncMode } from "./syncEngine";

export type SyncNowResult =
    | "auth_invalid"
    | "offline"
    | "policy_unavailable"
    | "retry_scheduled"
    | "success"
    | "skipped"
    | "update_required";

export type ProminentSyncStatus =
    | "failed"
    | "offline"
    | "postponed"
    | "retrieving_account_data"
    | "success";

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
    getCurrentSessionUserId(): Promise<string | null>;
    getIsOnline(): boolean;
    isAppAccessBlocked(): boolean;
    isNetworkTimeout(error: unknown): boolean;
    isUserDeleted(): Promise<boolean>;
    logger: Pick<Console, "error" | "log" | "warn">;
    markLocalDataOwnerIfSessionIsCurrent(userId: string): Promise<void>;
    requireRemoteAuthoritativeSync(userId: string): void;
    refreshAllReminders?: () => Promise<void> | void;
    scheduleTimer(callback: () => void, delayMs: number): TimerHandle;
    validateSessionAfterMaxRetries(): Promise<void>;
    verifyRemoteSyncAccess(): Promise<RemoteSyncAccess>;
};

function getProminentSyncResult(
    result: SyncNowResult
): Exclude<ProminentSyncStatus, "retrieving_account_data"> {
    switch (result) {
        case "success":
            return "success";
        case "offline":
            return "offline";
        case "policy_unavailable":
        case "retry_scheduled":
        case "update_required":
            return "postponed";
        case "auth_invalid":
        case "skipped":
            return "failed";
    }
}

export function createSyncCoordinator(deps: SyncCoordinatorDeps) {
    let syncState: SyncState = "idle";
    let syncInFlight: Promise<void> | null = null;
    let scheduledSyncTimeout: TimerHandle | null = null;
    let pendingSyncUserId: string | null = null;
    let pendingSyncMode: SyncMode | null = null;
    let pendingSyncShowsProminentStatus = false;
    let prominentSyncStatus: ProminentSyncStatus | null = null;
    let lastUserId: string | null = null;
    let retryCount = 0;

    function setSyncState(next: SyncState) {
        syncState = next;
        deps.emitSyncChanged();
    }

    function getSyncState(): SyncState {
        return syncState;
    }

    function getProminentSyncStatus(): ProminentSyncStatus | null {
        return prominentSyncStatus;
    }

    function setProminentSyncStatus(next: ProminentSyncStatus | null) {
        if (prominentSyncStatus === next) return;

        prominentSyncStatus = next;
        deps.emitSyncChanged();
    }

    function clearProminentSyncStatus() {
        setProminentSyncStatus(null);
    }

    function clearUserSyncState(userId?: string) {
        if (
            userId &&
            lastUserId !== userId &&
            pendingSyncUserId !== userId
        ) {
            return;
        }

        if (scheduledSyncTimeout) {
            deps.cancelTimer(scheduledSyncTimeout);
            scheduledSyncTimeout = null;
        }

        pendingSyncUserId = null;
        pendingSyncMode = null;
        pendingSyncShowsProminentStatus = false;
        clearProminentSyncStatus();
        lastUserId = null;
        retryCount = 0;

        if (!syncInFlight) {
            setSyncState("idle");
        }
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
        pendingSyncShowsProminentStatus = false;
        clearProminentSyncStatus();
        retryCount = 0;
    }

    function refreshRemindersAfterSync() {
        try {
            void Promise
                .resolve(deps.refreshAllReminders?.())
                .catch(error => {
                    deps.logger.warn(
                        "Failed to refresh practice reminders after sync",
                        error
                    );
                });
        } catch (error) {
            deps.logger.warn(
                "Failed to refresh practice reminders after sync",
                error
            );
        }
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

        const currentSessionUserId =
            await deps.getCurrentSessionUserId();

        if (currentSessionUserId !== userId) {
            deps.logger.log(
                "Skipping sync for a signed-out or different user"
            );
            clearUserSyncState(userId);
            return "skipped";
        }

        const remoteAccess = await deps.verifyRemoteSyncAccess();

        if (remoteAccess === "blocked") return "update_required";

        if (remoteAccess === "unavailable") {
            setSyncState("error");
            return "policy_unavailable";
        }

        if (await deps.isUserDeleted()) {
            deps.logger.log("Auth invalid before sync - signing out");
            deps.emitAuthInvalid();
            return "auth_invalid";
        }

        if (await deps.getCurrentSessionUserId() !== userId) {
            deps.logger.log("Sync session changed before data transfer");
            clearUserSyncState(userId);
            return "skipped";
        }

        try {
            setSyncState("syncing");

            await syncEngine.executeSync(userId, mode);
            await deps.markLocalDataOwnerIfSessionIsCurrent(userId);

            deps.emitDataChanged();
            refreshRemindersAfterSync();
            setSyncState("success");
            retryCount = 0;
            return "success";
        } catch (error: unknown) {
            if (await deps.getCurrentSessionUserId() !== userId) {
                deps.logger.log("Sync stopped because the session changed");
                clearUserSyncState(userId);
                return "skipped";
            }

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
            showProminentStatus?: boolean;
        }
    ) {
        if (deps.isAppAccessBlocked()) return;
        if (!userId) return;

        pendingSyncUserId = userId;
        pendingSyncMode = chooseSyncMode(
            pendingSyncMode,
            options?.mode
        );
        pendingSyncShowsProminentStatus =
            pendingSyncShowsProminentStatus ||
            options?.showProminentStatus === true;

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
        const showProminentStatus = pendingSyncShowsProminentStatus;
        pendingSyncUserId = null;
        pendingSyncMode = null;
        pendingSyncShowsProminentStatus = false;

        if (showProminentStatus) {
            setProminentSyncStatus("retrieving_account_data");
        }

        syncInFlight = (async () => {
            try {
                const result = await syncNow(userId, { mode });

                if (showProminentStatus) {
                    setProminentSyncStatus(
                        getProminentSyncResult(result)
                    );
                }
            } catch (error) {
                deps.logger.warn("Queued sync error:", error);

                if (showProminentStatus) {
                    setProminentSyncStatus("failed");
                }
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
        clearUserSyncState,
        clearProminentSyncStatus,
        getProminentSyncStatus,
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
