import { DEFAULT_PRACTICES, SEEDED_IDS } from "../constants/defaultPractices";

export const REMOTE_AUTHORITATIVE_SYNC_USER_ID_META =
    "remoteAuthoritativeSyncUserId";
const PENDING_BACKUP_RESTORE_META = "pendingBackupRestore";
const PENDING_BACKUP_RESTORE_USER_ID_META =
    "pendingBackupRestoreUserId";

export type SyncMode =
    | "merge_local"
    | "remote_overwrite_local";

export type RemotePracticeRow = {
    id: string;
    user_id: string;
    name: string;
    target_count: number;
    order_index: number;
    image_key: string | null;
    daily_target_count: number | null;
    default_session_count: number;
    total_offset: number;
    updated_at: string;
    deleted_at: string | null;
};

export type RemoteSessionRow = {
    id: string;
    user_id: string;
    practice_id: string;
    count: number;
    created_at: string;
    updated_at: string;
    deleted_at: string | null;
};

export type LocalPracticeRow = {
    id: string;
    name: string;
    targetCount: number;
    orderIndex: number;
    imageKey?: string | null;
    dailyTargetCount?: number | null;
    defaultSessionCount?: number | null;
    totalOffset?: number;
    userId?: string | null;
    updatedAt?: number | null;
    syncStatus?: string | null;
    lastSyncedAt?: number | null;
};

export type LocalSessionRow = {
    id: string;
    practiceId: string;
    count: number;
    createdAt: number;
    userId?: string | null;
    updatedAt?: number | null;
    syncStatus?: string | null;
    lastSyncedAt?: number | null;
};

export type DeletedRecordRow = {
    id: string;
    entityType: "practice" | "session";
    recordId: string;
    userId: string | null;
    deletedAt: number;
    syncStatus: "pending" | "synced" | "failed";
    payload: string | null;
};

type PracticeRepository = {
    getPracticeById(id: string): LocalPracticeRow | null;
    getAllPractices(): LocalPracticeRow[];
    getDirtyPractices(userId: string): LocalPracticeRow[];
    markPracticeSynced(
        id: string,
        lastSyncedAt: number,
        pushedUpdatedAt: number | null
    ): void;
    upsertPracticeFromRemote(row: RemotePracticeRow): void;
    deletePractice(id: string): void;
    deleteAllPractices(): void;
    claimAnonymousPractices(userId: string, updatedAt: number): void;
    resetAllSyncState(): void;
    markAllPracticesPending(userId: string, updatedAt: number): void;
};

type SessionRepository = {
    getAllSessionsForSync(): LocalSessionRow[];
    getDirtySessions(userId: string): LocalSessionRow[];
    markSessionSynced(
        id: string,
        lastSyncedAt: number,
        pushedUpdatedAt: number | null
    ): void;
    upsertSessionFromRemote(row: RemoteSessionRow): void;
    deleteSessionsByPractice(practiceId: string): void;
    deleteSessionById(id: string): void;
    deleteAllSessions(): void;
    claimAnonymousSessions(userId: string, updatedAt: number): void;
    getSessionsByPracticeForSync(practiceId: string): LocalSessionRow[];
    resetAllSyncState(): void;
    markAllSessionsPending(userId: string, updatedAt: number): void;
};

type DeletedRecordRepository = {
    getPendingDeletedRecords(userId: string): DeletedRecordRow[];
    claimAnonymousDeletedRecords(userId: string): void;
    markDeletedRecordSynced(id: string): void;
    getPendingDeletedRecordForRecord(
        userId: string,
        entityType: "practice" | "session",
        recordId: string
    ): DeletedRecordRow | null;
    deleteAllDeletedRecords(): void;
};

type AppMetaRepository = {
    getMeta(key: string): string | null;
    setMeta(key: string, value: string): void;
    deleteMeta(key: string): void;
};

