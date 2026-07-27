import { getAppOperationEngine } from "./appOperationRuntime";
import * as practiceReminderRefreshService from "./practiceReminderRefreshService";

const INACTIVE_THRESHOLD = 10 * 60 * 1000; //10 minutes
const RESUME_SESSION_TIMEOUT = 5000;

declare const require: {
    (path: string): any;
};

let backgroundedAt: number | null = null;
let initialized = false;
let lastState = "unknown";

function withResumeTimeout<T>(
    promise: Promise<T>,
    ms: number
): Promise<T> {
    return Promise.race([
        promise,
        new Promise<T>((_, reject) => {
            setTimeout(
                () => reject(new Error("Resume session timeout")),
                ms
            );
        }),
    ]);
}

export async function initializeApp() {
    const database = require("../database/db");
    const networkService = require("./networkService");
    const syncService = require("./syncService");
    const authService = require("../services/authService");
    const appMetaRepo = require("../repositories/appMetaRepo");
    const practiceRepo = require("../repositories/practiceRepo");
    const seed = require("../database/seed");

    database.initializeDatabase();
    networkService.initializeNetworkListener();
    syncService.initializeSyncRetry();
    ensureInstallDate();
    practiceRepo.backfillMissingCalendarStartDates(
        getLegacyCalendarStartDateFallback()
    );
    await authService.initializeAuth();

    const existing = database.db.getAllSync(
        `SELECT COUNT(*) as count FROM practices`
    ) as { count: number }[];

    const authState = authService.getAuthState();
    const hasLocalOwner = !!appMetaRepo.getLocalDataOwnerUserId();

    if (
        existing[0].count === 0 &&
        !authState.isAuthenticated &&
        !hasLocalOwner
    ) {
        seed.seedPractices();
    }

    await practiceReminderRefreshService
        .migrateStoredPracticeReminderSettingsToDatabase();
    practiceReminderRefreshService.queueRefreshAllPracticeReminders();
}

export async function restoreDefaults() {
    await getAppOperationEngine().restoreDefaults();
}

export function getCalendarStartDate(
    practiceId: string
): Date {
    const appMetaRepo = require("../repositories/appMetaRepo");
    const practiceRepo = require("../repositories/practiceRepo");
    const sessionRepo = require("../repositories/sessionRepo");

    const practice = practiceRepo.getPracticeById(practiceId);
    if (
        practice?.calendarStartDate != null &&
        Number.isFinite(practice.calendarStartDate)
    ) {
        return new Date(practice.calendarStartDate);
    }

    const install = appMetaRepo.getMeta("installDate");
    const restore = appMetaRepo.getMeta("lastRestoreDate");
    const earliestSession =
        sessionRepo.getEarliestSessionDateForPractice(practiceId);

    if (earliestSession != null) {
        return new Date(earliestSession);
    }

    const fallbackDates = [install, restore]
        .filter((value): value is string => value != null)
        .map(value => new Date(value).getTime())
        .filter(Number.isFinite);

    return fallbackDates.length > 0
        ? new Date(Math.max(...fallbackDates))
        : new Date();
}

function getLegacyCalendarStartDateFallback() {
    const appMetaRepo = require("../repositories/appMetaRepo");
    const install = appMetaRepo.getMeta("installDate");
    const restore = appMetaRepo.getMeta("lastRestoreDate");
    const candidates = [install, restore]
        .filter((value): value is string => value != null)
        .map(value => new Date(value).getTime())
        .filter(Number.isFinite);

    return candidates.length > 0
        ? Math.max(...candidates)
        : Date.now();
}

export function ensureInstallDate() {
  const appMetaRepo = require("../repositories/appMetaRepo");
  const existing = appMetaRepo.getMeta("installDate");

  if (!existing) {
    appMetaRepo.setMeta(
      "installDate",
      new Date().toISOString()
    );
  }
}

export async function handleAppResume() {
    const supabase = require("../lib/supabase");
    const syncService = require("./syncService");
    const authService = require("../services/authService");

    console.log("entering handle app resume");

    const inactiveMs =
        backgroundedAt == null
            ? 0
            : Date.now() - backgroundedAt;

    backgroundedAt = null;

    console.log(inactiveMs);

    practiceReminderRefreshService.queueRefreshAllPracticeReminders();

    if (inactiveMs < INACTIVE_THRESHOLD) {
        return;
    }

    supabase.markSupabaseClientStaleAfterBackground();

    const userId = authService.getCurrentUserId();
    console.log(userId);

    try {
        console.log(
            "Resume: rebuilding Supabase client"
        );

        await supabase.recreateSupabase();
        syncService.resetStaleSyncStateAfterResume();

        await new Promise((resolve) => setTimeout(resolve, 300));

        try {
            await withResumeTimeout(
                supabase.getSupabase().auth.getSession(),
                RESUME_SESSION_TIMEOUT
            );
        } catch (sessionError) {
            console.warn(
                "Resume session refresh failed",
                sessionError
            );
        }

        if (!userId) return;

        await syncService.requestSync(userId, {
            immediate: true
        });
    } catch (e) {
        console.warn(
            "Resume recovery failed",
            e
        );
    }
}

export function initAppStateListener(onResume: () => void) {
    if (initialized) return;

    const { AppState } = require("react-native");

    initialized = true;
    lastState = AppState.currentState;

    AppState.addEventListener("change", (nextState: string) => {
        console.log("AppState:", lastState, "->", nextState);

        if (nextState.match(/inactive|background/)) {
            console.log("inactive");
            backgroundedAt = backgroundedAt ?? Date.now();
        }

        if (lastState.match(/inactive|background/) && nextState === "active") {
            console.log("active");
            onResume();
        }

        lastState = nextState;
    });
}
