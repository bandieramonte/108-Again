import { DEFAULT_PRACTICES, SEEDED_IDS } from "../constants/defaultPractices";
import { SyncMetadata } from "../types/sync";
import { MAX_TARGET_COUNT } from "../utils/numberUtils";

export type OperationPracticeRow = {
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

export type OperationSessionRow = {
    id: string;
    practiceId: string;
    count: number;
    createdAt: number;
    userId?: string | null;
    updatedAt?: number | null;
    syncStatus?: string | null;
    lastSyncedAt?: number | null;
};

type OperationPracticeRepo = {
    getAllPractices(): OperationPracticeRow[];
    getMaxOrderIndex(): { maxOrder: number | null };
    getPracticeById(id: string): OperationPracticeRow | null;
    getPracticeName(id: string): string | null;
    insertPractice(
        id: string,
        name: string,
        target: number,
        orderIndex: number,
        syncMetadata: SyncMetadata,
        imageKey?: string | null,
        dailyTargetCount?: number | null,
        defaultSessionCount?: number,
        totalOffset?: number
    ): void;
    updatePractice(
        id: string,
        name: string,
        target: number,
        syncMetadata: SyncMetadata
    ): void;
    updatePracticeDailyTargetCount(
        id: string,
        dailyTargetCount: number | null,
        syncMetadata: SyncMetadata
    ): void;
    updatePracticeDefaultSessionCount(
        id: string,
        defaultSessionCount: number,
        syncMetadata: SyncMetadata
    ): void;
    updatePracticeOrder(
        id: string,
        orderIndex: number,
        syncMetadata: SyncMetadata
    ): void;
    updatePracticeTotalOffset(
        id: string,
        totalOffset: number,
        syncMetadata: SyncMetadata
    ): void;
    resetPracticeTotals(userId: string | null, updatedAt: number): void;
    deletePractice(id: string): void;
    deleteAllPractices(): void;
};

type OperationSessionRepo = {
    getSessionsByPractice(practiceId: string): OperationSessionRow[];
    getPracticeTotal(practiceId: string): { total: number };
    getDailyTotals(practiceId: string): { day: string; total: number }[];
    getPracticeLifetimeStats(practiceId: string): {
        averageSessionSize: number;
        largestSession: number;
        longestStreak: number;
        currentStreak: number;
    };
    getSessionsByPracticeForSync(practiceId: string): OperationSessionRow[];
    getAllSessionsForSync(): OperationSessionRow[];
    getSessionForDay(
        practiceId: string,
        date: string
    ): OperationSessionRow | null;
    getDeletedSessionForDay(
        practiceId: string,
        date: string
    ): OperationSessionRow | null;
    insertSession(
        id: string,
        practiceId: string,
        count: number,
        createdAt: number,
        syncMetadata: SyncMetadata
    ): void;
    updateSessionCount(
        id: string,
        count: number,
        syncMetadata: SyncMetadata
    ): void;
    reviveSession(
        id: string,
        count: number,
        syncMetadata: SyncMetadata
    ): void;
    softDeleteAllSessions(
        userId: string | null,
        updatedAt: number | null
    ): void;
    deleteSessionsByPractice(practiceId: string): void;
    deleteAllSessions(): void;
};

type OperationDeletedRecordRepo = {
    insertDeletedRecord(
        id: string,
        entityType: "practice" | "session",
        recordId: string,
        userId: string | null,
        deletedAt: number,
        syncStatus: "pending" | "synced" | "failed",
        payload?: string | null
    ): void;
    deleteAllDeletedRecords(): void;
};

type OperationAppMetaRepo = {
    deleteMeta(key: string): void;
    setMeta(key: string, value: string): void;
};

export type AppOperationEngineDeps = {
    appMetaRepo: OperationAppMetaRepo;
    deletedRecordRepo: OperationDeletedRecordRepo;
    emitDataChanged?: () => void;
    enqueueWrite: (fn: () => Promise<void> | void) => Promise<void>;
    getCurrentUserId: () => string | null;
    logger?: Pick<Console, "warn">;
    now?: () => number;
    practiceRepo: OperationPracticeRepo;
    randomUUID: () => string;
    refreshAllReminders?: () => Promise<void> | void;
    refreshReminderForPractice?: (
        practiceId: string
    ) => Promise<void> | void;
    requestSync?: (
        userId: string | null,
        options?: {
            immediate?: boolean;
        }
    ) => Promise<void> | void;
    sessionRepo: OperationSessionRepo;
    transaction: (fn: () => void) => void;
};

export type AddedSessionResult = {
    id: string;
    practiceId: string;
    count: number;
    createdAt: number;
};

const BACKUP_APP_ID = "app108again";

function dayStringFromTimestamp(timestamp: number) {
    const date = new Date(timestamp);

    return (
        date.getUTCFullYear() +
        "-" +
        String(date.getUTCMonth() + 1).padStart(2, "0") +
        "-" +
        String(date.getUTCDate()).padStart(2, "0")
    );
}

export function createAppOperationEngine(deps: AppOperationEngineDeps) {
    const now = deps.now ?? Date.now;

    function getWriteSyncMetadata(): SyncMetadata {
        const userId = deps.getCurrentUserId();
        const updatedAt = now();

        return {
            userId,
            updatedAt,
            syncStatus: userId ? "pending" : "synced",
            lastSyncedAt: userId ? null : updatedAt,
        };
    }

    function getBackupSyncMetadata(): SyncMetadata {
        const userId = deps.getCurrentUserId();
        const updatedAt = now();

        return {
            userId,
            updatedAt,
            syncStatus: "pending",
            lastSyncedAt: null,
        };
    }

    function refreshReminderForPractice(practiceId: string) {
        try {
            void Promise
                .resolve(deps.refreshReminderForPractice?.(practiceId))
                .catch(error => {
                    deps.logger?.warn(
                        "Failed to refresh practice reminder",
                        error
                    );
                });
        } catch (error) {
            deps.logger?.warn(
                "Failed to refresh practice reminder",
                error
            );
        }
    }

    function refreshAllReminders() {
        try {
            void Promise
                .resolve(deps.refreshAllReminders?.())
                .catch(error => {
                    deps.logger?.warn(
                        "Failed to refresh practice reminders",
                        error
                    );
                });
        } catch (error) {
            deps.logger?.warn(
                "Failed to refresh practice reminders",
                error
            );
        }
    }

    function createPractice(
        name: string,
        target: number,
        dailyTargetCount: number | null = null,
        defaultSessionCount = 108,
        imageKey: string | null = null
    ) {
        const practices = deps.practiceRepo.getAllPractices();

        if (practices.length >= 10) {
            throw new Error("Maximum of 10 practices reached.");
        }

        const orderResult = deps.practiceRepo.getMaxOrderIndex();
        const nextOrder = (orderResult.maxOrder ?? 0) + 1;
        const syncMetadata = getWriteSyncMetadata();
        const id = deps.randomUUID();

        deps.practiceRepo.insertPractice(
            id,
            name,
            target,
            nextOrder,
            syncMetadata,
            imageKey,
            dailyTargetCount,
            defaultSessionCount,
            0
        );

        deps.emitDataChanged?.();
        refreshReminderForPractice(id);
        void deps.requestSync?.(syncMetadata.userId);

        return id;
    }

    function createSeedPractice(
        seedPracticeId: string,
        options: {
            targetCount?: number;
            defaultSessionCount?: number;
        } = {}
    ) {
        const defaultPractice =
            DEFAULT_PRACTICES.find(practice => practice.id === seedPracticeId);

        if (!defaultPractice) {
            throw new Error(`Seed practice not found: ${seedPracticeId}`);
        }

        const practices = deps.practiceRepo.getAllPractices();

        if (practices.some(practice => practice.id === seedPracticeId)) {
            throw new Error("This seed practice is already active.");
        }

        if (practices.length >= 10) {
            throw new Error("Maximum of 10 practices reached.");
        }

        const orderResult = deps.practiceRepo.getMaxOrderIndex();
        const nextOrder = (orderResult.maxOrder ?? 0) + 1;
        const syncMetadata = getWriteSyncMetadata();

        deps.practiceRepo.insertPractice(
            defaultPractice.id,
            defaultPractice.name,
            options.targetCount ?? defaultPractice.targetCount,
            nextOrder,
            syncMetadata,
            defaultPractice.imageKey ?? null,
            defaultPractice.dailyTargetCount ?? null,
            options.defaultSessionCount ??
                defaultPractice.defaultSessionCount ??
                108,
            defaultPractice.totalOffset ?? 0
        );

        deps.emitDataChanged?.();
        refreshReminderForPractice(defaultPractice.id);
        void deps.requestSync?.(syncMetadata.userId);

        return defaultPractice.id;
    }

    function reorderPractices(orderedPracticeIds: string[]) {
        const practices = deps.practiceRepo.getAllPractices();
        const activeIds = new Set(practices.map(practice => practice.id));

        if (orderedPracticeIds.length !== practices.length) {
            throw new Error("Practice order does not include all practices.");
        }

        for (const practiceId of orderedPracticeIds) {
            if (!activeIds.has(practiceId)) {
                throw new Error(`Practice not found: ${practiceId}`);
            }
        }

        if (new Set(orderedPracticeIds).size !== orderedPracticeIds.length) {
            throw new Error("Practice order contains duplicate practices.");
        }

        const syncMetadata = getWriteSyncMetadata();

        deps.transaction(() => {
            orderedPracticeIds.forEach((practiceId, index) => {
                deps.practiceRepo.updatePracticeOrder(
                    practiceId,
                    index + 1,
                    syncMetadata
                );
            });
        });

        deps.emitDataChanged?.();
        void deps.requestSync?.(syncMetadata.userId);
    }

    function updatePractice(
        id: string,
        name: string,
        target: number,
        newTotal: number
    ) {
        if (newTotal > MAX_TARGET_COUNT) {
            throw new Error(
                `Total count cannot exceed ${MAX_TARGET_COUNT.toLocaleString()}`
            );
        }

        const currentTotal = deps.sessionRepo.getPracticeTotal(id).total;
        const difference = newTotal - currentTotal;
        const syncMetadata = getWriteSyncMetadata();

        deps.practiceRepo.updatePractice(
            id,
            name,
            target,
            syncMetadata
        );

        if (difference !== 0) {
            const practice = deps.practiceRepo.getPracticeById(id);
            const currentOffset = practice?.totalOffset ?? 0;
            const newOffset = currentOffset + difference;

            deps.practiceRepo.updatePracticeTotalOffset(
                id,
                newOffset,
                syncMetadata
            );
        }

        deps.emitDataChanged?.();
        refreshReminderForPractice(id);
        void deps.requestSync?.(syncMetadata.userId);
    }

    async function deletePractice(id: string) {
        const userId = deps.getCurrentUserId();
        const deletedAt = now();

        await deps.enqueueWrite(() => {
            deps.transaction(() => {
                const practice = deps.practiceRepo.getPracticeById(id);

                if (!practice) {
                    throw new Error(`Practice not found: ${id}`);
                }

                const sessions =
                    deps.sessionRepo.getSessionsByPracticeForSync(id);
                const practiceExistsRemotely =
                    !!practice.userId &&
                    !!practice.lastSyncedAt;
                const deletionOwnerUserId =
                    practice.userId ?? userId;
                const shouldCreatePracticeDeletion =
                    practiceExistsRemotely ||
                    SEEDED_IDS.has(id);

                if (deletionOwnerUserId && practiceExistsRemotely) {
                    for (const session of sessions) {
                        const sessionExistsRemotely =
                            !!session.userId &&
                            !!session.lastSyncedAt;

                        if (!sessionExistsRemotely) continue;

                        deps.deletedRecordRepo.insertDeletedRecord(
                            deps.randomUUID(),
                            "session",
                            session.id,
                            deletionOwnerUserId,
                            deletedAt,
                            "pending",
                            JSON.stringify({
                                practiceId: session.practiceId,
                                createdAt: session.createdAt,
                            })
                        );
                    }
                }

                if (shouldCreatePracticeDeletion) {
                    deps.deletedRecordRepo.insertDeletedRecord(
                        deps.randomUUID(),
                        "practice",
                        id,
                        deletionOwnerUserId,
                        deletedAt,
                        "pending",
                        JSON.stringify({
                            name: practice.name,
                            targetCount: practice.targetCount,
                            orderIndex: practice.orderIndex,
                            imageKey: practice.imageKey ?? null,
                            dailyTargetCount:
                                practice.dailyTargetCount ?? null,
                            defaultSessionCount:
                                practice.defaultSessionCount ?? 108,
                            totalOffset: practice.totalOffset ?? 0,
                        })
                    );
                }

                deps.sessionRepo.deleteSessionsByPractice(id);
                deps.practiceRepo.deletePractice(id);
            });
        });

        deps.emitDataChanged?.();
        refreshReminderForPractice(id);
        void deps.requestSync?.(userId);
    }

    function getPracticeEditData(id: string) {
        const practice = deps.practiceRepo.getPracticeById(id);

        if (!practice) {
            throw new Error(`Practice not found: ${id}`);
        }

        const totalResult = deps.sessionRepo.getPracticeTotal(id);

        return {
            name: practice.name,
            targetCount: practice.targetCount,
            total: totalResult.total,
            dailyTargetCount: practice.dailyTargetCount ?? null,
            defaultSessionCount: practice.defaultSessionCount ?? 108,
        };
    }

    function getPracticeName(id: string) {
        return deps.practiceRepo.getPracticeName(id);
    }

    function getPractice(id: string) {
        return deps.practiceRepo.getPracticeById(id);
    }

    function getAllPractices() {
        return deps.practiceRepo.getAllPractices();
    }

    function addSession(practiceId: string, count: number) {
        const operationNow = now();
        const practice = getPracticeEditData(practiceId);
        const newTotal = practice.total + count;

        if (newTotal > MAX_TARGET_COUNT) {
            throw new Error(
                `Total count cannot exceed ${MAX_TARGET_COUNT.toLocaleString()}`
            );
        }

        const syncMetadata = getWriteSyncMetadata();
        const dayString = dayStringFromTimestamp(operationNow);
        const existing = deps.sessionRepo.getSessionForDay(
            practiceId,
            dayString
        );

        if (existing) {
            deps.sessionRepo.updateSessionCount(
                existing.id,
                existing.count + count,
                syncMetadata
            );
        } else {
            const deleted = deps.sessionRepo.getDeletedSessionForDay(
                practiceId,
                dayString
            );

            if (deleted) {
                deps.sessionRepo.reviveSession(
                    deleted.id,
                    count,
                    syncMetadata
                );
            } else {
                const id = deps.randomUUID();

                deps.sessionRepo.insertSession(
                    id,
                    practiceId,
                    count,
                    operationNow,
                    syncMetadata
                );
            }
        }

        deps.emitDataChanged?.();
        refreshReminderForPractice(practiceId);
        void deps.requestSync?.(syncMetadata.userId);
    }

    function adjustDayTotal(
        practiceId: string,
        date: string,
        newTotal: number
    ) {
        const syncMetadata = getWriteSyncMetadata();
        const existing = deps.sessionRepo.getSessionForDay(
            practiceId,
            date
        );
        const oldTotal = existing?.count ?? 0;

        if (oldTotal === newTotal) return;

        if (existing) {
            deps.sessionRepo.updateSessionCount(
                existing.id,
                newTotal,
                syncMetadata
            );
        } else if (newTotal > 0) {
            deps.sessionRepo.insertSession(
                deps.randomUUID(),
                practiceId,
                newTotal,
                new Date(date + "T00:00:00Z").getTime(),
                syncMetadata
            );
        }

        const total = deps.sessionRepo.getPracticeTotal(practiceId).total;

        if (total === 0) {
            const practice = deps.practiceRepo.getPracticeById(practiceId);
            const offset = practice?.totalOffset ?? 0;

            if (offset !== 0) {
                deps.practiceRepo.updatePracticeTotalOffset(
                    practiceId,
                    0,
                    syncMetadata
                );
            }
        }

        deps.emitDataChanged?.();
        refreshReminderForPractice(practiceId);
        void deps.requestSync?.(syncMetadata.userId);
    }

    function updatePracticeDailyTargetCount(
        id: string,
        dailyTargetCount: number | null
    ) {
        const syncMetadata = getWriteSyncMetadata();

        deps.practiceRepo.updatePracticeDailyTargetCount(
            id,
            dailyTargetCount,
            syncMetadata
        );

        deps.emitDataChanged?.();
        refreshReminderForPractice(id);
        void deps.requestSync?.(syncMetadata.userId);
    }

    function updatePracticeDefaultSessionCount(
        id: string,
        defaultSessionCount: number
    ) {
        const syncMetadata = getWriteSyncMetadata();

        deps.practiceRepo.updatePracticeDefaultSessionCount(
            id,
            defaultSessionCount,
            syncMetadata
        );

        deps.emitDataChanged?.();
        refreshReminderForPractice(id);
        void deps.requestSync?.(syncMetadata.userId);
    }

    function getSessionsForPractice(practiceId: string) {
        return deps.sessionRepo.getSessionsByPractice(practiceId);
    }

    function getDailyPracticeData(practiceId: string, days: number) {
        const rows = deps.sessionRepo.getDailyTotals(practiceId);
        const today = new Date(now());
        const result: { date: string; total: number }[] = [];

        for (let i = days - 1; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(today.getDate() - i);

            const dayString = dayStringFromTimestamp(date.getTime());
            const match = rows.find((row) => row.day === dayString);

            result.push({
                date: dayString,
                total: match?.total ?? 0,
            });
        }

        return result;
    }

    function getCalendarDailyData(practiceId: string) {
        return deps.sessionRepo.getDailyTotals(practiceId).map(row => ({
            date: row.day,
            count: row.total,
        }));
    }

    function getPracticeTotal(practiceId: string) {
        return deps.sessionRepo.getPracticeTotal(practiceId);
    }

    function getPracticeLifetimeStats(practiceId: string) {
        return deps.sessionRepo.getPracticeLifetimeStats(practiceId);
    }

    async function restoreDefaults() {
        const userId = deps.getCurrentUserId();

        await deps.enqueueWrite(() => {
            deps.transaction(() => {
                const restoredAt = now();
                const sessions = deps.sessionRepo.getAllSessionsForSync();

                for (const session of sessions) {
                    const deletionUserId = session.userId ?? userId;

                    if (!deletionUserId) continue;

                    deps.deletedRecordRepo.insertDeletedRecord(
                        deps.randomUUID(),
                        "session",
                        session.id,
                        deletionUserId,
                        restoredAt,
                        "pending",
                        JSON.stringify({
                            practiceId: session.practiceId,
                            createdAt: session.createdAt,
                        })
                    );
                }

                deps.sessionRepo.softDeleteAllSessions(userId, restoredAt);
                deps.sessionRepo.deleteAllSessions();

                const practices = deps.practiceRepo.getAllPractices();

                for (const practice of practices) {
                    const isSeeded = SEEDED_IDS.has(practice.id);

                    if (!isSeeded) {
                        const deletionUserId = practice.userId ?? userId;

                        if (deletionUserId) {
                            deps.deletedRecordRepo.insertDeletedRecord(
                                deps.randomUUID(),
                                "practice",
                                practice.id,
                                deletionUserId,
                                restoredAt,
                                "pending",
                                JSON.stringify({
                                    name: practice.name,
                                    targetCount: practice.targetCount,
                                    orderIndex: practice.orderIndex,
                                    imageKey: practice.imageKey ?? null,
                                    dailyTargetCount:
                                        practice.dailyTargetCount ?? null,
                                    defaultSessionCount:
                                        practice.defaultSessionCount ?? 108,
                                    totalOffset: practice.totalOffset ?? 0,
                                })
                            );
                        }

                        deps.practiceRepo.deletePractice(practice.id);
                        continue;
                    }

                    const defaultPractice =
                        DEFAULT_PRACTICES.find(
                            (row) => row.id === practice.id
                        );

                    if (!defaultPractice) continue;

                    const syncMetadata: SyncMetadata = {
                        userId,
                        updatedAt: restoredAt,
                        syncStatus: "pending",
                        lastSyncedAt: null,
                    };

                    deps.practiceRepo.updatePractice(
                        practice.id,
                        defaultPractice.name,
                        defaultPractice.targetCount,
                        syncMetadata
                    );

                    deps.practiceRepo.updatePracticeDailyTargetCount(
                        practice.id,
                        defaultPractice.dailyTargetCount ?? null,
                        syncMetadata
                    );
                    deps.practiceRepo.updatePracticeDefaultSessionCount(
                        practice.id,
                        defaultPractice.defaultSessionCount ?? 108,
                        syncMetadata
                    );
                }

                for (const defaultPractice of DEFAULT_PRACTICES) {
                    const existingPractice =
                        deps.practiceRepo.getPracticeById(
                            defaultPractice.id
                        );

                    if (existingPractice) continue;

                    deps.practiceRepo.insertPractice(
                        defaultPractice.id,
                        defaultPractice.name,
                        defaultPractice.targetCount,
                        defaultPractice.orderIndex,
                        getWriteSyncMetadata(),
                        defaultPractice.imageKey ?? null,
                        defaultPractice.dailyTargetCount ?? null,
                        defaultPractice.defaultSessionCount ?? 108,
                        0
                    );
                }

                deps.practiceRepo.resetPracticeTotals(userId, restoredAt);

                if (userId) {
                    deps.deletedRecordRepo.deleteAllDeletedRecords();
                    deps.appMetaRepo.setMeta(
                        "pendingBackupRestore",
                        "true"
                    );
                    deps.appMetaRepo.setMeta(
                        "pendingBackupRestoreUserId",
                        userId
                    );
                }

                deps.appMetaRepo.setMeta(
                    "lastRestoreDate",
                    new Date(now()).toISOString()
                );
            });
        });

        deps.emitDataChanged?.();
        refreshAllReminders();

        if (userId) {
            await deps.requestSync?.(userId);
        }
    }

    function getBackupData() {
        return {
            app: BACKUP_APP_ID,
            exportedAt: now(),
            practices: deps.practiceRepo.getAllPractices(),
            sessions: deps.sessionRepo.getAllSessionsForSync(),
        };
    }

    async function restoreBackupData(data: any) {
        const backupPractices = Array.isArray(data?.practices)
            ? data.practices
            : [];
        const sessions = Array.isArray(data?.sessions)
            ? data.sessions
            : [];
        const syncMetadata = getBackupSyncMetadata();

        await deps.enqueueWrite(() => {
            deps.transaction(() => {
                deps.sessionRepo.deleteAllSessions();
                deps.practiceRepo.deleteAllPractices();
                deps.deletedRecordRepo.deleteAllDeletedRecords();

                backupPractices.forEach((practice: any) => {
                    deps.practiceRepo.insertPractice(
                        practice.id,
                        practice.name,
                        practice.targetCount,
                        practice.orderIndex,
                        syncMetadata,
                        practice.imageKey ?? null,
                        practice.dailyTargetCount ?? null,
                        practice.defaultSessionCount ??
                            practice.defaultAddCount ??
                            108,
                        practice.totalOffset ?? 0
                    );
                });

                sessions.forEach((session: any) => {
                    const id =
                        session.id ??
                        `${session.practiceId}-${session.createdAt}`;

                    deps.sessionRepo.insertSession(
                        id,
                        session.practiceId,
                        session.count,
                        session.createdAt,
                        syncMetadata
                    );
                });

                deps.appMetaRepo.setMeta(
                    "pendingBackupRestore",
                    "true"
                );

                if (syncMetadata.userId) {
                    deps.appMetaRepo.setMeta(
                        "pendingBackupRestoreUserId",
                        syncMetadata.userId
                    );
                } else {
                    deps.appMetaRepo.deleteMeta(
                        "pendingBackupRestoreUserId"
                    );
                }
            });
        });

        deps.emitDataChanged?.();
        refreshAllReminders();
    }

    return {
        addSession,
        adjustDayTotal,
        createPractice,
        createSeedPractice,
        deletePractice,
        getAllPractices,
        getBackupData,
        getCalendarDailyData,
        getDailyPracticeData,
        getDailyPracticeDataWithAdjustments: getDailyPracticeData,
        getPractice,
        getPracticeEditData,
        getPracticeLifetimeStats,
        getPracticeName,
        getPracticeTotal,
        getSessionsForPractice,
        getWriteSyncMetadata,
        restoreBackupData,
        restoreDefaults,
        reorderPractices,
        updatePractice,
        updatePracticeDailyTargetCount,
        updatePracticeDefaultSessionCount,
    };
}
