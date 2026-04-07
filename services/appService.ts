import { enqueueWrite } from "@/database/writeQueue";
import { db, initializeDatabase } from "../database/db";
import { seedPractices } from "../database/seed";
import * as appMetaRepo from "../repositories/appMetaRepo";
import * as deletedRecordRepo from "../repositories/deletedRecordRepo";
import * as practiceRepo from "../repositories/practiceRepo";
import * as sessionRepo from "../repositories/sessionRepo";
import * as authService from "../services/authService";
import * as syncService from "../services/syncService";
import { emitDataChanged } from "../utils/events";
import { initializeNetworkListener } from "./networkService";
import { initializeSyncRetry } from "./syncService";

export async function initializeApp() {
    initializeDatabase();
    initializeNetworkListener();
    initializeSyncRetry();
    ensureInstallDate();

    const existing = db.getAllSync(
        `SELECT COUNT(*) as count FROM practices`
    ) as { count: number }[];

    if (existing[0].count === 0) {
        seedPractices();
    }

    await authService.initializeAuth();
}

export async function restoreDefaults() {

    const userId = authService.getCurrentUserId();

    await enqueueWrite(() => {

        db.execSync("BEGIN TRANSACTION");

        try {

            sessionRepo.deleteAllSessions();
            practiceRepo.deleteAllPractices();
            deletedRecordRepo.deleteAllDeletedRecords();

            seedPractices();

            appMetaRepo.setMeta(
                "lastRestoreDate",
                new Date().toISOString()
            );

            db.execSync("COMMIT");

        } catch (error) {

            db.execSync("ROLLBACK");
            throw error;

        }

    });

    emitDataChanged();

    if (userId) {
        await syncService.wipeRemoteUserData(userId);
        await syncService.syncNow(userId);
    }
}

export function getCalendarStartDate(): Date {

  const restore =
    appMetaRepo.getMeta("lastRestoreDate");

  const install =
    appMetaRepo.getMeta("installDate");

  const date =
    restore ?? install ?? new Date().toISOString();

  return new Date(date);
}

export function ensureInstallDate() {

  const existing =
    appMetaRepo.getMeta("installDate");

  if (!existing) {

    appMetaRepo.setMeta(
      "installDate",
      new Date().toISOString()
    );
  }
}