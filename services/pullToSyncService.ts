import type { SyncNowResult } from "./syncCoordinator";

export type PullToSyncResult =
    | "failed"
    | "offline"
    | "postponed"
    | "signed_out"
    | "success";

type PullToSyncDeps = {
    getIsOnline(): boolean;
    onError?(error: unknown): void;
    syncNow(userId: string): Promise<SyncNowResult>;
};

function getPullToSyncResult(
    result: SyncNowResult
): PullToSyncResult {
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

export async function pullToSync(
    userId: string | null,
    deps: PullToSyncDeps
): Promise<PullToSyncResult> {
    if (!deps.getIsOnline()) return "offline";
    if (!userId) return "signed_out";

    try {
        return getPullToSyncResult(await deps.syncNow(userId));
    } catch (error) {
        deps.onError?.(error);
        return "failed";
    }
}
