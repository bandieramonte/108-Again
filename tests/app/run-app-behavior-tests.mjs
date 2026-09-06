import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const Module = require("node:module");
const BetterSqlite3 = require("better-sqlite3");

function createMemoryStorage() {
  const store = new Map();

  return {
    async getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    async getAllKeys() {
      return [...store.keys()];
    },
    async multiGet(keys) {
      return keys.map((key) => [
        key,
        store.has(key) ? store.get(key) : null,
      ]);
    },
    async multiRemove(keys) {
      for (const key of keys) {
        store.delete(key);
      }
    },
    async removeItem(key) {
      store.delete(key);
    },
    async setItem(key, value) {
      store.set(key, value);
    },
  };
}

function clearRequireCache(modulePath) {
  try {
    delete require.cache[require.resolve(modulePath)];
  } catch {
    // The module may not have been compiled into this focused test bundle.
  }
}

async function withBackupServiceHarness(device, storage, fn) {
  const backupServicePath = require.resolve(
    "../.build/services/backupService.js"
  );
  const appOperationRuntimePath = require.resolve(
    "../.build/services/appOperationRuntime.js"
  );
  let refreshAllReminderCalls = 0;

  clearRequireCache("../.build/services/backupService.js");
  clearRequireCache("../.build/services/appOperationRuntime.js");
  clearRequireCache("../.build/services/practiceReminderService.js");

  Module._load = function loadWithBackupServiceHarness(
    request,
    parent,
    isMain
  ) {
    if (
      parent?.filename === backupServicePath &&
      request === "./appOperationRuntime"
    ) {
      return {
        getAppOperationEngine: () => device.operations,
      };
    }

    if (
      parent?.filename === backupServicePath &&
      request === "./practiceReminderRefreshService"
    ) {
      return {
        queueRefreshAllPracticeReminders: () => {
          refreshAllReminderCalls += 1;
        },
      };
    }

    if (request === appOperationRuntimePath) {
      return {
        getAppOperationEngine: () => device.operations,
      };
    }

    if (request === "@react-native-async-storage/async-storage") {
      return { default: storage };
    }

    if (request === "expo-notifications") {
      return {
        AndroidImportance: { DEFAULT: "default" },
        AndroidNotificationPriority: { DEFAULT: "default" },
        SchedulableTriggerInputTypes: { DATE: "date" },
        addNotificationResponseReceivedListener: () => ({
          remove: () => {},
        }),
        cancelScheduledNotificationAsync: async () => {},
        clearLastNotificationResponse: () => {},
        getLastNotificationResponse: () => null,
        getPermissionsAsync: async () => ({ status: "granted" }),
        requestPermissionsAsync: async () => ({ status: "granted" }),
        scheduleNotificationAsync: async ({ identifier }) => identifier,
        setNotificationChannelAsync: async () => {},
        setNotificationHandler: () => {},
      };
    }

    if (request === "react-native") {
      return {
        Platform: { OS: "android" },
      };
    }

    return originalLoad.call(this, request, parent, isMain);
  };

  try {
    const backupService =
      require("../.build/services/backupService.js");
    const practiceReminderService =
      require("../.build/services/practiceReminderService.js");

    return await fn(backupService, practiceReminderService, {
      get refreshAllReminderCalls() {
        return refreshAllReminderCalls;
      },
    });
  } finally {
    Module._load = originalLoad;
    clearRequireCache("../.build/services/backupService.js");
    clearRequireCache("../.build/services/appOperationRuntime.js");
    clearRequireCache("../.build/services/practiceReminderService.js");
  }
}

async function withPracticeReminderServiceHarness(fn) {
  const storage = createMemoryStorage();
  const state = {
    permissionCanAskAgain: true,
    permissionRequests: 0,
    permissionRequestStatus: "granted",
    permissionStatus: "undetermined",
    scheduledNotifications: 0,
  };

  clearRequireCache("../.build/services/practiceReminderService.js");

  Module._load = function loadWithPracticeReminderServiceHarness(
    request,
    parent,
    isMain
  ) {
    if (request === "@react-native-async-storage/async-storage") {
      return { default: storage };
    }

    if (request === "expo-notifications") {
      return {
        AndroidImportance: { DEFAULT: "default" },
        AndroidNotificationPriority: { DEFAULT: "default" },
        SchedulableTriggerInputTypes: { DATE: "date" },
        addNotificationResponseReceivedListener: () => ({
          remove: () => {},
        }),
        cancelScheduledNotificationAsync: async () => {},
        clearLastNotificationResponse: () => {},
        getLastNotificationResponse: () => null,
        getPermissionsAsync: async () => ({
          canAskAgain: state.permissionCanAskAgain,
          status: state.permissionStatus,
        }),
        requestPermissionsAsync: async () => {
          state.permissionRequests += 1;
          state.permissionStatus = state.permissionRequestStatus;
          return {
            canAskAgain: state.permissionCanAskAgain,
            status: state.permissionStatus,
          };
        },
        scheduleNotificationAsync: async ({ identifier }) => {
          state.scheduledNotifications += 1;
          return identifier;
        },
        setNotificationChannelAsync: async () => {},
        setNotificationHandler: () => {},
      };
    }

    if (request === "react-native") {
      return {
        Platform: { OS: "android", Version: 34 },
      };
    }

    return originalLoad.call(this, request, parent, isMain);
  };

  try {
    const practiceReminderService =
      require("../.build/services/practiceReminderService.js");

    return await fn(practiceReminderService, state);
  } finally {
    Module._load = originalLoad;
    clearRequireCache("../.build/services/practiceReminderService.js");
  }
}

const originalLoad = Module._load;
Module._load = function loadWithAsyncStorageMock(request, parent, isMain) {
  if (request === "@react-native-async-storage/async-storage") {
    return { default: createMemoryStorage() };
  }

  return originalLoad.call(this, request, parent, isMain);
};

const { initializeDatabaseSchema } =
  require("../.build/database/schema.js");
const { DEFAULT_PRACTICES } =
  require("../.build/constants/defaultPractices.js");
const {
  CUSTOM_PRACTICE_IMAGE_HEIGHT,
  CUSTOM_PRACTICE_IMAGE_KEY,
  CUSTOM_PRACTICE_IMAGE_WIDTH,
} = require("../.build/constants/customPracticeImages.js");
const { createAppMetaRepo } =
  require("../.build/repositories/appMetaRepoFactory.js");
const { createDeletedRecordRepo } =
  require("../.build/repositories/deletedRecordRepoFactory.js");
const { createPracticeRepo } =
  require("../.build/repositories/practiceRepoFactory.js");
const { createSessionRepo } =
  require("../.build/repositories/sessionRepoFactory.js");
const { createAppOperationEngine } =
  require("../.build/services/appOperationEngine.js");
const { createCustomPracticeImageSyncCore } =
  require("../.build/services/customPracticeImageSyncCore.js");
const { validateBackup } =
  require("../.build/services/backupService.js");
const { redirectSystemPath } =
  require("../.build/app/+native-intent.js");
const { establishPasswordRecoverySessionCore } =
  require("../.build/services/authAccountActions.js");
const { ONE_ACCOUNT_PER_DEVICE_MESSAGE } =
  require("../.build/services/authAccountGuard.js");
const { isUnrecoverableRefreshTokenError } =
  require("../.build/services/authSessionPolicy.js");
const { createAuthSessionEngine } =
  require("../.build/services/authSessionEngine.js");
const { getLocalizedAuthErrorMessage } =
  require("../.build/utils/authErrorText.js");
const { shouldShowHeaderBack } =
  require("../.build/utils/headerBackVisibility.js");
const { determineUpdateRequirement } =
  require("../.build/services/appUpdatePolicy.js");
const { initializeOfflineFirstStartup } =
  require("../.build/services/offlineFirstStartup.js");
const {
  createLastPracticeScreenService,
  shouldLeaveMissingPracticeScreen,
} =
  require("../.build/services/lastPracticeScreenService.js");
const { pullToSync } =
  require("../.build/services/pullToSyncService.js");
const { createSyncCoordinator } =
  require("../.build/services/syncCoordinator.js");
const { createSyncEngine } =
  require("../.build/services/syncEngine.js");
const { createSupabaseSyncRemote } =
  require("../.build/services/supabaseSyncRemote.js");
const { detectSupportedLanguageFromLocale } =
  require("../.build/i18n/languageDetection.js");
const { resolveInitialLanguagePreference } =
  require("../.build/i18n/languagePreference.js");
const { formatMonthDayYear } =
  require("../.build/utils/dateUtils.js");
const {
  buildCalendarMonthDays,
  clampCalendarMonthIndex,
  formatCalendarDate,
  getCalendarDateFromString,
  getCalendarLoadedMonthIndexes,
  getCalendarMonthIndex,
  getCalendarPagerMonthIndexes,
  isPracticeCalendarDateEditable,
} =
  require("../.build/utils/calendarMonth.js");
const { shouldDismissSheetFromDrag } =
  require("../.build/utils/sheetDismissGesture.js");
const {
  formatCountProgress,
  formatNumberInput,
  parseFormattedNumberInput,
} =
  require("../.build/utils/numberUtils.js");
const { getPracticeReminderSettingsFromPractice } =
  require("../.build/utils/practiceReminderState.js");
const {
  buildReminderTimeOptions,
  formatReminderTimeForLocale,
  roundToNearestHalfHour,
  roundUpToNextHalfHour,
} =
  require("../.build/utils/reminderTime.js");
const {
  buildVerificationUrl,
  getAuthEmailLanguage,
  renderAuthEmail,
} =
  require("../.build/supabase/functions/send-auth-email/renderAuthEmail.js");

Module._load = originalLoad;

function normalizeParams(params) {
  if (params.length === 1 && Array.isArray(params[0])) return params[0];
  return params;
}

const openTestDatabases = new Set();

function closeAllTestDatabases() {
  for (const raw of openTestDatabases) {
    if (raw.open) raw.close();
  }

  openTestDatabases.clear();
}

function createBetterSqliteDatabase() {
  const raw = new BetterSqlite3(":memory:");
  openTestDatabases.add(raw);

  return {
    execSync(sql) {
      raw.exec(sql);
    },
    getAllSync(sql, ...params) {
      return raw.prepare(sql).all(...normalizeParams(params));
    },
    getFirstSync(sql, ...params) {
      return raw.prepare(sql).get(...normalizeParams(params));
    },
    runSync(sql, ...params) {
      return raw.prepare(sql).run(...normalizeParams(params));
    },
  };
}

function makeLocalDevice(currentUserId = null, now = () => Date.now()) {
  const database = createBetterSqliteDatabase();
  initializeDatabaseSchema(database);

  const appMetaRepo = createAppMetaRepo(database);
  const deletedRecordRepo = createDeletedRecordRepo(database);
  const practiceRepo = createPracticeRepo(database);
  const sessionRepo = createSessionRepo(database);
  const getCurrentUserId =
    typeof currentUserId === "function"
      ? currentUserId
      : () => currentUserId;

  const operations = createAppOperationEngine({
    appMetaRepo,
    deletedRecordRepo,
    emitDataChanged: () => {},
    enqueueWrite: async (fn) => {
      await fn();
    },
    getCurrentUserId,
    now,
    practiceRepo,
    randomUUID,
    requestSync: () => {},
    sessionRepo,
    transaction: (fn) => {
      database.execSync("BEGIN TRANSACTION");

      try {
        fn();
        database.execSync("COMMIT");
      } catch (error) {
        database.execSync("ROLLBACK");
        throw error;
      }
    },
  });

  return {
    appMetaRepo,
    deletedRecordRepo,
    operations,
    practiceExists: (practiceId) =>
      !!practiceRepo.getPracticeById(practiceId),
    practiceRepo,
    sessionRepo,
  };
}

