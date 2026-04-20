import { DEFAULT_PRACTICES, SEEDED_IDS } from "@/constants/defaultPractices";
import { enqueueWrite } from "@/database/writeQueue";
import { randomUUID } from "expo-crypto";
import { AppState } from "react-native";
import { db, initializeDatabase } from "../database/db";
import { seedPractices } from "../database/seed";
import * as appMetaRepo from "../repositories/appMetaRepo";
import * as deletedRecordRepo from "../repositories/deletedRecordRepo";
import * as practiceRepo from "../repositories/practiceRepo";
import * as sessionRepo from "../repositories/sessionRepo";
import * as authService from "../services/authService";
import * as practiceService from "../services/practiceService";
import * as syncService from "../services/syncService";
import { emitDataChanged } from "../utils/events";
import { initializeNetworkListener } from "./networkService";
import { initializeSyncRetry } from "./syncService";

const INACTIVE_THRESHOLD = 60 * 60 * 1000; //1 hour

let lastActiveAt: number = Date.now();

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

          const now = Date.now();

          const sessions = sessionRepo.getAllSessionsForSync();

          for (const s of sessions) {
              deletedRecordRepo.insertDeletedRecord(
                  randomUUID(),
                  "session",
                  s.id,
                  userId,
                  now,
                  "pending",
                  JSON.stringify({
                      practiceId: s.practiceId,
                      createdAt: s.createdAt,
                  })
              );
          }

          sessionRepo.softDeleteAllSessions(userId, now);
          sessionRepo.deleteAllSessions();

          const practices = practiceRepo.getAllPractices();

          for (const p of practices) {
              const isSeeded = SEEDED_IDS.has(p.id);

              if (!isSeeded) {
                  // -------------------------
                  // DELETE USER PRACTICES
                  // -------------------------
                  deletedRecordRepo.insertDeletedRecord(
                      randomUUID(),
                      "practice",
                      p.id,
                      userId,
                      now,
                      "pending",
                      JSON.stringify({
                          name: p.name,
                          targetCount: p.targetCount,
                          orderIndex: p.orderIndex,
                          imageKey: p.imageKey ?? null,
                          defaultAddCount: p.defaultAddCount ?? 108
                      })
                  );

                  practiceRepo.deletePractice(p.id);
              } else {
                  // -------------------------
                  // RESET SEEDED PRACTICES
                  // -------------------------
                  const defaultPractice =
                      DEFAULT_PRACTICES.find(d => d.id === p.id);

                  if (defaultPractice) {
                      practiceRepo.updatePractice(
                          p.id,
                          defaultPractice.name,
                          defaultPractice.targetCount,
                          {
                              userId,
                              updatedAt: now,
                              syncStatus: "pending",
                              lastSyncedAt: null
                          }
                      );

                      practiceRepo.updatePracticeDefaultAddCount(
                          p.id,
                          defaultPractice.defaultAddCount ?? 108,
                          {
                              userId,
                              updatedAt: now,
                              syncStatus: "pending",
                              lastSyncedAt: null
                          }
                      );
                  }
              }
          }

          for (const defaultPractice of DEFAULT_PRACTICES) {
              const existingPractice =
                  practiceRepo.getPracticeById(defaultPractice.id);

              if (!existingPractice) {
                  practiceRepo.insertPractice(
                      defaultPractice.id,
                      defaultPractice.name,
                      defaultPractice.targetCount,
                      defaultPractice.orderIndex,
                      practiceService.getWriteSyncMetadata(),
                      defaultPractice.imageKey ?? null,
                      defaultPractice.defaultAddCount ?? 108,
                      0
                  );
              }
          }

          practiceRepo.resetPracticeTotals(userId, now);

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
      await syncService.requestSync(userId);
    }
}

export function getCalendarStartDate(): Date {

  const restore =
    appMetaRepo.getMeta("lastRestoreDate");

  const install =
    appMetaRepo.getMeta("installDate");

  const date =
    restore ?? install ?? new Date().toISOString();

  // return new Date(date);
  return new Date(new Date().getTime());
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

export async function handleAppResume() {
    if (!authService.getCurrentUserId()) return;

    if (shouldForceSync(INACTIVE_THRESHOLD)) {
        try {
            await syncService.syncNow(authService.getCurrentUserId());
        } catch (e) {
            console.warn("Auto-sync failed", e);
        }
    }

    markActive();
}

export function markActive() {
    lastActiveAt = Date.now();
}

export function shouldForceSync(thresholdMs: number) {
    return Date.now() - lastActiveAt > thresholdMs;
}

let initialized = false;
let lastState = AppState.currentState;

export function initAppStateListener(onResume: () => void) {
    if (initialized) return;

    initialized = true;

    AppState.addEventListener("change", (nextState) => {
        console.log("AppState:", lastState, "→", nextState);

        if (
            lastState.match(/inactive|background/) &&
            nextState === "active"
        ) {
            console.log("App resumed 🔥");
            onResume();
        }

        lastState = nextState;
    });
}