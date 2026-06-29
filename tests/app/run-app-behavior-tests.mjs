import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
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
const { validateBackup } =
  require("../.build/services/backupService.js");
const { redirectSystemPath } =
  require("../.build/app/+native-intent.js");
const { establishPasswordRecoverySessionCore } =
  require("../.build/services/authAccountActions.js");
const { isUnrecoverableRefreshTokenError } =
  require("../.build/services/authSessionPolicy.js");
const { determineUpdateRequirement } =
  require("../.build/services/appUpdatePolicy.js");
const { createLastPracticeScreenService } =
  require("../.build/services/lastPracticeScreenService.js");
const { createSyncCoordinator } =
  require("../.build/services/syncCoordinator.js");
const { createSyncEngine } =
  require("../.build/services/syncEngine.js");
const { detectSupportedLanguageFromLocale } =
  require("../.build/i18n/languageDetection.js");
const { formatMonthDayYear } =
  require("../.build/utils/dateUtils.js");
const { formatCountProgress } =
  require("../.build/utils/numberUtils.js");
const { getPracticeReminderSettingsFromPractice } =
  require("../.build/utils/practiceReminderState.js");
const {
  buildReminderTimeOptions,
  formatReminderTimeForLocale,
  roundUpToNextHalfHour,
} =
  require("../.build/utils/reminderTime.js");

Module._load = originalLoad;

function normalizeParams(params) {
  if (params.length === 1 && Array.isArray(params[0])) return params[0];
  return params;
}

function createBetterSqliteDatabase() {
  const raw = new BetterSqlite3(":memory:");

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

  const operations = createAppOperationEngine({
    appMetaRepo,
    deletedRecordRepo,
    emitDataChanged: () => {},
    enqueueWrite: async (fn) => {
      await fn();
    },
    getCurrentUserId: () => currentUserId,
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

function createSyncEngineForDevice(device, remote, now = () => Date.now()) {
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
  });
}

let testIndex = 0;

async function test(name, fn) {
  await fn();
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
  const state = {
    appAccessBlocked: false,
    authInvalidEvents: 0,
    createdEngines: 0,
    executedSyncs: [],
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

      return {
        executeSync: async (userId, mode) => {
          state.executedSyncs.push({ mode, userId });
        },
        resolveSyncMode: (_userId, requestedMode) =>
          requestedMode ?? "merge_local",
      };
    },
    emitAuthInvalid: () => {
      state.authInvalidEvents += 1;
    },
    emitDataChanged: () => {},
    emitSyncChanged: () => {},
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
  "new practices disable daily targets and default sessions to 108",
  () => {
    const device = makeLocalDevice();
    const practiceId = device.operations.createPractice(
      "Default Count Practice",
      10000
    );
    const practice = device.practiceRepo.getPracticeById(practiceId);

    assert.equal(practice.dailyTargetCount, null);
    assert.equal(practice.defaultSessionCount, 108);
  }
);

await test(
  "update policy distinguishes optional and mandatory releases",
  () => {
    assert.deepEqual(
      determineUpdateRequirement({
        currentVersionCode: 24,
        policy: basePolicy,
        playUpdate: null,
      }),
      {
        kind: "required",
        reason: "minimum-version",
        availableVersionCode: 30,
        message:
          "This version of 108 Again is no longer supported. Please update to continue.",
      }
    );

    assert.deepEqual(
      determineUpdateRequirement({
        currentVersionCode: 28,
        policy: basePolicy,
        playUpdate: null,
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
        playUpdate: null,
      }),
      { kind: "none" }
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
      playUpdate: null,
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

    const newlyBlocked = createSyncCoordinatorHarness();
    newlyBlocked.state.remoteAccessStatus = "blocked";

    assert.equal(
      await newlyBlocked.coordinator.syncNow("user-blocked"),
      "update_required"
    );
    assert.equal(newlyBlocked.state.remoteAccessChecks, 1);
    assert.equal(newlyBlocked.state.executedSyncs.length, 0);

    const policyUnavailable = createSyncCoordinatorHarness();
    policyUnavailable.state.remoteAccessStatus = "unavailable";

    assert.equal(
      await policyUnavailable.coordinator.syncNow("user-unavailable"),
      "policy_unavailable"
    );
    assert.equal(policyUnavailable.state.remoteAccessChecks, 1);
    assert.equal(policyUnavailable.state.executedSyncs.length, 0);
    assert.equal(policyUnavailable.coordinator.getSyncState(), "error");

    const deleted = createSyncCoordinatorHarness();
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
    const source = makeLocalDevice();
    const practiceId = source.operations.createPractice(
      "Backup Count Practice",
      10000,
      500,
      125
    );
    const backup = source.operations.getBackupData();
    const exportedPractice = backup.practices.find(
      (practice) => practice.id === practiceId
    );

    assert.equal(exportedPractice.dailyTargetCount, 500);
    assert.equal(exportedPractice.defaultSessionCount, 125);
    assert.doesNotThrow(() => validateBackup(backup));

    const destination = makeLocalDevice();
    await destination.operations.restoreBackupData(backup);

    const restoredPractice = destination.practiceRepo.getPracticeById(
      practiceId
    );
    assert.equal(restoredPractice.dailyTargetCount, 500);
    assert.equal(restoredPractice.defaultSessionCount, 125);
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
      "loving-eyes"
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
      "loving-eyes"
    );

    const backup = source.operations.getBackupData();
    const exportedSecondPractice = backup.practices.find(
      practice => practice.id === secondPracticeId
    );

    assert.equal(exportedSecondPractice.imageKey, "loving-eyes");
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
      "loving-eyes"
    );
  }
);

await test(
  "custom practice images can be edited while seed images stay fixed",
  async () => {
    const device = makeLocalDevice();
    const practiceId = device.operations.createPractice(
      "Editable Image Practice",
      10000,
      null,
      108,
      "green-tara"
    );

    let editData = device.operations.getPracticeEditData(practiceId);
    assert.equal(editData.imageKey, "green-tara");
    assert.equal(editData.isSeedPractice, false);

    device.operations.updatePractice(
      practiceId,
      "Editable Image Practice",
      10000,
      0,
      "white-liberatrice"
    );

    assert.equal(
      device.practiceRepo.getPracticeById(practiceId).imageKey,
      "white-liberatrice"
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
      /Default practice images cannot be changed/
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
    const device = makeLocalDevice();

    await device.operations.restoreDefaults();
    device.operations.reorderPractices(
      DEFAULT_PRACTICES.map(practice => practice.id).reverse()
    );

    assert.deepEqual(
      device.practiceRepo.getAllPractices().map(practice => practice.id),
      DEFAULT_PRACTICES.map(practice => practice.id).reverse()
    );

    await device.operations.restoreDefaults();

    assert.deepEqual(
      device.practiceRepo.getAllPractices().map(practice => practice.id),
      DEFAULT_PRACTICES.map(practice => practice.id)
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
  "reminder time picker starts at the next localized half-hour slot",
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

    const options = buildReminderTimeOptions(
      new Date(2026, 0, 1, 13, 11, 0, 0),
      3
    );

    assert.deepEqual(
      options.map(({ hour, minute }) => ({ hour, minute })),
      [
        { hour: 13, minute: 30 },
        { hour: 14, minute: 0 },
        { hour: 14, minute: 30 },
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
