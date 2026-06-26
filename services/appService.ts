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
    const seed = require("../database/seed");

    database.initializeDatabase();
    networkService.initializeNetworkListener();
    syncService.initializeSyncRetry();
    ensureInstallDate();
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

    practiceReminderRefreshService.queueRefreshAllPracticeReminders();
}

export async function restoreDefaults() {
    await getAppOperationEngine().restoreDefaults();
}

export function getCalendarStartDate(
    practiceId: string
): Date {
    const appMetaRepo = require("../repositories/appMetaRepo");
    const sessionRepo = require("../repositories/sessionRepo");

    const install = appMetaRepo.getMeta("installDate");
    const restore = appMetaRepo.getMeta("lastRestoreDate");
    const earliestSession =
        sessionRepo.getEarliestSessionDateForPractice(practiceId);
    const candidates: number[] = [];

    if (install) {
        candidates.push(new Date(install).getTime());
    }

    if (restore) {
        candidates.push(new Date(restore).getTime());
    }

    if (earliestSession != null) {
        candidates.push(earliestSession);
    }

    if (candidates.length === 0) {
        return new Date();
    }

    return new Date(
        Math.min(...candidates)
    );
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