export type SyncRemote = {
    pullPractices(userId: string): Promise<RemotePracticeRow[]>;
    pullSessions(userId: string): Promise<RemoteSessionRow[]>;
    getPracticesById(
        userId: string,
        ids: string[]
    ): Promise<Map<string, RemotePracticeRow>>;
    getSessionsById(
        userId: string,
        ids: string[]
    ): Promise<Map<string, RemoteSessionRow>>;
    upsertPractices(rows: RemotePracticeRow[]): Promise<void>;
    upsertSessions(rows: RemoteSessionRow[]): Promise<void>;
    softDeleteUserData(userId: string, deletedAt: number): Promise<void>;
};

type SyncLogger = Pick<Console, "log" | "warn" | "error">;

export type SyncEngineDeps = {
    practiceRepo: PracticeRepository;
    sessionRepo: SessionRepository;
    deletedRecordRepo: DeletedRecordRepository;
    appMetaRepo: AppMetaRepository;
    remote: SyncRemote;
    now?: () => number;
    logger?: SyncLogger;
};

function toTimestamp(value: string | null | undefined): number {
    if (!value) return 0;

    const time = new Date(value).getTime();
    return Number.isFinite(time) ? time : 0;
}

function remoteTimestamp(row: {
    updated_at?: string | null;
    deleted_at?: string | null;
}) {
    return Math.max(
        toTimestamp(row.updated_at),
        toTimestamp(row.deleted_at)
    );
}

function isDirty(syncStatus: string | null | undefined) {
    return syncStatus === "pending" || syncStatus === "failed";
}

