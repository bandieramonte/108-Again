import { db } from "@/database/db";
import { createDeletedRecordRepo } from "./deletedRecordRepoFactory";

export {
    createDeletedRecordRepo,
    type DeletedRecordRepository,
    type DeletedRecordRow,
} from "./deletedRecordRepoFactory";

const defaultRepo = createDeletedRecordRepo(db);

export const {
    claimAnonymousDeletedRecords,
    clearAllPendingDeletions,
    deleteAllDeletedRecords,
    deleteDeletedRecord,
    getAllDeletedRecords,
    getPendingDeletedRecordForRecord,
    getPendingDeletedRecords,
    insertDeletedRecord,
    markDeletedRecordSynced,
} = defaultRepo;
