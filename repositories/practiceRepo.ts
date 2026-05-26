import { db } from "../database/db";
import { createPracticeRepo } from "./practiceRepoFactory";
export {
    createPracticeRepo,
    type PracticeRepository,
    type PracticeRow,
} from "./practiceRepoFactory";

const defaultRepo = createPracticeRepo(db);

export const {
    claimAnonymousPractices,
    deleteAllPractices,
    deletePractice,
    getAllPractices,
    getDirtyPractices,
    getMaxOrderIndex,
    getPracticeById,
    getPracticeName,
    insertPractice,
    markAllPracticesPending,
    markPracticeSynced,
    reassignAllPracticesToUser,
    resetAllSyncState,
    resetPracticeTotals,
    updatePractice,
    updatePracticeDefaultAddCount,
    updatePracticeOrder,
    updatePracticeTotalOffset,
    upsertPracticeFromRemote,
} = defaultRepo;