function cloneRow(row) {
  return { ...row };
}

function createMemorySyncRemote() {
  const practices = new Map();
  const sessions = new Map();

  function getUserRows(store, userId) {
    return Array.from(store.values())
      .filter((row) => row.user_id === userId)
      .map(cloneRow);
  }

  function getRowsById(store, userId, ids) {
    const rows = new Map();

    for (const id of ids) {
      const row = store.get(id);

      if (row?.user_id === userId) {
        rows.set(id, cloneRow(row));
      }
    }

    return rows;
  }

  function softDeleteStore(store, userId, deletedAt) {
    const deletedAtIso = new Date(deletedAt).toISOString();

    for (const [id, row] of store) {
      if (row.user_id !== userId) continue;

      store.set(id, {
        ...row,
        updated_at: deletedAtIso,
        deleted_at: deletedAtIso,
      });
    }
  }

  return {
    getPractice: (id) => {
      const row = practices.get(id);
      return row ? cloneRow(row) : null;
    },
    async getPracticesById(userId, ids) {
      return getRowsById(practices, userId, ids);
    },
    async getSessionsById(userId, ids) {
      return getRowsById(sessions, userId, ids);
    },
    async pullPractices(userId) {
      return getUserRows(practices, userId);
    },
    async pullSessions(userId) {
      return getUserRows(sessions, userId);
    },
    async softDeleteUserData(userId, deletedAt) {
      softDeleteStore(practices, userId, deletedAt);
      softDeleteStore(sessions, userId, deletedAt);
    },
    async upsertPractices(rows) {
      for (const row of rows) {
        practices.set(row.id, cloneRow(row));
      }
    },
    async upsertSessions(rows) {
      for (const row of rows) {
        sessions.set(row.id, cloneRow(row));
      }
    },
  };
}

function createSyncEngineForDevice(
  device,
  remote,
  now = () => Date.now(),
  customImageSync
) {
  return createSyncEngine({
    appMetaRepo: device.appMetaRepo,
    deletedRecordRepo: device.deletedRecordRepo,
    logger: {
      error: () => {},
      log: () => {},
      warn: () => {},
    },
    now,
    practiceRepo: device.practiceRepo,
    remote,
    sessionRepo: device.sessionRepo,
    customImageSync,
  });
}

let testIndex = 0;

async function test(name, fn) {
  try {
    await fn();
  } finally {
    closeAllTestDatabases();
  }

  testIndex += 1;
  console.log(`ok ${testIndex} - ${name}`);
}

async function waitFor(predicate, message) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  assert.fail(message);
}

function createSyncCoordinatorHarness() {
  const database = createBetterSqliteDatabase();
  initializeDatabaseSchema(database);
  const appMetaRepo = createAppMetaRepo(database);
  const deletedRecordRepo = createDeletedRecordRepo(database);
  const practiceRepo = createPracticeRepo(database);
  const sessionRepo = createSessionRepo(database);
  const remote = createMemorySyncRemote();
  const state = {
    appAccessBlocked: false,
    authInvalidEvents: 0,
    createdEngines: 0,
    executedSyncs: [],
    currentSessionUserId: null,
    isOnline: true,
    remoteAccessChecks: 0,
    remoteAccessStatus: "allowed",
    remoteAuthoritativeUsers: [],
    scheduledTimers: new Map(),
    userDeleted: false,
  };
  let nextTimerId = 1;

  const coordinator = createSyncCoordinator({
    cancelTimer: (timerId) => {
      state.scheduledTimers.delete(timerId);
    },
    createSyncEngine: () => {
      state.createdEngines += 1;
      const engine = createSyncEngine({
        appMetaRepo,
        deletedRecordRepo,
        logger: {
          error: () => {},
          log: () => {},
          warn: () => {},
        },
        practiceRepo,
        remote,
        sessionRepo,
      });

      return {
        executeSync: async (userId, mode) => {
          state.executedSyncs.push({ mode, userId });
          await engine.executeSync(userId, mode);
        },
        resolveSyncMode: engine.resolveSyncMode,
      };
    },
    emitAuthInvalid: () => {
      state.authInvalidEvents += 1;
    },
    emitDataChanged: () => {},
    emitSyncChanged: () => {},
    getCurrentSessionUserId: async () => state.currentSessionUserId,
    getIsOnline: () => state.isOnline,
    isAppAccessBlocked: () => state.appAccessBlocked,
    isNetworkTimeout: () => false,
    isUserDeleted: async () => state.userDeleted,
    logger: {
      error: () => {},
      log: () => {},
      warn: () => {},
    },
    markLocalDataOwnerIfSessionIsCurrent: async () => {},
    requireRemoteAuthoritativeSync: (userId) => {
      state.remoteAuthoritativeUsers.push(userId);
    },
    scheduleTimer: (callback) => {
      const timerId = nextTimerId;
      nextTimerId += 1;
      state.scheduledTimers.set(timerId, callback);
      return timerId;
    },
    validateSessionAfterMaxRetries: async () => {},
    verifyRemoteSyncAccess: async () => {
      state.remoteAccessChecks += 1;
      return state.remoteAccessStatus;
    },
  });

  function runNextTimer() {
    const next = state.scheduledTimers.entries().next().value;
    assert.ok(next, "Expected a scheduled sync timer");

    const [timerId, callback] = next;
    state.scheduledTimers.delete(timerId);
    callback();
  }

  return { coordinator, runNextTimer, state };
}

const basePolicy = {
  latestVersionCode: 30,
  minimumSupportedVersionCode: 25,
  maintenanceMode: false,
  message: null,
};

await test(
  "pull-to-sync reports each result and avoids unavailable sync attempts",
  async () => {
    const syncCalls = [];
    const errors = [];
    const deps = {
      getIsOnline: () => true,
      onError: (error) => errors.push(error),
      syncNow: async (userId) => {
        syncCalls.push(userId);
        return "success";
      },
    };

    assert.equal(await pullToSync("user-1", deps), "success");
    assert.deepEqual(syncCalls, ["user-1"]);

    assert.equal(
      await pullToSync("user-1", {
        ...deps,
        getIsOnline: () => false,
      }),
      "offline"
    );
    assert.deepEqual(
      syncCalls,
      ["user-1"],
      "Offline pulls must not start a remote sync"
    );

    assert.equal(await pullToSync(null, deps), "signed_out");
    assert.deepEqual(
      syncCalls,
      ["user-1"],
      "Signed-out pulls must not start a remote sync"
    );

    for (const result of [
      "policy_unavailable",
      "retry_scheduled",
      "update_required",
    ]) {
      assert.equal(
        await pullToSync("user-1", {
          ...deps,
          syncNow: async () => result,
        }),
        "postponed"
      );
    }

    for (const result of ["auth_invalid", "skipped"]) {
      assert.equal(
        await pullToSync("user-1", {
          ...deps,
          syncNow: async () => result,
        }),
        "failed"
      );
    }

    const failure = new Error("sync failed");
    assert.equal(
      await pullToSync("user-1", {
        ...deps,
        syncNow: async () => {
          throw failure;
        },
      }),
      "failed"
    );
    assert.deepEqual(errors, [failure]);
  }
);

await test(
  "reset password recovery links route to the reset screen and establish the recovery session",
  async () => {
    assert.equal(
      redirectSystemPath({
        path:
          "app108again://reset-password#access_token=access-token&refresh_token=refresh-token&type=recovery",
        initial: true,
      }),
      "/reset-password?access_token=access-token&refresh_token=refresh-token&type=recovery"
    );

    assert.equal(
      redirectSystemPath({
        path:
          "app108againdev://reset-password?access_token=dev-access&refresh_token=dev-refresh&type=recovery",
        initial: false,
      }),
      "/reset-password?access_token=dev-access&refresh_token=dev-refresh&type=recovery"
    );

    const sessionCalls = [];
    const recoveryFlowChanges = [];

    const result = await establishPasswordRecoverySessionCore(
      {
        setPasswordRecoveryFlow: (value) => {
          recoveryFlowChanges.push(value);
        },
        setSession: async (session) => {
          sessionCalls.push(session);
          return { error: null };
        },
      },
      {
        accessToken: "access-token",
        refreshToken: "refresh-token",
        type: "recovery",
      }
    );

    assert.deepEqual(result, { kind: "session_established" });
    assert.deepEqual(recoveryFlowChanges, [true]);
    assert.deepEqual(sessionCalls, [
      {
        access_token: "access-token",
        refresh_token: "refresh-token",
      },
    ]);

    await assert.rejects(
      () => establishPasswordRecoverySessionCore(
        {
          setPasswordRecoveryFlow: (value) => {
            recoveryFlowChanges.push(value);
          },
          setSession: async () => ({
            error: { message: "Invalid or expired password reset link." },
          }),
        },
        {
          accessToken: "bad-access-token",
          refreshToken: "bad-refresh-token",
          type: "recovery",
        }
      ),
      /Invalid or expired password reset link/
    );
    assert.deepEqual(recoveryFlowChanges, [true, true, false]);
  }
);

await test(
  "known auth errors use localized app messages",
  () => {
    const t = (key, params) =>
      params?.seconds
        ? `translated:${key}:${params.seconds}`
        : `translated:${key}`;

    assert.equal(
      getLocalizedAuthErrorMessage(
        { message: ONE_ACCOUNT_PER_DEVICE_MESSAGE },
        t
      ),
      "translated:auth.oneAccountPerDeviceMessage"
    );
    assert.equal(
      getLocalizedAuthErrorMessage(
        { message: "New password should be different from the old password." },
        t
      ),
      "translated:auth.passwordMustDifferFromOld"
    );
    assert.equal(
      getLocalizedAuthErrorMessage({ message: "Email is required." }, t),
      "translated:auth.emailRequired"
    );
    assert.equal(
      getLocalizedAuthErrorMessage(
        {
          message:
            "Unable to validate email address: invalid format",
        },
        t
      ),
      "translated:auth.invalidEmailFormat"
    );
    assert.equal(
      getLocalizedAuthErrorMessage(
        { message: "Invalid login credentials" },
        t
      ),
      "translated:auth.invalidLoginCredentials"
    );
    assert.equal(
      getLocalizedAuthErrorMessage(
        { message: "Email not confirmed" },
        t
      ),
      "translated:auth.confirmEmailMessage"
    );
    assert.equal(
      getLocalizedAuthErrorMessage(
        { message: "email rate limit exceeded" },
        t
      ),
      "translated:auth.emailRateLimitExceeded"
    );
    assert.equal(
      getLocalizedAuthErrorMessage(
        {
          message:
            "For security purposes, you can only request this after 8 seconds.",
        },
        t
      ),
      "translated:auth.securityRequestDelay:8"
    );
    assert.equal(
      getLocalizedAuthErrorMessage({ message: "" }, t),
      "translated:common.unknownError"
    );
    assert.equal(
      getLocalizedAuthErrorMessage({ message: "Remote auth error" }, t),
      "Remote auth error"
    );
  }
);