export function createSyncEngine(deps: SyncEngineDeps) {
    const now = deps.now ?? Date.now;
    const logger = deps.logger ?? console;

    function isUnchangedSeededPractice(row: LocalPracticeRow) {
        if (!SEEDED_IDS.has(row.id)) return false;

        const defaultPractice =
            DEFAULT_PRACTICES.find((practice) => practice.id === row.id);

        if (!defaultPractice) return false;

        return (
            row.name === defaultPractice.name &&
            row.targetCount === defaultPractice.targetCount &&
            row.orderIndex === defaultPractice.orderIndex &&
            (row.imageKey ?? null) === (defaultPractice.imageKey ?? null) &&
            (row.dailyTargetCount ?? null) ===
                (defaultPractice.dailyTargetCount ?? null) &&
            (row.defaultSessionCount ?? 108) ===
                (defaultPractice.defaultSessionCount ?? 108) &&
            (row.totalOffset ?? 0) ===
                (defaultPractice.totalOffset ?? 0)
        );
    }

    function isUnchangedSeededPracticeWithoutSessions(row: LocalPracticeRow) {
        if (!isUnchangedSeededPractice(row)) return false;

        return deps.sessionRepo
            .getSessionsByPracticeForSync(row.id)
            .length === 0;
    }

    async function claimAnonymousLocalDataIfNeeded(userId: string | null) {
        if (!userId) return;

        const claimedAt = now();

        deps.practiceRepo.claimAnonymousPractices(userId, claimedAt);
        deps.sessionRepo.claimAnonymousSessions(userId, claimedAt);
        deps.deletedRecordRepo.claimAnonymousDeletedRecords(userId);
    }

    function resolveSyncMode(
        userId: string,
        requestedMode?: SyncMode
    ): SyncMode {
        const requiredRemoteSyncUserId =
            deps.appMetaRepo.getMeta(REMOTE_AUTHORITATIVE_SYNC_USER_ID_META);
        const hasPendingLocalOverwrite =
            deps.appMetaRepo.getMeta(PENDING_BACKUP_RESTORE_META) === "true";
        const pendingBackupRestoreUserId =
            deps.appMetaRepo.getMeta(PENDING_BACKUP_RESTORE_USER_ID_META);
        const remoteAuthoritativeRequested =
            requestedMode === "remote_overwrite_local" ||
            requiredRemoteSyncUserId === userId;

        if (hasPendingLocalOverwrite) {
            if (
                remoteAuthoritativeRequested &&
                pendingBackupRestoreUserId !== userId
            ) {
                deps.appMetaRepo.deleteMeta(PENDING_BACKUP_RESTORE_META);
                deps.appMetaRepo.deleteMeta(
                    PENDING_BACKUP_RESTORE_USER_ID_META
                );
                return "remote_overwrite_local";
            }

            deps.appMetaRepo.deleteMeta(
                REMOTE_AUTHORITATIVE_SYNC_USER_ID_META
            );
            return "merge_local";
        }

        return requiredRemoteSyncUserId === userId
            ? "remote_overwrite_local"
            : requestedMode ?? "merge_local";
    }

    async function wipeRemoteUserData(userId: string): Promise<number | null> {
        if (!userId) return null;

        const deletedAt = now();
        await deps.remote.softDeleteUserData(userId, deletedAt);

        return deletedAt;
    }

    async function wipePendingBackupRestore(userId: string) {
        const pendingBackupRestore =
            deps.appMetaRepo.getMeta(PENDING_BACKUP_RESTORE_META);

        if (pendingBackupRestore !== "true") return;

        logger.log("SYNC: backup restore detected -> wiping remote");

        const remoteDeletedAt =
            await wipeRemoteUserData(userId);

        if (remoteDeletedAt != null) {
            const localUpdatedAt = remoteDeletedAt + 1;

            deps.practiceRepo.markAllPracticesPending(
                userId,
                localUpdatedAt
            );
            deps.sessionRepo.markAllSessionsPending(
                userId,
                localUpdatedAt
            );
        }

        deps.appMetaRepo.deleteMeta(PENDING_BACKUP_RESTORE_META);
        deps.appMetaRepo.deleteMeta(PENDING_BACKUP_RESTORE_USER_ID_META);
    }

    function applyRemotePractices(userId: string, rows: RemotePracticeRow[]) {
        for (const row of rows) {
            const local = deps.practiceRepo.getPracticeById(row.id);

            const remoteUpdatedAt = toTimestamp(row.updated_at);
            const remoteDeletedAt = toTimestamp(row.deleted_at);
            const localUpdatedAt = local?.updatedAt ?? 0;

            const pendingDeletion =
                deps.deletedRecordRepo.getPendingDeletedRecordForRecord(
                    userId,
                    "practice",
                    row.id
                );

            if (row.deleted_at) {
                const shouldKeepDirtyLocal =
                    local &&
                    isDirty(local.syncStatus) &&
                    localUpdatedAt > remoteDeletedAt;

                if (shouldKeepDirtyLocal) {
                    continue;
                }

                deps.sessionRepo.deleteSessionsByPractice(row.id);
                deps.practiceRepo.deletePractice(row.id);
                continue;
            }

            if (pendingDeletion) {
                if (pendingDeletion.deletedAt >= remoteUpdatedAt) {
                    continue;
                }

                deps.deletedRecordRepo.markDeletedRecordSynced(
                    pendingDeletion.id
                );
            }

            if (!local) {
                deps.practiceRepo.upsertPracticeFromRemote(row);
                continue;
            }

            if (remoteUpdatedAt > localUpdatedAt) {
                deps.practiceRepo.upsertPracticeFromRemote(row);
            }
        }
    }

    function discardUnchangedLocalSeedsMissingFromRemote(
        userId: string,
        remoteRows: RemotePracticeRow[]
    ) {
        if (remoteRows.length === 0) return;

        const remoteIds = new Set(remoteRows.map((row) => row.id));

        for (const local of deps.practiceRepo.getAllPractices()) {
            if (remoteIds.has(local.id)) continue;
            if (isDirty(local.syncStatus)) continue;
            if (!isUnchangedSeededPracticeWithoutSessions(local)) continue;

            const pendingDeletion =
                deps.deletedRecordRepo.getPendingDeletedRecordForRecord(
                    userId,
                    "practice",
                    local.id
                );

            if (pendingDeletion) continue;

            deps.sessionRepo.deleteSessionsByPractice(local.id);
            deps.practiceRepo.deletePractice(local.id);
        }
    }

    function applyRemoteSessions(userId: string, rows: RemoteSessionRow[]) {
        const localSessionsById = new Map(
            deps.sessionRepo
                .getAllSessionsForSync()
                .map((row) => [row.id, row])
        );

        for (const row of rows) {
            const local = localSessionsById.get(row.id);

            const remoteUpdatedAt = toTimestamp(row.updated_at);
            const remoteDeletedAt = toTimestamp(row.deleted_at);
            const localUpdatedAt = local?.updatedAt ?? 0;

            const pendingDeletion =
                deps.deletedRecordRepo.getPendingDeletedRecordForRecord(
                    userId,
                    "session",
                    row.id
                );

            if (row.deleted_at) {
                const shouldKeepDirtyLocal =
                    local &&
                    isDirty(local.syncStatus) &&
                    localUpdatedAt > remoteDeletedAt;

                if (shouldKeepDirtyLocal) {
                    continue;
                }

                deps.sessionRepo.deleteSessionById(row.id);
                continue;
            }

            if (pendingDeletion) {
                if (pendingDeletion.deletedAt >= remoteUpdatedAt) {
                    continue;
                }

                deps.deletedRecordRepo.markDeletedRecordSynced(
                    pendingDeletion.id
                );
            }

            if (!local) {
                deps.sessionRepo.upsertSessionFromRemote(row);
                continue;
            }

            if (remoteUpdatedAt > localUpdatedAt) {
                deps.sessionRepo.upsertSessionFromRemote(row);
            }
        }
    }

    async function pushPendingPractices(userId: string) {
        const rows = deps.practiceRepo.getDirtyPractices(userId);

        if (rows.length === 0) return;

        const remoteById = await deps.remote.getPracticesById(
            userId,
            rows.map((row) => row.id)
        );

        const rowsToPush = rows.filter((row) => {
            const remote = remoteById.get(row.id);
            if (!remote) return true;

            if (
                remote.deleted_at &&
                remoteTimestamp(remote) >= (row.updatedAt ?? 0) &&
                isUnchangedSeededPracticeWithoutSessions(row)
            ) {
                deps.practiceRepo.upsertPracticeFromRemote(remote);
                return false;
            }

            if (remoteTimestamp(remote) > (row.updatedAt ?? 0)) {
                deps.practiceRepo.upsertPracticeFromRemote(remote);
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
            daily_target_count: row.dailyTargetCount ?? null,
            default_session_count: row.defaultSessionCount ?? 108,
            total_offset: row.totalOffset ?? 0,
            updated_at: new Date(row.updatedAt ?? now()).toISOString(),
            deleted_at: null,
        }));

        await deps.remote.upsertPractices(payload);

        const syncedAt = now();

        for (const row of rowsToPush) {
            deps.practiceRepo.markPracticeSynced(
                row.id,
                syncedAt,
                row.updatedAt ?? null
            );
        }
    }

    async function pushPendingSessions(userId: string) {
        const rows = deps.sessionRepo.getDirtySessions(userId);

        if (rows.length === 0) return;

        const remoteById = await deps.remote.getSessionsById(
            userId,
            rows.map((row) => row.id)
        );

        const rowsToPush = rows.filter((row) => {
            const remote = remoteById.get(row.id);
            if (!remote) return true;

            if (remoteTimestamp(remote) > (row.updatedAt ?? 0)) {
                deps.sessionRepo.upsertSessionFromRemote(remote);
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
            updated_at: new Date(row.updatedAt ?? now()).toISOString(),
            deleted_at: null,
        }));

        await deps.remote.upsertSessions(payload);

        const syncedAt = now();

        for (const row of rowsToPush) {
            deps.sessionRepo.markSessionSynced(
                row.id,
                syncedAt,
                row.updatedAt ?? null
            );
        }
    }

    async function pushPendingDeletions(userId: string) {
        const rows = deps.deletedRecordRepo.getPendingDeletedRecords(userId);

        for (const row of rows) {
            const activeLocal =
                row.entityType === "practice"
                    ? deps.practiceRepo.getPracticeById(row.recordId)
                    : deps.sessionRepo.getAllSessionsForSync()
                        .find((session) => session.id === row.recordId);

            if ((activeLocal?.updatedAt ?? 0) > row.deletedAt) {
                deps.deletedRecordRepo.markDeletedRecordSynced(row.id);
                continue;
            }

            try {
                if (row.entityType === "session") {
                    const payload = buildSessionDeletionPayload(row, userId);
                    const shouldPush = await shouldPushDeletion(
                        userId,
                        row,
                        "session"
                    );

                    if (!shouldPush) continue;

                    await deps.remote.upsertSessions([payload]);
                    deps.deletedRecordRepo.markDeletedRecordSynced(row.id);
                    deps.sessionRepo.deleteSessionById(row.recordId);
                    continue;
                }

                const payload = buildPracticeDeletionPayload(row, userId);
                const shouldPush = await shouldPushDeletion(
                    userId,
                    row,
                    "practice"
                );

                if (!shouldPush) continue;

                await deps.remote.upsertPractices([payload]);
                deps.deletedRecordRepo.markDeletedRecordSynced(row.id);
                deps.sessionRepo.deleteSessionsByPractice(row.recordId);
                deps.practiceRepo.deletePractice(row.recordId);
            } catch (err) {
                logger.error("pushPendingDeletions error for row:", row, err);
                throw err;
            }
        }
    }

    function buildSessionDeletionPayload(
        row: DeletedRecordRow,
        userId: string
    ): RemoteSessionRow {
        if (!row.payload) {
            throw new Error("Missing payload for session deletion");
        }

        const parsed = JSON.parse(row.payload);

        if (!parsed.practiceId || !parsed.createdAt) {
            throw new Error("Invalid session deletion payload");
        }

        const deletedAt = new Date(row.deletedAt).toISOString();

        return {
            id: row.recordId,
            user_id: userId,
            practice_id: parsed.practiceId,
            count: 0,
            created_at: new Date(parsed.createdAt).toISOString(),
            updated_at: deletedAt,
            deleted_at: deletedAt,
        };
    }

    function buildPracticeDeletionPayload(
        row: DeletedRecordRow,
        userId: string
    ): RemotePracticeRow {
        if (!row.payload) {
            throw new Error("Missing payload for practice deletion");
        }

        const parsed = JSON.parse(row.payload);

        if (
            !parsed.name ||
            parsed.targetCount == null ||
            parsed.orderIndex == null
        ) {
            throw new Error("Invalid practice deletion payload");
        }

        const deletedAt = new Date(row.deletedAt).toISOString();

        return {
            id: row.recordId,
            user_id: userId,
            name: parsed.name,
            target_count: parsed.targetCount,
            order_index: parsed.orderIndex,
            image_key: parsed.imageKey ?? null,
            daily_target_count: parsed.dailyTargetCount ?? null,
            default_session_count:
                parsed.defaultSessionCount ??
                parsed.defaultAddCount ??
                108,
            total_offset: parsed.totalOffset ?? 0,
            updated_at: deletedAt,
            deleted_at: deletedAt,
        };
    }

    async function shouldPushDeletion(
        userId: string,
        row: DeletedRecordRow,
        entityType: "practice" | "session"
    ) {
        const remoteById =
            entityType === "practice"
                ? await deps.remote.getPracticesById(userId, [row.recordId])
                : await deps.remote.getSessionsById(userId, [row.recordId]);

        const remote = remoteById.get(row.recordId);

        if (!remote) return true;

        const remoteUpdatedAt = toTimestamp(remote.updated_at);
        const remoteDeletedAt = toTimestamp(remote.deleted_at);

        if (!remote.deleted_at && remoteUpdatedAt > row.deletedAt) {
            deps.deletedRecordRepo.markDeletedRecordSynced(row.id);
            return false;
        }

        if (remote.deleted_at && remoteDeletedAt >= row.deletedAt) {
            if (entityType === "practice") {
                deps.sessionRepo.deleteSessionsByPractice(row.recordId);
                deps.practiceRepo.deletePractice(row.recordId);
            } else {
                deps.sessionRepo.deleteSessionById(row.recordId);
            }

            deps.deletedRecordRepo.markDeletedRecordSynced(row.id);
            return false;
        }

        return true;
    }

    function replaceLocalDataWithRemoteSnapshot(
        practices: RemotePracticeRow[],
        sessions: RemoteSessionRow[]
    ) {
        deps.deletedRecordRepo.deleteAllDeletedRecords();
        deps.sessionRepo.deleteAllSessions();
        deps.practiceRepo.deleteAllPractices();

        const activePracticeIds = new Set<string>();

        for (const practice of practices) {
            if (practice.deleted_at) continue;

            deps.practiceRepo.upsertPracticeFromRemote(practice);
            activePracticeIds.add(practice.id);
        }

        for (const session of sessions) {
            if (session.deleted_at) continue;
            if (!activePracticeIds.has(session.practice_id)) continue;

            deps.sessionRepo.upsertSessionFromRemote(session);
        }
    }

    async function syncRemoteAuthoritative(userId: string) {
        logger.log("SYNC: pulling remote snapshot");
        const remotePractices = await deps.remote.pullPractices(userId);
        const remoteSessions = await deps.remote.pullSessions(userId);

        logger.log("SYNC: replacing local data with remote snapshot");
        replaceLocalDataWithRemoteSnapshot(
            remotePractices,
            remoteSessions
        );

        deps.appMetaRepo.deleteMeta(PENDING_BACKUP_RESTORE_META);
        deps.appMetaRepo.deleteMeta(PENDING_BACKUP_RESTORE_USER_ID_META);
        deps.appMetaRepo.deleteMeta(REMOTE_AUTHORITATIVE_SYNC_USER_ID_META);
    }

    async function syncMergeLocal(userId: string) {
        logger.log("SYNC: claim");
        await claimAnonymousLocalDataIfNeeded(userId);

        await wipePendingBackupRestore(userId);

        logger.log("SYNC: pulling practices");
        const remotePractices = await deps.remote.pullPractices(userId);

        logger.log("SYNC: applying remote practices");
        applyRemotePractices(userId, remotePractices);
        discardUnchangedLocalSeedsMissingFromRemote(
            userId,
            remotePractices
        );

        logger.log("SYNC: pulling sessions");
        const remoteSessions = await deps.remote.pullSessions(userId);
        applyRemoteSessions(userId, remoteSessions);

        logger.log("SYNC: pushing practices");
        await pushPendingPractices(userId);

        logger.log("SYNC: pushing sessions");
        await pushPendingSessions(userId);

        logger.log("SYNC: pushing deletions");
        await pushPendingDeletions(userId);

        logger.log("SYNC: finished");
    }

    async function executeSync(userId: string, mode: SyncMode) {
        if (mode === "remote_overwrite_local") {
            await syncRemoteAuthoritative(userId);
            return;
        }

        await syncMergeLocal(userId);
    }

    async function syncUserData(
        userId: string,
        requestedMode?: SyncMode
    ) {
        const mode = resolveSyncMode(userId, requestedMode);

        if (mode === "remote_overwrite_local") {
            deps.appMetaRepo.setMeta(
                REMOTE_AUTHORITATIVE_SYNC_USER_ID_META,
                userId
            );
        }

        await executeSync(userId, mode);
    }

    async function resetLocalSyncState() {
        deps.appMetaRepo.deleteMeta(REMOTE_AUTHORITATIVE_SYNC_USER_ID_META);
        deps.practiceRepo.resetAllSyncState();
        deps.sessionRepo.resetAllSyncState();
    }

    return {
        claimAnonymousLocalDataIfNeeded,
        executeSync,
        resetLocalSyncState,
        resolveSyncMode,
        syncMergeLocal,
        syncRemoteAuthoritative,
        syncUserData,
        wipeRemoteUserData,
    };
}
