import { db } from "../database/db";
import { createSessionRepo } from "./sessionRepoFactory";
export {
    createSessionRepo,
    type SessionRepository,
    type SessionRow,
} from "./sessionRepoFactory";

const defaultRepo = createSessionRepo(db);

export const {
    backfillLegacySessionsForUser,
    claimAnonymousSessions,
    deleteAllSessions,
    deleteSessionById,
    deleteSessionsByPractice,
    getAllSessionsForSync,
    getDailyTotals,
    getDeletedSessionForDay,
    getDirtySessions,
    getEarliestSessionDateForPractice,
    getPracticeAverageSessionSize,
    getPracticeLifetimeStats,
    getPracticeTotal,
    getSessionDays,
    getSessionForDay,
    getSessionsByPractice,
    getSessionsByPracticeForSync,
    getSessionsForBackup,
    insertSession,
    markAllSessionsPending,
    markSessionSynced,
    reassignAllSessionsToUser,
    resetAllSyncState,
    reviveSession,
    softDeleteAllSessions,
    updateSessionCount,
    upsertSessionFromRemote,
} = defaultRepo;