await test(
  "email entry routes suppress confusing header back affordances",
  () => {
    assert.equal(
      shouldShowHeaderBack("/", true),
      false,
      "Dashboard should not show a back arrow even if stack history exists"
    );
    assert.equal(
      shouldShowHeaderBack("/reset-password", true),
      false,
      "Password reset email entry should not show a back arrow"
    );
    assert.equal(
      shouldShowHeaderBack("/sign-in", true, { confirmed: "true" }),
      false,
      "Confirmed email return to sign-in should not show a back arrow"
    );
    assert.equal(
      shouldShowHeaderBack("/sign-in", true),
      true,
      "Regular in-app sign-in navigation can still show a back arrow"
    );
    assert.equal(
      shouldShowHeaderBack("/practice", false),
      false,
      "Routes without navigation history still hide the back arrow"
    );
  }
);

await test(
  "cached auth restores local UI without waiting for a remote profile",
  async () => {
    const warnings = [];
    const syncRequests = [];
    let rejectRemoteProfile;
    const remoteProfile = new Promise((_, reject) => {
      rejectRemoteProfile = reject;
    });
    const engine = createAuthSessionEngine({
      appMetaRepo: {
        getLocalDataOwnerUserId: () => "offline-user",
        setLocalDataOwnerUserId: () => {},
      },
      claimAnonymousLocalDataIfNeeded: async () => {},
      emitAuthChanged: () => {},
      fetchRemoteProfile: () => remoteProfile,
      logger: {
        warn: (...args) => warnings.push(args),
      },
      now: () => 123,
      profileRepo: {
        getUserProfileById: () => ({
          userId: "offline-user",
          email: "offline@example.com",
          firstName: "Cached name",
          updatedAt: 100,
        }),
        upsertUserProfile: () => {},
      },
      requestSync: (userId, options) => {
        syncRequests.push({ options, userId });
      },
      requireRemoteAuthoritativeSync: () => {},
    });

    const result = engine.restoreSession({
      id: "offline-user",
      email: "offline@example.com",
    });

    assert.equal(result, undefined);
    assert.deepEqual(engine.getAuthState(), {
      isAuthenticated: true,
      userId: "offline-user",
      email: "offline@example.com",
      firstName: "Cached name",
    });
    assert.deepEqual(syncRequests, [{
      userId: "offline-user",
      options: { immediate: true, mode: "merge_local" },
    }]);

    rejectRemoteProfile(new TypeError("Network request failed"));
    await waitFor(
      () => warnings.length === 1,
      "Expected the failed background profile refresh to be contained"
    );
    assert.equal(engine.getAuthState().firstName, "Cached name");
  }
);

await test(
  "offline-first startup does not wait for the remote update check",
  async () => {
    const events = [];
    const remoteCheckNeverCompletes = new Promise(() => {});

    await initializeOfflineFirstStartup({
      initializeLocalApp: async () => {
        events.push("local-started");
        await Promise.resolve();
        events.push("local-complete");
      },
      readCachedUpdateRequirement: async () => {
        events.push("cached-policy-read");
        return { kind: "none" };
      },
      applyCachedUpdateRequirement: (requirement) => {
        events.push(`cached-policy-applied:${requirement.kind}`);
      },
      checkRemoteUpdate: () => {
        events.push("remote-check-started");
        return remoteCheckNeverCompletes;
      },
    });

    assert.ok(events.includes("local-complete"));
    assert.ok(events.includes("cached-policy-applied:none"));
    assert.equal(events.at(-1), "remote-check-started");
  }
);

await test(
  "auth email renderer localizes templates and verification links",
  () => {
    assert.equal(
      getAuthEmailLanguage({
        redirectTo: "app108again://sign-in?confirmed=true&lang=es",
        userMetadata: { preferred_language: "en" },
      }),
      "es",
      "Redirect language should override stored metadata"
    );
    assert.equal(
      getAuthEmailLanguage({
        redirectTo: "app108again://sign-in?confirmed=true",
        userMetadata: { preferred_language: "ru" },
      }),
      "ru"
    );
    assert.equal(
      getAuthEmailLanguage({
        redirectTo: "app108again://sign-in?confirmed=true&lang=de",
        userMetadata: { preferred_language: "en" },
      }),
      "de"
    );
    assert.equal(
      getAuthEmailLanguage({
        redirectTo: "app108again://sign-in?confirmed=true&lang=pl",
        userMetadata: { preferred_language: "en" },
      }),
      "pl"
    );
    assert.equal(
      getAuthEmailLanguage({
        redirectTo: "app108again://sign-in?confirmed=true&lang=cs",
        userMetadata: { preferred_language: "en" },
      }),
      "cs"
    );
    assert.equal(
      getAuthEmailLanguage({
        redirectTo: "app108again://sign-in?confirmed=true&lang=hu",
        userMetadata: { preferred_language: "en" },
      }),
      "hu"
    );
    assert.equal(
      getAuthEmailLanguage({
        redirectTo: "app108again://sign-in?confirmed=true&lang=it",
        userMetadata: { preferred_language: "it" },
      }),
      "en",
      "Unsupported languages should fall back to English"
    );

    const verificationUrl = buildVerificationUrl({
      actionType: "signup",
      redirectTo: "app108again://sign-in?confirmed=true&lang=es",
      supabaseUrl: "https://project.supabase.co",
      tokenHash: "token-hash",
    });
    const parsedUrl = new URL(verificationUrl);

    assert.equal(
      `${parsedUrl.origin}${parsedUrl.pathname}`,
      "https://project.supabase.co/auth/v1/verify"
    );
    assert.equal(parsedUrl.searchParams.get("token"), "token-hash");
    assert.equal(parsedUrl.searchParams.get("type"), "signup");
    assert.equal(
      parsedUrl.searchParams.get("redirect_to"),
      "app108again://sign-in?confirmed=true&lang=es"
    );

    const spanishEmail = renderAuthEmail({
      actionType: "signup",
      firstName: "Gianpi",
      language: "es",
      token: "123456",
      verificationUrl,
    });

    assert.equal(spanishEmail.subject, "Confirma tu email");
    assert.match(spanishEmail.html, /Confirmar email/);
    assert.match(spanishEmail.text, /Gianpi, Sigue el enlace/);
    assert.match(spanishEmail.text, /123456/);

    const russianEmail = renderAuthEmail({
      actionType: "recovery",
      firstName: "Иван",
      language: "ru",
      token: "654321",
      verificationUrl,
    });

    assert.equal(russianEmail.subject, "Сброс пароля");
    assert.match(russianEmail.html, /Сбросить пароль/);
    assert.match(russianEmail.text, /Иван, Перейдите/);
    assert.match(russianEmail.text, /654321/);

    const newLanguageEmails = [
      ["de", "Passwort zurücksetzen"],
      ["pl", "Zresetuj hasło"],
      ["cs", "Reset hesla"],
      ["hu", "Jelszó visszaállítása"],
    ];

    for (const [language, expectedSubject] of newLanguageEmails) {
      const email = renderAuthEmail({
        actionType: "recovery",
        language,
        verificationUrl,
      });

      assert.equal(email.subject, expectedSubject);
    }

    const fallbackEmail = renderAuthEmail({
      actionType: "unknown_action",
      language: "en",
      verificationUrl,
    });

    assert.equal(fallbackEmail.subject, "Continue with 108 Again");
  }
);

await test(
  "new practices disable daily targets and default sessions to 108",
  () => {
    const createdAt = Date.parse("2026-07-26T10:30:00.000Z");
    const device = makeLocalDevice(null, () => createdAt);
    const practiceId = device.operations.createPractice(
      "Default Count Practice",
      10000
    );
    const practice = device.practiceRepo.getPracticeById(practiceId);

    assert.equal(practice.dailyTargetCount, null);
    assert.equal(practice.defaultSessionCount, 108);
    assert.equal(practice.calendarStartDate, createdAt);
  }
);

await test(
  "unsetting a target date clears its derived daily target",
  () => {
    const device = makeLocalDevice();
    const practiceId = device.operations.createPractice(
      "Unset Target Date Practice",
      10000,
      108
    );

    device.operations.updatePracticeDailyTargetCount(
      practiceId,
      null
    );

    assert.equal(
      device.practiceRepo.getPracticeById(practiceId)
        .dailyTargetCount,
      null
    );
  }
);

await test(
  "practice average includes zero-count days within the selected range",
  () => {
    let nowMs = Date.parse("2026-07-10T12:00:00Z");
    const device = makeLocalDevice(null, () => nowMs);
    const practiceId = device.operations.createPractice(
      "Range Average Practice",
      10000
    );

    assert.equal(
      device.operations.getPracticeAverageSessionSize(practiceId, 10),
      0
    );

    nowMs = Date.parse("2026-07-05T12:00:00Z");
    device.operations.addSession(practiceId, 100);

    nowMs = Date.parse("2026-07-07T12:00:00Z");
    device.operations.addSession(practiceId, 200);

    nowMs = Date.parse("2026-07-10T12:00:00Z");

    assert.equal(
      device.operations.getPracticeAverageSessionSize(practiceId, 10),
      50
    );
    assert.equal(
      device.operations.getPracticeAverageSessionSize(practiceId, 5),
      40
    );
    assert.equal(
      device.operations.getPracticeAverageSessionSize(practiceId, 3),
      0
    );

    const lifetimeStats =
      device.operations.getPracticeLifetimeStats(practiceId);

    assert.equal(lifetimeStats.averageSessionSize, 50);
    assert.equal(lifetimeStats.largestSession, 200);
  }
);

await test(
  "practice days follow the phone calendar date instead of UTC",
  () => {
    const sessionTime = Date.parse("2026-07-26T22:30:00.000Z");
    const expectedLocalDay = formatCalendarDate(
      new Date(sessionTime)
    );
    const device = makeLocalDevice(null, () => sessionTime);
    const practiceId = device.operations.createPractice(
      "Local Calendar Day Practice",
      10000
    );

    device.operations.addSession(practiceId, 108);

    const storedSession =
      device.sessionRepo.getAllSessionsForSync()[0];

    assert.equal(
      storedSession.localDate,
      expectedLocalDay,
      "The phone-local calendar date is stored separately from the UTC instant"
    );

    assert.deepEqual(
      device.operations.getCalendarDailyData(practiceId),
      [{ date: expectedLocalDay, count: 108 }]
    );
    assert.equal(
      formatCalendarDate(
        getCalendarDateFromString(expectedLocalDay)
      ),
      expectedLocalDay,
      "Calendar date strings round trip in local time"
    );
  }
);

await test(
  "backup preserves the recorded phone-local day across timezones",
  async () => {
    const originalTimezone = process.env.TZ;

    try {
      process.env.TZ = "Pacific/Kiritimati";

      const sessionTime = Date.parse("2026-07-26T10:30:00.000Z");
      const source = makeLocalDevice(null, () => sessionTime);
      const practiceId = source.operations.createPractice(
        "Timezone Backup Practice",
        10000
      );

      source.operations.addSession(practiceId, 108);
      const backup = source.operations.getBackupData();

      assert.equal(backup.sessions[0].localDate, "2026-07-27");

      process.env.TZ = "America/Los_Angeles";

      const destination = makeLocalDevice();
      await destination.operations.restoreBackupData(backup);

      assert.deepEqual(
        destination.operations.getCalendarDailyData(practiceId),
        [{ date: "2026-07-27", count: 108 }]
      );
      assert.equal(
        getCalendarDateFromString("2026-07-27").getDate(),
        27,
        "Calendar labels parse as local civil dates west of UTC"
      );
    } finally {
      if (originalTimezone === undefined) {
        delete process.env.TZ;
      } else {
        process.env.TZ = originalTimezone;
      }
    }
  }
);

