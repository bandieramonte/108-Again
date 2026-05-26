import { db } from "@/database/db";
import { enqueueWrite } from "@/database/writeQueue";
import * as appMetaRepo from "@/repositories/appMetaRepo";
import * as deletedRecordRepo from "@/repositories/deletedRecordRepo";
import * as practiceRepo from "@/repositories/practiceRepo";
import * as sessionRepo from "@/repositories/sessionRepo";
import * as authService from "@/services/authService";
import * as syncService from "@/services/syncService";
import { emitDataChanged } from "@/utils/events";
import { randomUUID } from "expo-crypto";
import { createAppOperationEngine } from "./appOperationEngine";

export function createConcreteAppOperationEngine() {
    return createAppOperationEngine({
        appMetaRepo,
        deletedRecordRepo,
        emitDataChanged,
        enqueueWrite,
        getCurrentUserId: authService.getCurrentUserId,
        practiceRepo,
        randomUUID,
        requestSync: syncService.requestSync,
        sessionRepo,
        transaction(fn) {
            db.execSync("BEGIN TRANSACTION");

            try {
                fn();
                db.execSync("COMMIT");
            } catch (error) {
                db.execSync("ROLLBACK");
                throw error;
            }
        },
    });
}
