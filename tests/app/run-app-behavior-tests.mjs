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
    async removeItem(key) {
      store.delete(key);
    },
    async setItem(key, value) {
      store.set(key, value);
    },
  };
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
const { isUnrecoverableRefreshTokenError } =
  require("../.build/services/authSessionPolicy.js");
const { determineUpdateRequirement } =
  require("../.build/services/appUpdatePolicy.js");
const { createLastPracticeScreenService } =
  require("../.build/services/lastPracticeScreenService.js");
const { createSyncCoordinator } =
  require("../.build/services/syncCoordinator.js");

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

function makeLocalDevice() {
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
    getCurrentUserId: () => null,
    now: () => Date.now(),
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
    operations,
    practiceExists: (practiceId) =>
      !!practiceRepo.getPracticeById(practiceId),
    practiceRepo,
  };
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
  "practice content route restores only while last focused route was practice",
  async () => {
    const device = makeLocalDevice();
    const routeMemory = createLastPracticeScreenService(createMemoryStorage());
    const practiceId = device.operations.createPractice(
      "Route Test Practice",
      1000,
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