await test(
  "legacy synced sessions backfill a local day and are republished",
  () => {
    const originalTimezone = process.env.TZ;

    try {
      process.env.TZ = "Pacific/Kiritimati";

      const database = createBetterSqliteDatabase();
      database.execSync(`
        CREATE TABLE sessions (
          id TEXT PRIMARY KEY,
          practiceId TEXT,
          count INTEGER,
          createdAt INTEGER,
          userId TEXT,
          updatedAt INTEGER,
          syncStatus TEXT,
          lastSyncedAt INTEGER,
          deletedAt INTEGER
        )
      `);
      database.runSync(
        `INSERT INTO sessions (
          id,
          practiceId,
          count,
          createdAt,
          userId,
          updatedAt,
          syncStatus,
          lastSyncedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        "legacy-session",
        "legacy-practice",
        108,
        Date.parse("2026-07-26T22:30:00.000Z"),
        "legacy-user",
        Date.parse("2026-07-26T10:31:00.000Z"),
        "synced",
        Date.parse("2026-07-26T10:32:00.000Z")
      );

      initializeDatabaseSchema(database);

      const expectedLocalDate = database.getAllSync(
        `SELECT date(
          ?/1000,
          'unixepoch',
          'localtime'
        ) AS day`,
        Date.parse("2026-07-26T22:30:00.000Z")
      )[0].day;
      const migrated = database.getAllSync(
        "SELECT localDate, syncStatus, lastSyncedAt FROM sessions"
      )[0];

      assert.equal(migrated.localDate, expectedLocalDate);
      assert.equal(migrated.syncStatus, "pending");
      assert.equal(migrated.lastSyncedAt, null);
    } finally {
      if (originalTimezone === undefined) {
        delete process.env.TZ;
      } else {
        process.env.TZ = originalTimezone;
      }
    }
  }
);

await test(
  "update policy distinguishes optional and mandatory releases",
  () => {
    assert.deepEqual(
      determineUpdateRequirement({
        currentVersionCode: 24,
        policy: basePolicy,
      }),
      {
        kind: "required",
        reason: "minimum-version",
        availableVersionCode: 30,
        message: null,
      }
    );

    assert.deepEqual(
      determineUpdateRequirement({
        currentVersionCode: 28,
        policy: basePolicy,
      }),
      {
        kind: "optional",
        availableVersionCode: 30,
      }
    );

    assert.deepEqual(
      determineUpdateRequirement({
        currentVersionCode: 30,
        policy: basePolicy,
      }),
      { kind: "none" }
    );

    assert.deepEqual(
      determineUpdateRequirement({
        currentVersionCode: 31,
        policy: basePolicy,
      }),
      { kind: "none" },
      "a policy latest version below the installed version must not prompt"
    );

    assert.deepEqual(
      determineUpdateRequirement({
        currentVersionCode: 30,
        policy: {
          ...basePolicy,
          latestVersionCode: 31,
          minimumSupportedVersionCode: 31,
        },
      }),
      {
        kind: "required",
        reason: "minimum-version",
        availableVersionCode: 31,
        message: null,
      },
      "minimum supported version above the installed version must still block"
    );
  }
);

await test(
  "maintenance mode blocks every supported version",
  () => {
    const requirement = determineUpdateRequirement({
      currentVersionCode: 30,
      policy: {
        ...basePolicy,
        maintenanceMode: true,
        message: "Brief maintenance in progress.",
      },
    });

    assert.deepEqual(requirement, {
      kind: "required",
      reason: "maintenance",
      availableVersionCode: null,
      message: "Brief maintenance in progress.",
    });
  }
);

await test(
  "update policy fallback message keys use localized app fallbacks",
  () => {
    assert.deepEqual(
      determineUpdateRequirement({
        currentVersionCode: 24,
        policy: {
          ...basePolicy,
          message: "update.requiredMessage",
        },
      }),
      {
        kind: "required",
        reason: "minimum-version",
        availableVersionCode: 30,
        message: null,
      }
    );

    assert.deepEqual(
      determineUpdateRequirement({
        currentVersionCode: 30,
        policy: {
          ...basePolicy,
          maintenanceMode: true,
          message: "update.maintenanceMessage",
        },
      }),
      {
        kind: "required",
        reason: "maintenance",
        availableVersionCode: null,
        message: null,
      }
    );
  }
);

await test(
  "only unrecoverable refresh-token errors invalidate the local session",
  () => {
    assert.equal(
      isUnrecoverableRefreshTokenError({
        code: "refresh_token_not_found",
        message: "Invalid Refresh Token: Refresh Token Not Found",
      }),
      true
    );
    assert.equal(
      isUnrecoverableRefreshTokenError({
        code: "refresh_token_already_used",
      }),
      true
    );
    assert.equal(
      isUnrecoverableRefreshTokenError({
        code: "over_request_rate_limit",
        message: "Network request failed",
      }),
      false
    );
  }
);

await test(
  "sync coordinator enforces update, connectivity, and auth guards",
  async () => {
    const blocked = createSyncCoordinatorHarness();
    blocked.state.appAccessBlocked = true;

    assert.equal(
      await blocked.coordinator.syncNow("user-1"),
      "skipped"
    );
    assert.equal(blocked.state.createdEngines, 0);

    const offline = createSyncCoordinatorHarness();
    offline.state.isOnline = false;
    offline.state.currentSessionUserId = "user-2";

    assert.equal(
      await offline.coordinator.syncNow("user-2", {
        mode: "remote_overwrite_local",
      }),
      "offline"
    );
    assert.equal(offline.coordinator.getSyncState(), "offline");
    assert.equal(offline.state.remoteAccessChecks, 0);
    assert.deepEqual(
      offline.state.remoteAuthoritativeUsers,
      ["user-2"]
    );

    offline.state.isOnline = true;
    offline.coordinator.handleConnectivityChanged();
    offline.runNextTimer();
    await waitFor(
      () => offline.state.executedSyncs.length === 1,
      "Queued sync did not execute after connectivity returned"
    );
    assert.deepEqual(offline.state.executedSyncs, [
      {
        mode: "remote_overwrite_local",
        userId: "user-2",
      },
    ]);
    assert.equal(offline.state.remoteAccessChecks, 1);

    const signedOutRetry = createSyncCoordinatorHarness();
    signedOutRetry.state.currentSessionUserId = "previous-user";
    signedOutRetry.state.isOnline = false;

    assert.equal(
      await signedOutRetry.coordinator.syncNow("previous-user"),
      "offline"
    );

    signedOutRetry.state.currentSessionUserId = null;
    signedOutRetry.state.isOnline = true;
    signedOutRetry.coordinator.handleConnectivityChanged();
    signedOutRetry.runNextTimer();
    await new Promise((resolve) => setTimeout(resolve, 0));

    assert.equal(signedOutRetry.state.remoteAccessChecks, 0);
    assert.equal(signedOutRetry.state.executedSyncs.length, 0);
    signedOutRetry.coordinator.handleConnectivityChanged();
    assert.equal(
      signedOutRetry.state.scheduledTimers.size,
      0,
      "A rejected signed-out retry must forget the previous user"
    );

    const explicitlySignedOut = createSyncCoordinatorHarness();
    explicitlySignedOut.state.currentSessionUserId = "previous-user";
    explicitlySignedOut.state.isOnline = false;
    await explicitlySignedOut.coordinator.syncNow("previous-user");
    explicitlySignedOut.coordinator.clearUserSyncState("previous-user");
    explicitlySignedOut.state.isOnline = true;
    explicitlySignedOut.coordinator.handleConnectivityChanged();
    assert.equal(explicitlySignedOut.state.scheduledTimers.size, 0);

    const newlyBlocked = createSyncCoordinatorHarness();
    newlyBlocked.state.currentSessionUserId = "user-blocked";
    newlyBlocked.state.remoteAccessStatus = "blocked";

    assert.equal(
      await newlyBlocked.coordinator.syncNow("user-blocked"),
      "update_required"
    );
    assert.equal(newlyBlocked.state.remoteAccessChecks, 1);
    assert.equal(newlyBlocked.state.executedSyncs.length, 0);

    const policyUnavailable = createSyncCoordinatorHarness();
    policyUnavailable.state.currentSessionUserId = "user-unavailable";
    policyUnavailable.state.remoteAccessStatus = "unavailable";

    assert.equal(
      await policyUnavailable.coordinator.syncNow("user-unavailable"),
      "policy_unavailable"
    );
    assert.equal(policyUnavailable.state.remoteAccessChecks, 1);
    assert.equal(policyUnavailable.state.executedSyncs.length, 0);
    assert.equal(policyUnavailable.coordinator.getSyncState(), "error");

    const deleted = createSyncCoordinatorHarness();
    deleted.state.currentSessionUserId = "user-3";
    deleted.state.userDeleted = true;

    assert.equal(
      await deleted.coordinator.syncNow("user-3"),
      "auth_invalid"
    );
    assert.equal(deleted.state.authInvalidEvents, 1);
    assert.equal(deleted.state.executedSyncs.length, 0);
  }
);

await test(
  "backup round trips daily targets and default session counts",
  async () => {
    let sourceNow = Date.parse("2026-07-10T12:00:00.000Z");
    const source = makeLocalDevice(null, () => sourceNow);
    const practiceId = source.operations.createPractice(
      "Backup Count Practice",
      10000,
      500,
      125
    );

    sourceNow = Date.parse("2026-06-05T08:00:00.000Z");
    source.operations.addSession(practiceId, 108);
    sourceNow = Date.parse("2026-06-03T08:00:00.000Z");
    source.operations.addSession(practiceId, 54);

    const backup = source.operations.getBackupData();
    const exportedPractice = backup.practices.find(
      (practice) => practice.id === practiceId
    );

    assert.equal(exportedPractice.dailyTargetCount, 500);
    assert.equal(exportedPractice.defaultSessionCount, 125);
    assert.doesNotThrow(() => validateBackup(backup));

    const importedAt = Date.parse("2026-08-01T09:00:00.000Z");
    const destination = makeLocalDevice(null, () => importedAt);
    await destination.operations.restoreBackupData(backup);

    const restoredPractice = destination.practiceRepo.getPracticeById(
      practiceId
    );
    assert.equal(restoredPractice.dailyTargetCount, 500);
    assert.equal(restoredPractice.defaultSessionCount, 125);
    assert.equal(
      restoredPractice.calendarStartDate,
      Date.parse("2026-06-03T08:00:00.000Z"),
      "Backup import starts editing at that practice's first session"
    );
  }
);

await test(
  "backup practices without sessions start on the import date",
  async () => {
    const source = makeLocalDevice(
      null,
      () => Date.parse("2026-05-01T10:00:00.000Z")
    );
    const practiceId = source.operations.createPractice(
      "Empty Backup Practice",
      10000
    );
    const backup = source.operations.getBackupData();
    const importedAt = Date.parse("2026-08-02T10:00:00.000Z");
    const destination = makeLocalDevice(null, () => importedAt);

    await destination.operations.restoreBackupData(backup);

    assert.equal(
      destination.practiceRepo
        .getPracticeById(practiceId)
        .calendarStartDate,
      importedAt
    );
  }
);

await test(
  "logged-out partial-default backup replaces the same user's remote defaults",
  async () => {
    const userId = "backup-edge-user";
    let currentUserId = userId;
    let currentTime = Date.parse("2026-08-03T10:00:00.000Z");
    const device = makeLocalDevice(
      () => currentUserId,
      () => {
        currentTime += 1000;
        return currentTime;
      }
    );
    const remote = createMemorySyncRemote();
    const syncEngine = createSyncEngineForDevice(
      device,
      remote,
      () => {
        currentTime += 1000;
        return currentTime;
      }
    );
    const omittedSeedId = DEFAULT_PRACTICES[0].id;

    await device.operations.restoreDefaults();
    await syncEngine.executeSync(userId, "merge_local");

    assert.equal(
      (await remote.pullPractices(userId))
        .filter((practice) => !practice.deleted_at)
        .length,
      DEFAULT_PRACTICES.length
    );

    currentUserId = null;
    const partialBackup = device.operations.getBackupData();
    partialBackup.practices = partialBackup.practices.filter(
      (practice) => practice.id !== omittedSeedId
    );
    partialBackup.sessions = partialBackup.sessions.filter(
      (session) => session.practiceId !== omittedSeedId
    );
    partialBackup.practiceReminders =
      partialBackup.practiceReminders.filter(
        (reminder) => reminder.practiceId !== omittedSeedId
      );

    await device.operations.restoreBackupData(partialBackup);
    assert.equal(device.practiceRepo.getPracticeById(omittedSeedId), null);

    currentUserId = userId;
    await syncEngine.executeSync(userId, "merge_local");

    const activeRemoteIds = (await remote.pullPractices(userId))
      .filter((practice) => !practice.deleted_at)
      .map((practice) => practice.id);

    assert.equal(
      activeRemoteIds.includes(omittedSeedId),
      false,
      "The default omitted from the backup must stay deleted after login sync"
    );
    assert.deepEqual(
      activeRemoteIds.sort(),
      DEFAULT_PRACTICES
        .slice(1)
        .map((practice) => practice.id)
        .sort()
    );
  }
);

await test(
  "backup round trips practice reminder schedules",
  async () => {
    const source = makeLocalDevice();
    const practiceId = source.operations.createPractice(
      "Backup Reminder Practice",
      10000,
      500,
      108
    );

    source.operations.updatePracticeReminderSettings(
      practiceId,
      true,
      7,
      45
    );

    const backup = source.operations.getBackupData();
    const exportedReminder = backup.practiceReminders.find(
      (reminder) => reminder.practiceId === practiceId
    );

    assert.deepEqual(exportedReminder, {
      practiceId,
      enabled: true,
      hour: 7,
      minute: 45,
    });
    assert.doesNotThrow(() => validateBackup(backup));

    const destination = makeLocalDevice();
    await destination.operations.restoreBackupData(backup);

    const restoredPractice = destination.practiceRepo.getPracticeById(
      practiceId
    );
    assert.equal(restoredPractice.reminderEnabled, 1);
    assert.equal(restoredPractice.reminderHour, 7);
    assert.equal(restoredPractice.reminderMinute, 45);
    assert.deepEqual(
      getPracticeReminderSettingsFromPractice(restoredPractice),
      {
        enabled: true,
        hour: 7,
        minute: 45,
        scheduledNotifications: [],
      },
      "Detail reminder state follows imported practice reminder columns"
    );

    const restoredBackup = destination.operations.getBackupData();
    assert.deepEqual(
      restoredBackup.practiceReminders.find(
        (reminder) => reminder.practiceId === practiceId
      ),
      {
        practiceId,
        enabled: true,
        hour: 7,
        minute: 45,
      }
    );
  }
);

await test(
  "backup service wrapper exports and restores database and stored reminders",
  async () => {
    const source = makeLocalDevice();
    const databasePracticeId = source.operations.createPractice(
      "Database Reminder Practice",
      10000,
      500,
      108
    );
    const storedPracticeId = source.operations.createPractice(
      "Stored Reminder Practice",
      10000,
      500,
      108
    );
    const sourceStorage = createMemoryStorage();

    source.operations.updatePracticeReminderSettings(
      databasePracticeId,
      true,
      6,
      15
    );

    const backup = await withBackupServiceHarness(
      source,
      sourceStorage,
      async (backupService, practiceReminderService) => {
        await practiceReminderService.restorePracticeReminderBackupData(
          [
            {
              practiceId: databasePracticeId,
              enabled: true,
              hour: 20,
              minute: 30,
            },
            {
              practiceId: storedPracticeId,
              enabled: true,
              hour: 7,
              minute: 45,
            },
          ],
          new Set([databasePracticeId, storedPracticeId])
        );

        return backupService.getBackupData();
      }
    );

    assert.deepEqual(
      backup.practiceReminders
        .filter(row =>
          row.practiceId === databasePracticeId ||
          row.practiceId === storedPracticeId
        )
        .sort((a, b) => a.practiceId.localeCompare(b.practiceId)),
      [
        {
          practiceId: databasePracticeId,
          enabled: true,
          hour: 6,
          minute: 15,
        },
        {
          practiceId: storedPracticeId,
          enabled: true,
          hour: 7,
          minute: 45,
        },
      ].sort((a, b) => a.practiceId.localeCompare(b.practiceId)),
      "Backup service uses database reminders first and stored reminders as a legacy fallback"
    );

    const destination = makeLocalDevice();
    const destinationStorage = createMemoryStorage();

    await withBackupServiceHarness(
      destination,
      destinationStorage,
      async (
        backupService,
        practiceReminderService,
        harnessState
      ) => {
        await backupService.restoreBackupData(backup);

        const restoredDatabasePractice =
          destination.practiceRepo.getPracticeById(databasePracticeId);
        const restoredStoredPractice =
          destination.practiceRepo.getPracticeById(storedPracticeId);

        assert.equal(restoredDatabasePractice.reminderEnabled, 1);
        assert.equal(restoredDatabasePractice.reminderHour, 6);
        assert.equal(restoredDatabasePractice.reminderMinute, 15);
        assert.equal(restoredStoredPractice.reminderEnabled, 1);
        assert.equal(restoredStoredPractice.reminderHour, 7);
        assert.equal(restoredStoredPractice.reminderMinute, 45);

        assert.deepEqual(
          await practiceReminderService.getPracticeReminderSettings(
            databasePracticeId
          ),
          {
            enabled: true,
            hour: 6,
            minute: 15,
            scheduledNotifications: [],
          },
          "Backup restore also updates the native reminder store"
        );
        assert.deepEqual(
          await practiceReminderService.getPracticeReminderSettings(
            storedPracticeId
          ),
          {
            enabled: true,
            hour: 7,
            minute: 45,
            scheduledNotifications: [],
          },
          "Stored fallback reminders restore into the native reminder store"
        );
        assert.equal(
          harnessState.refreshAllReminderCalls,
          1,
          "Backup restore queues a reminder refresh through the app wrapper"
        );
      }
    );
  }
);

await test(
  "custom practice images and reordered cards round trip through backup",
  async () => {
    const source = makeLocalDevice();
    const firstPracticeId = source.operations.createPractice(
      "Custom Image One",
      10000,
      null,
      108,
      "green-tara"
    );
    const secondPracticeId = source.operations.createPractice(
      "Custom Image Two",
      20000,
      null,
      54,
      "chenrezig"
    );
    const activeIds =
      source.practiceRepo.getAllPractices().map(practice => practice.id);
    const reorderedIds = [
      secondPracticeId,
      ...activeIds.filter(practiceId => practiceId !== secondPracticeId),
    ];

    source.operations.reorderPractices(reorderedIds);

    const reorderedRows = source.practiceRepo.getAllPractices();
    assert.equal(reorderedRows[0].id, secondPracticeId);
    assert.equal(
      source.practiceRepo.getPracticeById(firstPracticeId).imageKey,
      "green-tara"
    );
    assert.equal(
      source.practiceRepo.getPracticeById(secondPracticeId).imageKey,
      "chenrezig"
    );

    const backup = source.operations.getBackupData();
    const exportedSecondPractice = backup.practices.find(
      practice => practice.id === secondPracticeId
    );

    assert.equal(exportedSecondPractice.imageKey, "chenrezig");
    assert.equal(exportedSecondPractice.orderIndex, 1);
    assert.doesNotThrow(() => validateBackup(backup));

    const destination = makeLocalDevice();
    await destination.operations.restoreBackupData(backup);

    const restoredRows = destination.practiceRepo.getAllPractices();
    assert.equal(restoredRows[0].id, secondPracticeId);
    assert.equal(
      destination.practiceRepo.getPracticeById(firstPracticeId).imageKey,
      "green-tara"
    );
    assert.equal(
      destination.practiceRepo.getPracticeById(secondPracticeId).imageKey,
      "chenrezig"
    );
  }
);

await test(
  "uploaded practice images stay local in the database and portable in backups",
  async () => {
    const source = makeLocalDevice();
    const practiceId = source.operations.createPractice(
      "Uploaded Image",
      10000,
      null,
      108,
      CUSTOM_PRACTICE_IMAGE_KEY,
      "file:///practice-images/uploaded.jpg"
    );
    const stored = source.practiceRepo.getPracticeById(practiceId);

    assert.equal(stored.imageKey, CUSTOM_PRACTICE_IMAGE_KEY);
    assert.equal(
      stored.customImageUri,
      "file:///practice-images/uploaded.jpg"
    );

    assert.equal(
      source.operations.replaceCustomPracticeImage(
        practiceId,
        "file:///practice-images/replacement.jpg"
      ),
      "file:///practice-images/uploaded.jpg"
    );
    assert.equal(
      source.practiceRepo.getPracticeById(practiceId).customImageUri,
      "file:///practice-images/replacement.jpg"
    );

    const deviceBackup = source.operations.getBackupData();
    assert.equal(
      deviceBackup.practices.find(
        practice => practice.id === practiceId
      ).customImageUri,
      "file:///practice-images/replacement.jpg",
      "Backup export reads the replacement image path"
    );
    assert.throws(
      () => validateBackup(deviceBackup),
      /device-local image path/
    );

    const portableBackup = {
      ...deviceBackup,
      practices: deviceBackup.practices.map((practice) => {
        const { customImageUri, ...portablePractice } = practice;

        return practice.id === practiceId
          ? {
              ...portablePractice,
              customImage: {
                mimeType: "image/jpeg",
                width: CUSTOM_PRACTICE_IMAGE_WIDTH,
                height: CUSTOM_PRACTICE_IMAGE_HEIGHT,
                data: "/9j/2Q==",
              },
            }
          : portablePractice;
      }),
    };

    assert.doesNotThrow(() => validateBackup(portableBackup));
  }
);

await test(
  "uploaded practice images use the binary sync channel",
  async () => {
    const userId = "custom-image-sync-user";
    let currentTime = Date.parse("2026-09-05T12:00:00.000Z");
    const now = () => {
      currentTime += 1000;
      return currentTime;
    };
    const remote = createMemorySyncRemote();
    const source = makeLocalDevice(userId, now);
    const practiceId = source.operations.createPractice(
      "Synced Upload",
      20000,
      null,
      108,
      CUSTOM_PRACTICE_IMAGE_KEY,
      "file:///practice-images/source.jpg"
    );
    const uploads = [];
    const removals = [];
    const sourceImageSync = {
      async upload(ownerId, id, uri) {
        uploads.push({ ownerId, id, uri });
      },
      async download() {
        throw new Error("Source should not download its own image");
      },
      async remove(ownerId, id) {
        removals.push({ ownerId, id });
      },
      async removeAllForUser() {},
      deleteLocal() {},
    };
    const sourceSync = createSyncEngineForDevice(
      source,
      remote,
      now,
      sourceImageSync
    );

    await sourceSync.executeSync(userId, "merge_local");
    assert.deepEqual(uploads, [
      {
        ownerId: userId,
        id: practiceId,
        uri: "file:///practice-images/source.jpg",
      },
    ]);

    const destination = makeLocalDevice(userId, now);
    const downloads = [];
    const deletedLocalImages = [];
    const destinationImageSync = {
      async upload() {},
      async download(ownerId, id) {
        downloads.push({ ownerId, id });
        return downloads.length === 1
          ? "file:///practice-images/downloaded.jpg"
          : "file:///practice-images/replacement-downloaded.jpg";
      },
      async remove() {},
      async removeAllForUser() {},
      deleteLocal(uri) {
        deletedLocalImages.push(uri);
      },
    };
    const destinationSync = createSyncEngineForDevice(
      destination,
      remote,
      now,
      destinationImageSync
    );

    await destinationSync.executeSync(
      userId,
      "remote_overwrite_local"
    );
    assert.deepEqual(downloads, [{ ownerId: userId, id: practiceId }]);
    assert.equal(
      destination.practiceRepo.getPracticeById(practiceId).customImageUri,
      "file:///practice-images/downloaded.jpg"
    );

    source.operations.replaceCustomPracticeImage(
      practiceId,
      "file:///practice-images/replacement.jpg"
    );
    await sourceSync.executeSync(userId, "merge_local");

    assert.deepEqual(uploads[1], {
      ownerId: userId,
      id: practiceId,
      uri: "file:///practice-images/replacement.jpg",
    });

    await destinationSync.executeSync(userId, "merge_local");
    assert.deepEqual(downloads, [
      { ownerId: userId, id: practiceId },
      { ownerId: userId, id: practiceId },
    ]);
    assert.equal(
      destination.practiceRepo.getPracticeById(practiceId).customImageUri,
      "file:///practice-images/replacement-downloaded.jpg"
    );
    assert.deepEqual(
      deletedLocalImages,
      ["file:///practice-images/downloaded.jpg"],
      "Receiving a replacement removes the superseded local image"
    );

    await source.operations.deletePractice(practiceId);
    await sourceSync.executeSync(userId, "merge_local");
    assert.deepEqual(removals, [{ ownerId: userId, id: practiceId }]);
  }
);

await test(
  "built-in practice images stay fixed after creation",
  async () => {
    const device = makeLocalDevice();
    const practiceId = device.operations.createPractice(
      "Fixed Image Practice",
      10000,
      null,
      108,
      "green-tara"
    );

    let editData = device.operations.getPracticeEditData(practiceId);
    assert.equal(editData.imageKey, "green-tara");
    assert.equal(editData.isSeedPractice, false);

    assert.throws(
      () => device.operations.updatePractice(
        practiceId,
        "Fixed Image Practice",
        10000,
        0,
        "white-tara"
      ),
      /Practice images cannot be changed/
    );
    assert.equal(
      device.practiceRepo.getPracticeById(practiceId).imageKey,
      "green-tara"
    );
    assert.throws(
      () => device.operations.replaceCustomPracticeImage(
        practiceId,
        "file:///practice-images/not-allowed.jpg"
      ),
      /Only practices created with an uploaded image/
    );

    await device.operations.restoreDefaults();

    const seedPractice = DEFAULT_PRACTICES[0];
    editData = device.operations.getPracticeEditData(seedPractice.id);
    assert.equal(editData.imageKey, seedPractice.imageKey);
    assert.equal(editData.isSeedPractice, true);
    assert.throws(
      () => device.operations.updatePractice(
        seedPractice.id,
        seedPractice.name,
        seedPractice.targetCount,
        0,
        "green-tara"
      ),
      /Practice images cannot be changed/
    );
    assert.equal(
      device.practiceRepo.getPracticeById(seedPractice.id).imageKey,
      seedPractice.imageKey
    );
  }
);

await test(
  "sync pushes and pulls practice reminder schedules",
  async () => {
    const userId = "reminder-sync-user";
    const remote = createMemorySyncRemote();
    const sourceTimes = [
      Date.parse("2026-06-01T08:00:00.000Z"),
      Date.parse("2026-06-01T08:01:00.000Z"),
    ];
    let sourceTimeIndex = 0;
    const source = makeLocalDevice(userId, () => {
      const time =
        sourceTimes[Math.min(sourceTimeIndex, sourceTimes.length - 1)];
      sourceTimeIndex += 1;
      return time;
    });
    const practiceId = source.operations.createPractice(
      "Sync Reminder Practice",
      10000,
      500,
      108
    );

    source.operations.updatePracticeReminderSettings(
      practiceId,
      true,
      6,
      15
    );

    const sourceEngine = createSyncEngineForDevice(
      source,
      remote,
      () => Date.parse("2026-06-01T08:02:00.000Z")
    );

    await sourceEngine.executeSync(userId, "merge_local");

    const remotePractice = remote.getPractice(practiceId);
    assert.equal(remotePractice.reminder_enabled, true);
    assert.equal(remotePractice.reminder_hour, 6);
    assert.equal(remotePractice.reminder_minute, 15);
    assert.equal(
      remotePractice.calendar_start_date,
      "2026-06-01T08:00:00.000Z"
    );

    const destination = makeLocalDevice(userId);
    const destinationEngine = createSyncEngineForDevice(
      destination,
      remote,
      () => Date.parse("2026-06-01T08:03:00.000Z")
    );

    await destinationEngine.executeSync(userId, "remote_overwrite_local");

    const pulledPractice = destination.practiceRepo.getPracticeById(
      practiceId
    );
    assert.equal(pulledPractice.reminderEnabled, 1);
    assert.equal(pulledPractice.reminderHour, 6);
    assert.equal(pulledPractice.reminderMinute, 15);
    assert.equal(
      pulledPractice.calendarStartDate,
      Date.parse("2026-06-01T08:00:00.000Z")
    );
    assert.equal(pulledPractice.syncStatus, "synced");
    assert.equal(pulledPractice.userId, userId);
    assert.deepEqual(
      getPracticeReminderSettingsFromPractice(pulledPractice),
      {
        enabled: true,
        hour: 6,
        minute: 15,
        scheduledNotifications: [],
      },
      "Detail reminder state follows synced practice reminder columns"
    );
  }
);

await test(
  "sync preserves a session's recorded phone-local calendar day",
  async () => {
    const originalTimezone = process.env.TZ;

    try {
      const userId = "local-date-sync-user";
      const remote = createMemorySyncRemote();
      const sessionTime = Date.parse("2026-07-26T10:30:00.000Z");

      process.env.TZ = "Pacific/Kiritimati";

      const source = makeLocalDevice(userId, () => sessionTime);
      const practiceId = source.operations.createPractice(
        "Local Date Sync Practice",
        10000
      );
      source.operations.addSession(practiceId, 108);

      await createSyncEngineForDevice(
        source,
        remote,
        () => sessionTime + 1000
      ).executeSync(userId, "merge_local");

      const remoteSessions = await remote.pullSessions(userId);
      assert.equal(remoteSessions[0].local_date, "2026-07-27");

      process.env.TZ = "America/Los_Angeles";

      const destination = makeLocalDevice(userId, () => sessionTime + 2000);
      await createSyncEngineForDevice(
        destination,
        remote,
        () => sessionTime + 3000
      ).executeSync(userId, "remote_overwrite_local");

      assert.deepEqual(
        destination.operations.getCalendarDailyData(practiceId),
        [{ date: "2026-07-27", count: 108 }]
      );
    } finally {
      if (originalTimezone === undefined) {
        delete process.env.TZ;
      } else {
        process.env.TZ = originalTimezone;
      }
    }
  }
);

await test(
  "production session reads include the recorded phone-local day",
  async () => {
    const selectedSessionColumns = [];
    const client = {
      from(table) {
        return {
          select(columns) {
            if (table === "sessions") {
              selectedSessionColumns.push(columns);
            }
            return this;
          },
          eq() {
            return this;
          },
          order() {
            return Promise.resolve({ data: [], error: null });
          },
          in() {
            return Promise.resolve({ data: [], error: null });
          },
        };
      },
    };
    const remote = createSupabaseSyncRemote(() => client);

    await remote.pullSessions("local-date-read-user");
    await remote.getSessionsById(
      "local-date-read-user",
      ["session-id"]
    );

    assert.equal(selectedSessionColumns.length, 2);
    for (const columns of selectedSessionColumns) {
      assert.match(columns, /\blocal_date\b/);
    }
  }
);

await test(
  "production local-date migration leaves legacy session days unset",
  () => {
    const migrationSql = readFileSync(
      new URL(
        "../../supabase/migrations/20260731153000_add_session_local_date.sql",
        import.meta.url
      ),
      "utf8"
    );

    assert.match(
      migrationSql,
      /add column if not exists local_date date/i
    );
    assert.doesNotMatch(migrationSql, /created_at\s*::\s*date/i);
    assert.doesNotMatch(migrationSql, /update\s+public\.sessions/i);
  }
);

await test(
  "deleted seed practices can be restored with their fixed image",
  async () => {
    const device = makeLocalDevice();
    const seedPractice = DEFAULT_PRACTICES[2];

    await device.operations.restoreDefaults();
    await device.operations.deletePractice(seedPractice.id);
    assert.equal(
      device.practiceRepo.getPracticeById(seedPractice.id),
      null
    );
    device.operations.reorderPractices(
      device.practiceRepo.getAllPractices().map(practice => practice.id)
    );

    const restoredPracticeId =
      device.operations.createSeedPractice(
        seedPractice.id,
        {
          targetCount: 222222,
          defaultSessionCount: 216,
        }
      );
    const restoredPractice =
      device.practiceRepo.getPracticeById(restoredPracticeId);

    assert.equal(restoredPracticeId, seedPractice.id);
    assert.equal(restoredPractice.name, seedPractice.name);
    assert.equal(restoredPractice.targetCount, 222222);
    assert.equal(restoredPractice.imageKey, seedPractice.imageKey);
    assert.equal(restoredPractice.dailyTargetCount, null);
    assert.equal(restoredPractice.defaultSessionCount, 216);
    assert.equal(restoredPractice.orderIndex, seedPractice.orderIndex);
    assert.deepEqual(
      device.practiceRepo.getAllPractices().map(practice => practice.id),
      DEFAULT_PRACTICES.map(practice => practice.id)
    );
    assert.throws(
      () => device.operations.createSeedPractice(seedPractice.id),
      /already active/
    );
  }
);

await test(
  "restore defaults resets default practice order",
  async () => {
    let currentTime = Date.parse("2026-07-20T09:00:00.000Z");
    const device = makeLocalDevice(null, () => currentTime);

    await device.operations.restoreDefaults();
    device.operations.reorderPractices(
      DEFAULT_PRACTICES.map(practice => practice.id).reverse()
    );

    assert.deepEqual(
      device.practiceRepo.getAllPractices().map(practice => practice.id),
      DEFAULT_PRACTICES.map(practice => practice.id).reverse()
    );

    currentTime = Date.parse("2026-07-26T09:00:00.000Z");
    await device.operations.restoreDefaults();

    assert.deepEqual(
      device.practiceRepo.getAllPractices().map(practice => practice.id),
      DEFAULT_PRACTICES.map(practice => practice.id)
    );
    assert.ok(
      device.practiceRepo.getAllPractices().every(
        practice => practice.calendarStartDate === currentTime
      ),
      "Restoring defaults resets every practice calendar start date"
    );
  }
);

await test(
  "legacy backups preserve quick add count and disable daily target",
  async () => {
    const destination = makeLocalDevice();
    const practiceId = randomUUID();
    const legacyBackup = {
      app: "app108again",
      practices: [
        {
          id: practiceId,
          name: "Legacy Backup Practice",
          targetCount: 10000,
          orderIndex: 1,
          defaultAddCount: 333,
        },
      ],
      sessions: [],
    };

    assert.doesNotThrow(() => validateBackup(legacyBackup));
    await destination.operations.restoreBackupData(legacyBackup);

    const restoredPractice = destination.practiceRepo.getPracticeById(
      practiceId
    );
    assert.equal(restoredPractice.dailyTargetCount, null);
    assert.equal(restoredPractice.defaultSessionCount, 333);
  }
);

await test(
  "backup validation rejects a zero daily target",
  () => {
    assert.throws(
      () => validateBackup({
        app: "app108again",
        practices: [
          {
            id: randomUUID(),
            name: "Invalid Daily Target",
            targetCount: 10000,
            orderIndex: 1,
            dailyTargetCount: 0,
            defaultSessionCount: 108,
          },
        ],
        sessions: [],
      }),
      /Invalid daily target count/
    );
  }
);

await test(
  "backup validation accepts reminder schedules only for imported practices",
  () => {
    const practiceId = randomUUID();
    const validBackup = {
      app: "app108again",
      practices: [
        {
          id: practiceId,
          name: "Reminder Backup Practice",
          targetCount: 10000,
          orderIndex: 1,
          dailyTargetCount: 500,
          defaultSessionCount: 108,
        },
      ],
      sessions: [],
      practiceReminders: [
        {
          practiceId,
          enabled: true,
          hour: 20,
          minute: 30,
        },
      ],
    };

    assert.doesNotThrow(() => validateBackup(validBackup));

    assert.throws(
      () => validateBackup({
        ...validBackup,
        practiceReminders: [
          {
            practiceId: randomUUID(),
            enabled: true,
            hour: 20,
            minute: 30,
          },
        ],
      }),
      /Invalid practice reminder practice id/
    );

    assert.throws(
      () => validateBackup({
        ...validBackup,
        practiceReminders: [
          {
            practiceId,
            enabled: true,
            hour: 24,
            minute: 0,
          },
        ],
      }),
      /Invalid practice reminder time/
    );
  }
);

await test(
  "practice content route restores only while last focused route was practice",
  async () => {
    const device = makeLocalDevice();
    const routeMemory = createLastPracticeScreenService(createMemoryStorage());
    const practiceId = device.operations.createPractice(
      "Route Test Practice",
      1000,
      null,
      108
    );

    await routeMemory.rememberLastPracticeScreen(practiceId);

    assert.equal(
      await routeMemory.getRestorableLastPracticeScreen(
        device.practiceExists
      ),
      practiceId,
      "Last practice screen is restorable when the practice still exists"
    );

    await routeMemory.clearLastPracticeScreenIfNonPracticePath("/account");

    assert.equal(
      await routeMemory.getRestorableLastPracticeScreen(
        device.practiceExists
      ),
      null,
      "A non-practice route clears the remembered practice screen"
    );

    await routeMemory.rememberLastPracticeScreen(practiceId);
    await routeMemory.clearLastPracticeScreenIfNonPracticePath("/practice");

    assert.equal(
      await routeMemory.getRestorableLastPracticeScreen(
        device.practiceExists
      ),
      practiceId,
      "A practice route keeps the remembered practice screen"
    );

    await device.operations.deletePractice(practiceId);

    assert.equal(
      await routeMemory.getRestorableLastPracticeScreen(
        device.practiceExists
      ),
      null,
      "Deleted practices are not restored on startup"
    );

    assert.equal(
      await routeMemory.getLastPracticeScreen(),
      null,
      "Stale deleted practice ids are cleared from route memory"
    );
  }
);

await test(
  "active practice detail exits after sync deletes its practice",
  () => {
    assert.equal(
      shouldLeaveMissingPracticeScreen(false, true),
      true,
      "An active detail page exits after its practice disappears"
    );
    assert.equal(
      shouldLeaveMissingPracticeScreen(false, false),
      false,
      "An inactive pager copy must not redirect the visible practice"
    );
    assert.equal(
      shouldLeaveMissingPracticeScreen(true, true),
      false,
      "An existing active practice remains open"
    );
  }
);

await test(
  "count progress formatting is shared across total and daily targets",
  async () => {
    const numberFormatter = new Intl.NumberFormat();

    assert.equal(
      formatCountProgress(27),
      "27",
      "A count without a target remains a plain count"
    );

    assert.equal(
      formatCountProgress(27, 108),
      "27 / 108",
      "A daily count includes its target"
    );

    assert.equal(
      formatCountProgress(1234, 108000),
      `${numberFormatter.format(1234)} / ${numberFormatter.format(108000)}`,
      "Both values use the shared localized number formatting"
    );

    const germanFormatter = new Intl.NumberFormat("de-DE");

    assert.equal(
      formatCountProgress(1234, 108000, "de-DE"),
      `${germanFormatter.format(1234)} / ${germanFormatter.format(108000)}`,
      "Both values can be formatted with the active app locale"
    );
  }
);

await test(
  "number inputs format with locale separators and parse back to counts",
  async () => {
    const germanFormatter = new Intl.NumberFormat("de-DE");

    assert.equal(
      formatNumberInput("1234567", "de-DE"),
      germanFormatter.format(1234567),
      "German input formatting uses German thousands separators"
    );

    assert.equal(
      formatNumberInput("1.234.567", "de-DE"),
      germanFormatter.format(1234567),
      "Already formatted input is normalized while editing"
    );

    assert.equal(
      parseFormattedNumberInput(germanFormatter.format(1234567)),
      1234567,
      "Formatted input parses back to a plain count"
    );

    assert.equal(
      formatNumberInput("", "de-DE"),
      "",
      "Empty editable fields stay empty"
    );
  }
);

await test(
  "target dates use fixed month day year order",
  () => {
    const date = new Date(2027, 0, 13);

    assert.equal(
      formatMonthDayYear(date, "en-US"),
      "January 13, 2027"
    );

    assert.equal(
      formatMonthDayYear(date, "en-GB"),
      "January 13, 2027"
    );

    assert.equal(
      formatMonthDayYear(date, "es-ES"),
      "enero 13, 2027"
    );
  }
);

await test(
  "calendar month pages keep the focused month clear",
  () => {
    const july2026 = new Date(2026, 6, 1);
    const julyMonthIndex = getCalendarMonthIndex(july2026);
    const days = buildCalendarMonthDays(julyMonthIndex);

    assert.equal(days.length, 42);
    assert.deepEqual(days[0], {
      dateString: "2026-06-29",
      day: 29,
      monthIndex: julyMonthIndex - 1,
    });
    assert.deepEqual(days[41], {
      dateString: "2026-08-09",
      day: 9,
      monthIndex: julyMonthIndex + 1,
    });
    assert.equal(
      days.filter(day => day.monthIndex === julyMonthIndex).length,
      31,
      "July remains the focused month while adjacent dates provide context"
    );
    assert.equal(
      clampCalendarMonthIndex(
        julyMonthIndex + 12,
        julyMonthIndex - 3,
        julyMonthIndex
      ),
      julyMonthIndex,
      "A new practice cannot focus beyond its current final month"
    );
    assert.deepEqual(
      getCalendarLoadedMonthIndexes(
        julyMonthIndex,
        julyMonthIndex - 24,
        julyMonthIndex + 24
      ),
      [
        julyMonthIndex - 1,
        julyMonthIndex,
        julyMonthIndex + 1,
      ],
      "Only the focused month and its immediate neighbors stay rendered"
    );
    assert.equal(
      isPracticeCalendarDateEditable(
        "2026-07-25",
        "2026-07-26",
        "2026-07-30"
      ),
      false,
      "Days before practice creation are not editable"
    );
    assert.equal(
      isPracticeCalendarDateEditable(
        "2026-07-26",
        "2026-07-26",
        "2026-07-30"
      ),
      true,
      "The practice creation day is editable"
    );
    assert.deepEqual(
      getCalendarPagerMonthIndexes(
        julyMonthIndex,
        julyMonthIndex - 24,
        julyMonthIndex + 24
      ),
      Array.from(
        { length: 25 },
        (_, index) => julyMonthIndex - 12 + index
      ),
      "The pager keeps a bounded window around the focused month"
    );
    assert.deepEqual(
      getCalendarPagerMonthIndexes(
        julyMonthIndex,
        julyMonthIndex,
        julyMonthIndex + 24
      ),
      Array.from(
        { length: 13 },
        (_, index) => julyMonthIndex + index
      ),
      "The pager omits months outside the valid range"
    );
  }
);

await test(
  "custom image sync uses the production storage workflow",
  async () => {
    const calls = [];
    const deletedLocalUris = [];
    const sync = createCustomPracticeImageSyncCore({
      getBucket: () => ({
        async upload(path, bytes, options) {
          calls.push({ operation: "upload", path, bytes, options });
          return { error: null };
        },
        async createSignedUrl(path, expiresIn) {
          calls.push({ operation: "sign", path, expiresIn });
          return {
            data: { signedUrl: "https://example.test/image?token=test" },
            error: null,
          };
        },
        async list(path, options) {
          calls.push({ operation: "list", path, options });
          return {
            data: [{ name: "practice-1.jpg" }],
            error: null,
          };
        },
        async remove(paths) {
          calls.push({ operation: "remove", paths });
          return { error: null };
        },
      }),
      readLocalBytes: async (uri) => {
        calls.push({ operation: "read", uri });
        return new Uint8Array([1, 2, 3]);
      },
      downloadToLocal: async (url, practiceId) => {
        calls.push({ operation: "download", url, practiceId });
        return "file:///practice-images/downloaded.jpg";
      },
      deleteLocal: (uri) => {
        deletedLocalUris.push(uri);
      },
    });

    await sync.upload("user-1", "practice-1", "file:///source.jpg");
    assert.deepEqual(calls.slice(0, 2), [
      { operation: "read", uri: "file:///source.jpg" },
      {
        operation: "upload",
        path: "user-1/practice-1.jpg",
        bytes: new Uint8Array([1, 2, 3]),
        options: {
          cacheControl: "0",
          contentType: "image/jpeg",
          upsert: true,
        },
      },
    ]);

    assert.equal(
      await sync.download(
        "user-1",
        "practice-1",
        "2026-09-05T12:00:00.000Z"
      ),
      "file:///practice-images/downloaded.jpg"
    );
    assert.deepEqual(calls.slice(2, 4), [
      {
        operation: "sign",
        path: "user-1/practice-1.jpg",
        expiresIn: 60,
      },
      {
        operation: "download",
        url:
          "https://example.test/image?token=test&v=" +
          "2026-09-05T12%3A00%3A00.000Z",
        practiceId: "practice-1",
      },
    ]);

    await sync.remove("user-1", "practice-1");
    await sync.removeAllForUser("user-1");
    sync.deleteLocal("file:///source.jpg");

    assert.deepEqual(calls.slice(4), [
      {
        operation: "remove",
        paths: ["user-1/practice-1.jpg"],
      },
      {
        operation: "list",
        path: "user-1",
        options: { limit: 100 },
      },
      {
        operation: "remove",
        paths: ["user-1/practice-1.jpg"],
      },
    ]);
    assert.deepEqual(deletedLocalUris, ["file:///source.jpg"]);
  }
);

await test(
  "calendar sheet dismisses only for an intentional downward drag",
  () => {
    assert.equal(shouldDismissSheetFromDrag(95, 0.2, 600), true);
    assert.equal(shouldDismissSheetFromDrag(25, 0.9, 600), true);
    assert.equal(shouldDismissSheetFromDrag(25, 0.2, 600), false);
    assert.equal(shouldDismissSheetFromDrag(-100, 2, 600), false);
  }
);

await test(
  "restored reminders request notification permission before scheduling",
  async () => {
    await withPracticeReminderServiceHarness(
      async (practiceReminderService, state) => {
        const practiceId = "restored-reminder-practice";

        await practiceReminderService.restorePracticeReminderBackupData(
          [
            {
              practiceId,
              enabled: true,
              hour: 20,
              minute: 30,
            },
          ],
          new Set([practiceId])
        );

        await practiceReminderService.refreshPracticeReminderSchedule({
          practiceId,
          practiceName: "Restored reminder",
          todayCount: 0,
          dailyTargetCount: 108,
        });

        assert.equal(
          state.permissionRequests,
          1,
          "A restored enabled reminder requests notification permission"
        );
        assert.ok(
          state.scheduledNotifications > 0,
          "The reminder schedules after permission is granted"
        );

        await practiceReminderService.refreshPracticeReminderSchedule({
          practiceId,
          practiceName: "Restored reminder",
          todayCount: 0,
          dailyTargetCount: 108,
        });

        assert.equal(
          state.permissionRequests,
          1,
          "Already granted permission is not requested again"
        );
      }
    );
  }
);

await test(
  "fresh Android installs request permission for synced reminders when allowed",
  async () => {
    await withPracticeReminderServiceHarness(
      async (practiceReminderService, state) => {
        const practiceId = "fresh-install-synced-reminder";

        // Android can initially describe an ungranted permission as denied
        // while canAskAgain still indicates that the app may show the prompt.
        state.permissionStatus = "denied";
        state.permissionCanAskAgain = true;

        await practiceReminderService.restorePracticeReminderBackupData(
          [
            {
              practiceId,
              enabled: true,
              hour: 20,
              minute: 30,
            },
          ],
          new Set([practiceId])
        );

        await practiceReminderService.refreshPracticeReminderSchedule({
          practiceId,
          practiceName: "Synced reminder",
          todayCount: 0,
          dailyTargetCount: 108,
        });

        assert.equal(
          state.permissionRequests,
          1,
          "A fresh install must show the Android permission prompt"
        );
        assert.ok(
          state.scheduledNotifications > 0,
          "The synced reminder schedules after permission is granted"
        );
      }
    );
  }
);

await test(
  "notification refusal disables every reminder and explicit retries can enable one",
  async () => {
    await withPracticeReminderServiceHarness(
      async (practiceReminderService, state) => {
        const practiceId = "denied-reminder-practice";
        const otherPracticeId = "other-enabled-reminder-practice";

        state.permissionRequestStatus = "denied";

        await practiceReminderService.restorePracticeReminderBackupData(
          [
            {
              practiceId,
              enabled: true,
              hour: 20,
              minute: 30,
            },
            {
              practiceId: otherPracticeId,
              enabled: true,
              hour: 8,
              minute: 0,
            },
          ],
          new Set([practiceId, otherPracticeId])
        );

        const refreshed =
          await practiceReminderService.refreshPracticeReminderSchedule({
            practiceId,
            practiceName: "Denied reminder",
            todayCount: 0,
            dailyTargetCount: 108,
          });

        assert.equal(state.permissionRequests, 1);
        assert.equal(refreshed.enabled, false);
        assert.deepEqual(refreshed.scheduledNotifications, []);
        assert.equal(
          (
            await practiceReminderService
              .getPracticeReminderSettings(otherPracticeId)
          ).enabled,
          false,
          "Refusing Android notifications disables every practice reminder"
        );

        state.permissionStatus = "undetermined";

        await practiceReminderService.refreshPracticeReminderSchedule({
          practiceId,
          practiceName: "Denied reminder",
          todayCount: 0,
          dailyTargetCount: 108,
        });

        assert.equal(
          state.permissionRequests,
          1,
          "A background refresh must not reopen a denied permission prompt"
        );

        state.permissionStatus = "denied";
        state.permissionCanAskAgain = false;

        const blocked =
          await practiceReminderService
            .requestPracticeReminderPermission();

        assert.equal(blocked, "blocked");
        assert.equal(
          state.permissionRequests,
          1,
          "Android cannot reopen a native prompt after blocking requests"
        );

        state.permissionStatus = "undetermined";
        state.permissionCanAskAgain = true;

        const declinedAgain =
          await practiceReminderService
            .requestPracticeReminderPermission();

        assert.equal(declinedAgain, "denied");
        assert.equal(
          state.permissionRequests,
          2,
          "An explicit enable attempt asks Android again"
        );

        state.permissionRequestStatus = "granted";
        state.permissionStatus = "denied";

        const accepted =
          await practiceReminderService
            .requestPracticeReminderPermission();

        assert.equal(accepted, "granted");
        assert.equal(state.permissionRequests, 3);

        const granted =
          await practiceReminderService.savePracticeReminderSettings({
            practiceId,
            practiceName: "Denied reminder",
            todayCount: 0,
            dailyTargetCount: 108,
            hour: 20,
            minute: 30,
          });

        assert.equal(granted.enabled, true);
        assert.ok(
          granted.scheduledNotifications.length > 0,
          "The selected reminder can be enabled after permission is granted"
        );
      }
    );
  }
);

await test(
  "reminders reschedule when the phone timezone changes",
  async () => {
    const originalTimezone = process.env.TZ;

    try {
      await withPracticeReminderServiceHarness(
        async (practiceReminderService, state) => {
          const practiceId = "travel-reminder-practice";

          process.env.TZ = "UTC";
          await practiceReminderService.restorePracticeReminderBackupData(
            [
              {
                practiceId,
                enabled: true,
                hour: 20,
                minute: 30,
              },
            ],
            new Set([practiceId])
          );
          await practiceReminderService.refreshPracticeReminderSchedule({
            practiceId,
            practiceName: "Travel reminder",
            todayCount: 0,
            dailyTargetCount: 108,
          });

          const firstScheduleCount = state.scheduledNotifications;

          process.env.TZ = "America/Los_Angeles";
          await practiceReminderService.refreshPracticeReminderSchedule({
            practiceId,
            practiceName: "Travel reminder",
            todayCount: 0,
            dailyTargetCount: 108,
          });

          assert.ok(
            state.scheduledNotifications > firstScheduleCount,
            "The absolute trigger instants are replaced for the new local timezone"
          );
        }
      );
    } finally {
      if (originalTimezone === undefined) {
        delete process.env.TZ;
      } else {
        process.env.TZ = originalTimezone;
      }
    }
  }
);

await test(
  "reminder time picker centers the nearest localized half-hour",
  () => {
    assert.deepEqual(
      roundUpToNextHalfHour(new Date(2026, 0, 1, 13, 0, 0, 0)),
      { hour: 13, minute: 0 }
    );
    assert.deepEqual(
      roundUpToNextHalfHour(new Date(2026, 0, 1, 13, 0, 1, 0)),
      { hour: 13, minute: 30 }
    );
    assert.deepEqual(
      roundUpToNextHalfHour(new Date(2026, 0, 1, 23, 45, 0, 0)),
      { hour: 0, minute: 0 }
    );
    assert.deepEqual(
      roundToNearestHalfHour(new Date(2026, 0, 1, 20, 31, 0, 0)),
      { hour: 20, minute: 30 }
    );
    assert.deepEqual(
      roundToNearestHalfHour(new Date(2026, 0, 1, 20, 46, 0, 0)),
      { hour: 21, minute: 0 }
    );

    const options = buildReminderTimeOptions(
      new Date(2026, 0, 1, 20, 31, 0, 0)
    );

    assert.deepEqual(
      options
        .slice(23, 26)
        .map(({ hour, minute }) => ({ hour, minute })),
      [
        { hour: 20, minute: 0 },
        { hour: 20, minute: 30 },
        { hour: 21, minute: 0 },
      ]
    );

    assert.match(
      formatReminderTimeForLocale(19, 0, "en-US"),
      /^7:00\s?PM$/i
    );
    assert.equal(
      formatReminderTimeForLocale(19, 0, "es-ES"),
      "19:00"
    );
    assert.equal(
      formatReminderTimeForLocale(19, 0, "en-US", true),
      "19:00"
    );
  }
);

await test(
  "initial language detection follows supported device language",
  () => {
    assert.equal(
      detectSupportedLanguageFromLocale({
        languageCode: "es",
        regionCode: "US",
      }),
      "es"
    );

    assert.equal(
      detectSupportedLanguageFromLocale({
        languageCode: "ru",
      }),
      "ru"
    );
    assert.equal(
      detectSupportedLanguageFromLocale({
        languageCode: "de",
      }),
      "de"
    );
    assert.equal(
      detectSupportedLanguageFromLocale({
        languageTag: "pl-PL",
      }),
      "pl"
    );
    assert.equal(
      detectSupportedLanguageFromLocale({
        languageCode: "cs",
      }),
      "cs"
    );
    assert.equal(
      detectSupportedLanguageFromLocale({
        languageTag: "hu-HU",
      }),
      "hu"
    );

    assert.equal(
      detectSupportedLanguageFromLocale({
        languageCode: "en",
        regionCode: "MX",
      }),
      "en"
    );

    assert.equal(
      detectSupportedLanguageFromLocale({
        languageCode: "it",
      }),
      "en"
    );
  }
);

await test(
  "initial language preference respects first installs and one-time locale migration",
  () => {
    assert.deepEqual(
      resolveInitialLanguagePreference({
        detectedLanguage: "de",
        migrationApplied: false,
        savedLanguage: null,
        savedLanguageSource: null,
      }),
      {
        language: "de",
        source: "auto",
        shouldMarkMigration: true,
        shouldPersistLanguage: true,
      },
      "Fresh installs should use a supported device language"
    );

    assert.deepEqual(
      resolveInitialLanguagePreference({
        detectedLanguage: "de",
        migrationApplied: false,
        savedLanguage: "en",
        savedLanguageSource: null,
      }),
      {
        language: "de",
        source: "auto",
        shouldMarkMigration: true,
        shouldPersistLanguage: true,
      },
      "Legacy auto-English installs should migrate once to supported non-English languages"
    );

    assert.equal(
      resolveInitialLanguagePreference({
        detectedLanguage: "es",
        migrationApplied: false,
        savedLanguage: "en",
        savedLanguageSource: null,
      }).language,
      "es",
      "The one-time migration also covers existing supported locales"
    );

    assert.deepEqual(
      resolveInitialLanguagePreference({
        detectedLanguage: "pl",
        migrationApplied: false,
        savedLanguage: "en",
        savedLanguageSource: "manual",
      }),
      {
        language: "en",
        source: "manual",
        shouldMarkMigration: true,
        shouldPersistLanguage: false,
      },
      "Manual English choices should not be auto-overridden"
    );

    assert.deepEqual(
      resolveInitialLanguagePreference({
        detectedLanguage: "hu",
        migrationApplied: true,
        savedLanguage: "en",
        savedLanguageSource: null,
      }),
      {
        language: "en",
        source: "auto",
        shouldMarkMigration: false,
        shouldPersistLanguage: true,
      },
      "The locale migration should not keep running after it is marked"
    );

    assert.deepEqual(
      resolveInitialLanguagePreference({
        detectedLanguage: "cs",
        migrationApplied: false,
        savedLanguage: "es",
        savedLanguageSource: null,
      }),
      {
        language: "es",
        source: "auto",
        shouldMarkMigration: true,
        shouldPersistLanguage: true,
      },
      "Existing non-English supported choices should be preserved"
    );
  }
);
