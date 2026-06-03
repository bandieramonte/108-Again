import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
const BetterSqlite3 = require("better-sqlite3");
const { createClient } = require("@supabase/supabase-js");
const { DEFAULT_PRACTICES, SEEDED_IDS } =
  require("../.build/constants/defaultPractices.js");
const { seedPracticesCore } =
  require("../.build/database/seedEngine.js");
const { initializeDatabaseSchema } =
  require("../.build/database/schema.js");
const { createAppMetaRepo } =
  require("../.build/repositories/appMetaRepoFactory.js");
const { createDeletedRecordRepo } =
  require("../.build/repositories/deletedRecordRepoFactory.js");
const { createPracticeRepo } =
  require("../.build/repositories/practiceRepoFactory.js");
const { createProfileRepo } =
  require("../.build/repositories/profileRepoFactory.js");
const { createSessionRepo } =
  require("../.build/repositories/sessionRepoFactory.js");
const {
  assertCanCreateAccountOnDevice,
  assertCanSignInOnDevice,
  ONE_ACCOUNT_PER_DEVICE_MESSAGE,
} = require("../.build/services/authAccountGuard.js");
const {
  deleteAccountCore,
  resetPasswordCore,
} = require("../.build/services/authAccountActions.js");
const { createAppOperationEngine } =
  require("../.build/services/appOperationEngine.js");
const { createSupabaseSyncRemote } =
  require("../.build/services/supabaseSyncRemote.js");
const { createSyncEngine } =
  require("../.build/services/syncEngine.js");

const TEST_EMAIL = "automatedTest@test.com";
const SECOND_TEST_EMAIL = "automatedTest2@test.com";
const THIRD_TEST_EMAIL = "automatedTest3@test.com";
const DELETE_ACCOUNT_TEST_EMAIL = "automatedDeleteTest@test.com";
const RESET_PASSWORD_TEST_EMAIL = "automatedResetTest@test.com";
const TEST_PASSWORD = "123456";
const TEST_PRACTICE_NAME = "testPractice1";
const SESSION_COUNT = 500;
const SEEDED_ID_LIST = [...SEEDED_IDS];
const AUTOMATED_TEST_EMAILS = new Set([
  TEST_EMAIL.toLowerCase(),
  SECOND_TEST_EMAIL.toLowerCase(),
  THIRD_TEST_EMAIL.toLowerCase(),
  DELETE_ACCOUNT_TEST_EMAIL.toLowerCase(),
  RESET_PASSWORD_TEST_EMAIL.toLowerCase(),
]);
const createdTestEmails = new Set();

function loadEnv() {
  const envPath = resolve(process.cwd(), ".env");

  if (!existsSync(envPath)) return;

  const content = readFileSync(envPath, "utf8");

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separator = trimmed.indexOf("=");
    if (separator < 0) continue;

    const key = trimmed.slice(0, separator);
    const value = trimmed.slice(separator + 1);
    process.env[key] = process.env[key] ?? value;
  }
}

function requiredEnv(name) {
  const env = process.env;
  const value = env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

function dayString(date) {
  return (
    date.getUTCFullYear() +
    "-" +
    String(date.getUTCMonth() + 1).padStart(2, "0") +
    "-" +
    String(date.getUTCDate()).padStart(2, "0")
  );
}

function utcDateDaysAgo(daysAgo) {
  const now = new Date();
  return new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() - daysAgo
  ));
}

function testDays() {
  return {
    today: dayString(utcDateDaysAgo(0)),
    yesterday: dayString(utcDateDaysAgo(1)),
    beforeYesterday: dayString(utcDateDaysAgo(2)),
  };
}

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

function makeLocalDevice(name, userId, remote) {
  const database = createBetterSqliteDatabase();
  initializeDatabaseSchema(database);

  const appMetaRepo = createAppMetaRepo(database);
  const deletedRecordRepo = createDeletedRecordRepo(database);
  const practiceRepo = createPracticeRepo(database);
  const profileRepo = createProfileRepo(database);
  const sessionRepo = createSessionRepo(database);

  const device = {
    appMetaRepo,
    database,
    deletedRecordRepo,
    name,
    practiceRepo,
    profileRepo,
    sessionRepo,
    userId,
  };

  if (userId) {
    appMetaRepo.setLocalDataOwnerUserId(userId);
  }

  device.operations = createAppOperationEngine({
    appMetaRepo,
    deletedRecordRepo,
    emitDataChanged: () => {},
    enqueueWrite: async (fn) => {
      await fn();
    },
    getCurrentUserId: () => device.userId,
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

  device.sync = async (mode) => {
    if (!device.userId) {
      throw new Error(`${device.name}: cannot sync without a user`);
    }

    const syncEngine = createSyncEngine({
      appMetaRepo,
      deletedRecordRepo,
      logger: silentLogger,
      practiceRepo,
      remote,
      sessionRepo,
    });

    await syncEngine.syncUserData(device.userId, mode);
  };

  device.attachAccount = (nextUserId, email = null, firstName = null) => {
    device.userId = nextUserId;
    appMetaRepo.setLocalDataOwnerUserId(nextUserId);

    if (email) {
      profileRepo.upsertUserProfile(
        nextUserId,
        email,
        firstName,
        Date.now()
      );
    }
  };

  device.signOutLocal = () => {
    device.userId = null;
  };

  device.loginExistingAndAutoSync = async (client, email, password) => {
    const user = await signIn(client, email, password);
    const accountEmail = user.email ?? email;

    assertCanSignInOnDevice(
      { appMetaRepo, profileRepo },
      user.id,
      accountEmail
    );

    const firstLoginOnDevice = !appMetaRepo.getLocalDataOwnerUserId();

    device.attachAccount(user.id, accountEmail);
    await device.sync(firstLoginOnDevice
      ? "remote_overwrite_local"
      : "merge_local");

    return user;
  };

  return device;
}

const silentLogger = {
  error: () => {},
  log: () => {},
  warn: () => {},
};

function makeSupabaseClient() {
  return createClient(
    requiredEnv("EXPO_PUBLIC_SUPABASE_URL"),
    requiredEnv("EXPO_PUBLIC_SUPABASE_ANON_KEY"),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    }
  );
}

function assertAutomatedTestEmail(email) {
  if (!AUTOMATED_TEST_EMAILS.has(email.toLowerCase())) {
    throw new Error(`Refusing to delete non-test account: ${email}`);
  }
}

async function deleteAutomatedAccountThroughCore(email, password) {
  assertAutomatedTestEmail(email);

  const client = makeSupabaseClient();
  const signIn = await signInWithRateLimitRetry(client, {
    email,
    password,
  });

  if (signIn.error) {
    const message = String(signIn.error.message ?? "").toLowerCase();
    if (message.includes("invalid") || message.includes("credentials")) {
      return;
    }

    throw signIn.error;
  }

  await deleteAccountCore({
    invokeDeleteUser: () => client.functions.invoke("delete-user"),
    isUserDeleted: async () => {
      const probeClient = makeSupabaseClient();
      const probe = await probeClient.auth.signInWithPassword({
        email,
        password,
      });

      return !!probe.error;
    },
    logger: silentLogger,
    signOutDeletedAccount: async () => {
      const signOut = await client.auth.signOut({
        scope: "local",
      });

      if (signOut.error) throw signOut.error;
    },
    withTimeout: async (promiseFactory) => promiseFactory(),
  });

  await new Promise((resolve) => setTimeout(resolve, 1000));
}

async function createAccount(client, email, password) {
  const signUp = await client.auth.signUp({
    email,
    password,
  });

  if (signUp.error) throw signUp.error;
  if (signUp.data.session?.user) {
    createdTestEmails.add(email.toLowerCase());
    return signUp.data.session.user;
  }

  const signIn = await client.auth.signInWithPassword({
    email,
    password,
  });

  if (signIn.error) throw signIn.error;
  if (!signIn.data.user) throw new Error("Supabase sign-in returned no user.");

  createdTestEmails.add(email.toLowerCase());

  return signIn.data.user;
}

async function signInWithRateLimitRetry(client, credentials) {
  let lastResult = null;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const result = await client.auth.signInWithPassword(credentials);
    lastResult = result;

    const status = result.error?.status;
    const code = result.error?.code;

    if (
      status !== 429 &&
      code !== "over_request_rate_limit"
    ) {
      return result;
    }

    await new Promise((resolve) =>
      setTimeout(resolve, (attempt + 1) * 5000)
    );
  }

  return lastResult;
}

async function cleanupCreatedTestAccounts() {
  const emails = [...createdTestEmails];
  createdTestEmails.clear();

  for (const email of emails) {
    await deleteAutomatedAccountThroughCore(email, TEST_PASSWORD);
  }
}

async function cleanupKnownAutomatedAccounts() {
  for (const email of AUTOMATED_TEST_EMAILS) {
    await deleteAutomatedAccountThroughCore(email, TEST_PASSWORD);
  }
}

async function signIn(client, email, password) {
  const result = await client.auth.signInWithPassword({
    email,
    password,
  });

  if (result.error) throw result.error;
  if (!result.data.user) throw new Error("Supabase sign-in returned no user.");

  return result.data.user;
}

function seedDefaultPractices(device) {
  seedPracticesCore({
    getCurrentUserId: () => device.userId,
    practiceRepo: device.practiceRepo,
  });
}

async function createFreshAccountFor(email) {
  loadEnv();

  const client = makeSupabaseClient();
  const user = await createAccount(
    client,
    email,
    TEST_PASSWORD
  );

  return {
    client,
    remote: createSupabaseSyncRemote(client),
    user,
  };
}

async function createFreshAccount() {
  return createFreshAccountFor(TEST_EMAIL);
}

async function createLoggedInDeviceA(options = {}) {
  const { client, remote, user } = await createFreshAccount();
  const device = makeLocalDevice("Device A", null, remote);

  if (options.seedDefaults) {
    seedDefaultPractices(device);
  }

  device.attachAccount(user.id, user.email ?? TEST_EMAIL);

  return {
    client,
    device,
    remote,
    user,
  };
}

async function createDeviceBForManualSync(options = {}) {
  const client = makeSupabaseClient();
  const user = await signIn(client, TEST_EMAIL, TEST_PASSWORD);
  const remote = createSupabaseSyncRemote(client);
  const device = makeLocalDevice("Device B", null, remote);

  if (options.seedDefaults) {
    seedDefaultPractices(device);
  }

  device.attachAccount(user.id, user.email ?? TEST_EMAIL);

  return {
    client,
    device,
    remote,
    user,
  };
}

function findPracticeByName(device, name) {
  return device.practiceRepo
    .getAllPractices()
    .find((practice) => practice.name === name);
}

function totalForPractice(device, practiceId) {
  return device.sessionRepo.getPracticeTotal(practiceId).total;
}

function sessionTotalsByDay(device, practiceId) {
  const totals = new Map();

  for (const session of device.sessionRepo.getAllSessionsForSync()) {
    if (session.practiceId !== practiceId) continue;

    const day = dayString(new Date(session.createdAt));
    totals.set(day, (totals.get(day) ?? 0) + session.count);
  }

  return totals;
}

async function pullRemoteSnapshot(remote, userId) {
  return {
    practices: await remote.pullPractices(userId),
    sessions: await remote.pullSessions(userId),
  };
}

function activeRemotePractices(snapshot) {
  return snapshot.practices
    .filter((practice) => !practice.deleted_at)
    .sort((a, b) => a.order_index - b.order_index);
}

function activeRemoteSessions(snapshot) {
  return snapshot.sessions
    .filter((session) => !session.deleted_at)
    .sort((a, b) =>
      new Date(a.created_at).getTime() -
      new Date(b.created_at).getTime()
    );
}

function activeRemotePracticeByName(snapshot, name) {
  return activeRemotePractices(snapshot)
    .find((practice) => practice.name === name);
}

function activeRemotePracticeById(snapshot, id) {
  return activeRemotePractices(snapshot)
    .find((practice) => practice.id === id);
}

function remotePracticeTotal(snapshot, practiceId) {
  const practice = activeRemotePracticeById(snapshot, practiceId);

  assert.ok(practice, `Remote has active practice ${practiceId}`);

  const sessionTotal = activeRemoteSessions(snapshot)
    .filter((session) => session.practice_id === practiceId)
    .reduce((sum, session) => sum + session.count, 0);

  return Math.max(0, sessionTotal + (practice.total_offset ?? 0));
}

function localPracticeTotal(device, practiceId) {
  return device.sessionRepo.getPracticeTotal(practiceId).total;
}

function activeLocalPractices(device) {
  return device.practiceRepo.getAllPractices()
    .sort((a, b) => a.orderIndex - b.orderIndex);
}

function captureExpectedLocalState(device) {
  return new Map(
    activeLocalPractices(device).map((practice) => [
      practice.id,
      {
        id: practice.id,
        name: practice.name,
        total: localPracticeTotal(device, practice.id),
      },
    ])
  );
}

function assertRemoteMatchesExpected(snapshot, expected, label) {
  const active = activeRemotePractices(snapshot);

  assert.equal(
    active.length,
    expected.size,
    `${label}: active remote practice count`
  );

  for (const [practiceId, expectedPractice] of expected) {
    const remotePractice = activeRemotePracticeById(snapshot, practiceId);

    assert.ok(
      remotePractice,
      `${label}: remote has ${expectedPractice.name}`
    );
    assert.equal(
      remotePractice.name,
      expectedPractice.name,
      `${label}: remote name for ${expectedPractice.name}`
    );
    assert.equal(
      remotePracticeTotal(snapshot, practiceId),
      expectedPractice.total,
      `${label}: remote total for ${expectedPractice.name}`
    );
  }
}

function assertDeviceMatchesExpected(device, expected, label) {
  const active = activeLocalPractices(device);

  assert.equal(
    active.length,
    expected.size,
    `${label}: active local practice count`
  );

  for (const [practiceId, expectedPractice] of expected) {
    const localPractice = device.practiceRepo.getPracticeById(practiceId);

    assert.ok(
      localPractice,
      `${label}: local has ${expectedPractice.name}`
    );
    assert.equal(
      localPractice.name,
      expectedPractice.name,
      `${label}: local name for ${expectedPractice.name}`
    );
    assert.equal(
      localPracticeTotal(device, practiceId),
      expectedPractice.total,
      `${label}: local total for ${expectedPractice.name}`
    );
  }
}

function assertRemotePracticeDeleted(snapshot, practiceId, label) {
  assert.equal(
    activeRemotePracticeById(snapshot, practiceId),
    undefined,
    `${label}: remote active practice is absent`
  );

  const remoteRow = snapshot.practices
    .find((practice) => practice.id === practiceId);

  if (remoteRow) {
    assert.ok(
      remoteRow.deleted_at,
      `${label}: remote row is soft deleted`
    );
  }
}

function assertRemotePracticeSessionsDeleted(snapshot, practiceId, label) {
  const activeSessions = activeRemoteSessions(snapshot)
    .filter((session) => session.practice_id === practiceId);

  assert.equal(
    activeSessions.length,
    0,
    `${label}: remote has no active sessions`
  );

  const remoteSessions = snapshot.sessions
    .filter((session) => session.practice_id === practiceId);

  for (const session of remoteSessions) {
    assert.ok(
      session.deleted_at,
      `${label}: remote session ${session.id} is soft deleted`
    );
  }
}

function assertOnlySeededRemoteZero(snapshot, label) {
  const active = activeRemotePractices(snapshot);
  const activeIds = new Set(active.map((practice) => practice.id));

  assert.equal(
    active.length,
    DEFAULT_PRACTICES.length,
    `${label}: active remote practice count`
  );

  for (const seededId of SEEDED_ID_LIST) {
    assert.ok(activeIds.has(seededId), `${label}: has seeded ${seededId}`);
    assert.equal(
      remotePracticeTotal(snapshot, seededId),
      0,
      `${label}: seeded total is zero for ${seededId}`
    );
  }
}

function assertOnlySeedIdsRemoteZero(snapshot, seedIds, label) {
  const active = activeRemotePractices(snapshot);
  const expectedIds = new Set(seedIds);
  const activeIds = new Set(active.map((practice) => practice.id));

  assert.equal(
    active.length,
    expectedIds.size,
    `${label}: active remote practice count`
  );

  for (const seededId of expectedIds) {
    assert.ok(activeIds.has(seededId), `${label}: has seeded ${seededId}`);
    assert.equal(
      remotePracticeTotal(snapshot, seededId),
      0,
      `${label}: seeded total is zero for ${seededId}`
    );
  }
}

function assertOnlySeededDeviceZero(device, label) {
  const active = activeLocalPractices(device);
  const activeIds = new Set(active.map((practice) => practice.id));

  assert.equal(
    active.length,
    DEFAULT_PRACTICES.length,
    `${label}: active local practice count`
  );

  for (const seededId of SEEDED_ID_LIST) {
    assert.ok(activeIds.has(seededId), `${label}: has seeded ${seededId}`);
    assert.equal(
      localPracticeTotal(device, seededId),
      0,
      `${label}: seeded total is zero for ${seededId}`
    );
  }
}

function createPrng(seed) {
  let state = seed >>> 0;

  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

async function signOutDeletedAccountForDevice(device, client, remote) {
  const signOut = await client.auth.signOut({
    scope: "local",
  });

  if (signOut.error) throw signOut.error;

  const syncEngine = createSyncEngine({
    appMetaRepo: device.appMetaRepo,
    deletedRecordRepo: device.deletedRecordRepo,
    logger: silentLogger,
    practiceRepo: device.practiceRepo,
    remote,
    sessionRepo: device.sessionRepo,
  });

  device.userId = null;
  device.appMetaRepo.clearLocalDataOwnerUserId();
  await syncEngine.resetLocalSyncState();
}

async function runDeviceAToDeviceBSupabaseSyncTest() {
  loadEnv();

  const deviceAClient = makeSupabaseClient();
  const userA = await createAccount(
    deviceAClient,
    TEST_EMAIL,
    TEST_PASSWORD
  );

  const deviceBClient = makeSupabaseClient();
  const userB = await signIn(
    deviceBClient,
    TEST_EMAIL,
    TEST_PASSWORD
  );

  assert.equal(userB.id, userA.id, "Device B logged in to the same account");

  const deviceA = makeLocalDevice(
    "Device A",
    userA.id,
    createSupabaseSyncRemote(deviceAClient)
  );
  const deviceB = makeLocalDevice(
    "Device B",
    userB.id,
    createSupabaseSyncRemote(deviceBClient)
  );

  const practiceId = deviceA.operations.createPractice(
    TEST_PRACTICE_NAME,
    1500,
    500
  );
  const days = testDays();

  deviceA.operations.addSession(practiceId, SESSION_COUNT);
  deviceA.operations.adjustDayTotal(
    practiceId,
    days.yesterday,
    SESSION_COUNT
  );
  deviceA.operations.adjustDayTotal(
    practiceId,
    days.beforeYesterday,
    SESSION_COUNT
  );

  assert.equal(
    totalForPractice(deviceA, practiceId),
    1500,
    "Device A local total is 1500 before sync"
  );

  await deviceA.sync("merge_local");
  await deviceB.sync("remote_overwrite_local");

  const syncedPractice = findPracticeByName(deviceB, TEST_PRACTICE_NAME);
  assert.ok(syncedPractice, "Device B has testPractice1 after manual sync");

  const sessionTotals = sessionTotalsByDay(deviceB, syncedPractice.id);
  assert.equal(sessionTotals.get(days.today), 500, "Device B has today's 500 session");
  assert.equal(sessionTotals.get(days.yesterday), 500, "Device B has yesterday's 500 session");
  assert.equal(
    sessionTotals.get(days.beforeYesterday),
    500,
    "Device B has before-yesterday's 500 session"
  );
  assert.equal(
    totalForPractice(deviceB, syncedPractice.id),
    1500,
    "Device B practice total is 1500"
  );
}

async function runLogoutOfflineLoginAutoSyncTest() {
  const { client: deviceAClient, device: deviceA, remote, user } =
    await createLoggedInDeviceA();

  const practiceId = deviceA.operations.createPractice(
    TEST_PRACTICE_NAME,
    1500,
    500
  );

  deviceA.operations.addSession(practiceId, 500);
  deviceA.signOutLocal();
  deviceA.operations.addSession(practiceId, 1000);

  await deviceA.loginExistingAndAutoSync(
    deviceAClient,
    TEST_EMAIL,
    TEST_PASSWORD
  );

  const remoteSnapshot = await pullRemoteSnapshot(remote, user.id);
  const remotePractice = activeRemotePracticeByName(
    remoteSnapshot,
    TEST_PRACTICE_NAME
  );

  assert.ok(remotePractice, "Remote has testPractice1 after login auto-sync");
  assert.equal(
    remotePracticeTotal(remoteSnapshot, remotePractice.id),
    1500,
    "Remote total is 1500 after login auto-sync"
  );

  const { device: deviceB } = await createDeviceBForManualSync({
    seedDefaults: true,
  });

  await deviceB.sync("remote_overwrite_local");

  const deviceBPractice = findPracticeByName(deviceB, TEST_PRACTICE_NAME);

  assert.ok(deviceBPractice, "Device B has testPractice1 after manual sync");
  assert.equal(
    localPracticeTotal(deviceB, deviceBPractice.id),
    1500,
    "Device B total is 1500 after manual sync"
  );
}

async function runExistingAccountFirstLoginRemoteOverwriteTest() {
  const { device: deviceA, remote, user } =
    await createLoggedInDeviceA();
  const localOnlyPracticeName = "localOnlyPractice";

  const remotePracticeId = deviceA.operations.createPractice(
    TEST_PRACTICE_NAME,
    5000,
    500
  );

  deviceA.operations.addSession(remotePracticeId, 700);
  deviceA.operations.updatePracticeDefaultAddCount(
    remotePracticeId,
    250
  );
  await deviceA.sync("merge_local");

  const deviceBClient = makeSupabaseClient();
  const deviceB = makeLocalDevice(
    "Device B",
    null,
    createSupabaseSyncRemote(deviceBClient)
  );

  seedDefaultPractices(deviceB);

  const localPracticeId = deviceB.operations.createPractice(
    localOnlyPracticeName,
    9999,
    333
  );

  deviceB.operations.addSession(localPracticeId, 999);

  await deviceB.loginExistingAndAutoSync(
    deviceBClient,
    TEST_EMAIL,
    TEST_PASSWORD
  );

  assert.equal(
    findPracticeByName(deviceB, localOnlyPracticeName),
    undefined,
    "First login discarded pre-login local-only practice"
  );

  for (const seededId of SEEDED_ID_LIST) {
    assert.equal(
      deviceB.practiceRepo.getPracticeById(seededId),
      null,
      `First login discarded pre-login seeded practice ${seededId}`
    );
  }

  const deviceBRemotePractice =
    deviceB.practiceRepo.getPracticeById(remotePracticeId);

  assert.ok(
    deviceBRemotePractice,
    "First login kept remote custom practice"
  );
  assert.equal(
    deviceBRemotePractice.defaultAddCount,
    250,
    "First login fetched updated default add count"
  );
  assert.equal(
    localPracticeTotal(deviceB, remotePracticeId),
    700,
    "First login fetched remote total"
  );

  const remoteSnapshot = await pullRemoteSnapshot(remote, user.id);

  assert.equal(
    activeRemotePracticeByName(remoteSnapshot, localOnlyPracticeName),
    undefined,
    "Remote was not polluted by pre-login local-only practice"
  );
  assert.equal(
    remotePracticeTotal(remoteSnapshot, remotePracticeId),
    700,
    "Remote total remains authoritative"
  );
}

async function runExistingAccountFirstLoginAfterBackupRestoreRemoteOverwriteTest() {
  const { device: deviceA, remote, user } =
    await createLoggedInDeviceA({ seedDefaults: true });
  const remoteDeletedSeed = DEFAULT_PRACTICES[2];
  const remoteKeptSeed = DEFAULT_PRACTICES[3];
  const backupDeletedSeed = DEFAULT_PRACTICES[4];
  const backupOnlyPracticeName = "backupOnlyPractice";

  const remotePracticeId = deviceA.operations.createPractice(
    TEST_PRACTICE_NAME,
    5000,
    500
  );

  deviceA.operations.addSession(remotePracticeId, 700);
  deviceA.operations.addSession(remoteKeptSeed.id, 222);
  await deviceA.operations.deletePractice(remoteDeletedSeed.id);

  const remoteExpected = captureExpectedLocalState(deviceA);

  await deviceA.sync("merge_local");

  const deviceBClient = makeSupabaseClient();
  const deviceB = makeLocalDevice(
    "Device B",
    null,
    createSupabaseSyncRemote(deviceBClient)
  );
  const backupOnlyPracticeId = randomUUID();
  const backupData = {
    app: "app108again",
    exportedAt: Date.now(),
    practices: [
      ...DEFAULT_PRACTICES
        .filter((practice) => practice.id !== backupDeletedSeed.id)
        .map((practice) => ({
          id: practice.id,
          name: practice.name,
          targetCount: practice.targetCount,
          orderIndex: practice.orderIndex,
          imageKey: practice.imageKey ?? null,
          defaultAddCount: practice.defaultAddCount ?? 108,
          totalOffset: 0,
        })),
      {
        id: backupOnlyPracticeId,
        name: backupOnlyPracticeName,
        targetCount: 9999,
        orderIndex: DEFAULT_PRACTICES.length + 1,
        imageKey: null,
        defaultAddCount: 333,
        totalOffset: 0,
      },
    ],
    sessions: [
      {
        id: randomUUID(),
        practiceId: backupOnlyPracticeId,
        count: 999,
        createdAt: Date.now(),
      },
      {
        id: randomUUID(),
        practiceId: DEFAULT_PRACTICES[0].id,
        count: 111,
        createdAt: Date.now(),
      },
    ],
  };

  await deviceB.operations.restoreBackupData(backupData);

  assert.equal(
    deviceB.appMetaRepo.getMeta("pendingBackupRestore"),
    "true",
    "Pre-login backup restore is marked as pending local data"
  );
  assert.equal(
    deviceB.appMetaRepo.getMeta("pendingBackupRestoreUserId"),
    null,
    "Pre-login backup restore is not owned by the existing account"
  );

  await deviceB.loginExistingAndAutoSync(
    deviceBClient,
    TEST_EMAIL,
    TEST_PASSWORD
  );

  assertDeviceMatchesExpected(
    deviceB,
    remoteExpected,
    "Device B after first login following backup import"
  );
  assert.equal(
    deviceB.practiceRepo.getPracticeById(remoteDeletedSeed.id),
    null,
    "First login after backup import keeps remote-deleted seed deleted"
  );
  assert.equal(
    findPracticeByName(deviceB, backupOnlyPracticeName),
    undefined,
    "First login after backup import discards backup-only practice"
  );

  const remoteSnapshot = await pullRemoteSnapshot(remote, user.id);

  assertRemoteMatchesExpected(
    remoteSnapshot,
    remoteExpected,
    "Remote after first login following backup import"
  );
  assertRemotePracticeDeleted(
    remoteSnapshot,
    remoteDeletedSeed.id,
    "Remote after first login following backup import deleted seed"
  );
  assert.equal(
    activeRemotePracticeByName(remoteSnapshot, backupOnlyPracticeName),
    undefined,
    "Remote was not polluted by backup-only practice"
  );
}

async function runDeletedSeededPracticeSyncTest() {
  const { device: deviceA, remote, user } =
    await createLoggedInDeviceA({ seedDefaults: true });
  const deletedSeed = DEFAULT_PRACTICES[0];

  await deviceA.sync("merge_local");
  await deviceA.operations.deletePractice(deletedSeed.id);
  await deviceA.sync("merge_local");

  const remoteSnapshot = await pullRemoteSnapshot(remote, user.id);

  assertRemotePracticeDeleted(
    remoteSnapshot,
    deletedSeed.id,
    "Deleted seeded practice"
  );

  const { device: deviceB } = await createDeviceBForManualSync({
    seedDefaults: true,
  });

  await deviceB.sync("remote_overwrite_local");

  assert.equal(
    deviceB.practiceRepo.getPracticeById(deletedSeed.id),
    null,
    "Device B does not have deleted seeded practice"
  );
}

async function runOneAccountPerDeviceGuardTest() {
  const primary = await createFreshAccountFor(TEST_EMAIL);
  const secondary = await createFreshAccountFor(SECOND_TEST_EMAIL);

  assert.notEqual(
    secondary.user.id,
    primary.user.id,
    "Test accounts are distinct Supabase users"
  );

  const device = makeLocalDevice(
    "Device A",
    null,
    primary.remote
  );

  await device.loginExistingAndAutoSync(
    primary.client,
    TEST_EMAIL,
    TEST_PASSWORD
  );

  const markerPracticeId = device.operations.createPractice(
    "ownerMarkerPractice",
    1000,
    100
  );

  assert.doesNotThrow(() => {
    assertCanSignInOnDevice(
      {
        appMetaRepo: device.appMetaRepo,
        profileRepo: device.profileRepo,
      },
      primary.user.id,
      TEST_EMAIL
    );
  }, "Device can sign back into its existing owner account");

  assert.throws(
    () => {
      assertCanCreateAccountOnDevice(
        {
          appMetaRepo: device.appMetaRepo,
          profileRepo: device.profileRepo,
        },
        THIRD_TEST_EMAIL
      );
    },
    (error) => {
      assert.equal(error.message, ONE_ACCOUNT_PER_DEVICE_MESSAGE);
      return true;
    },
    "Device cannot create a different account after ownership is set"
  );

  await assert.rejects(
    () => device.loginExistingAndAutoSync(
      secondary.client,
      SECOND_TEST_EMAIL,
      TEST_PASSWORD
    ),
    (error) => {
      assert.equal(error.message, ONE_ACCOUNT_PER_DEVICE_MESSAGE);
      return true;
    },
    "Device cannot log into a different account after ownership is set"
  );

  assert.equal(
    device.userId,
    primary.user.id,
    "Blocked login leaves local user id unchanged"
  );
  assert.equal(
    device.appMetaRepo.getLocalDataOwnerUserId(),
    primary.user.id,
    "Blocked login leaves local data owner unchanged"
  );
  assert.ok(
    device.practiceRepo.getPracticeById(markerPracticeId),
    "Blocked login does not replace local owner data"
  );
}

async function runResetPasswordCoreTest() {
  const { client } = await createFreshAccountFor(
    RESET_PASSWORD_TEST_EMAIL
  );

  await resetPasswordCore(
    {
      redirectTo: "app108again://reset-password",
      resetPasswordForEmail: (email, options) =>
        client.auth.resetPasswordForEmail(email, options),
    },
    `  ${RESET_PASSWORD_TEST_EMAIL.toUpperCase()}  `
  );

  await assert.rejects(
    () => resetPasswordCore(
      {
        redirectTo: "app108again://reset-password",
        resetPasswordForEmail: (email, options) =>
          client.auth.resetPasswordForEmail(email, options),
      },
      "   "
    ),
    /Email is required/,
    "Reset password validates blank email before remote call"
  );
}

async function runDeleteAccountCoreTest() {
  const { client, remote, user } = await createFreshAccountFor(
    DELETE_ACCOUNT_TEST_EMAIL
  );
  const device = makeLocalDevice(
    "Delete Account Device",
    null,
    remote
  );

  device.attachAccount(
    user.id,
    user.email ?? DELETE_ACCOUNT_TEST_EMAIL
  );

  const practiceId = device.operations.createPractice(
    "deleteAccountPractice",
    1000,
    100
  );

  device.operations.addSession(practiceId, 123);
  await device.sync("merge_local");

  let localCleanupRan = false;

  await deleteAccountCore({
    invokeDeleteUser: () => client.functions.invoke("delete-user"),
    isUserDeleted: async () => {
      const probeClient = makeSupabaseClient();
      const probe = await probeClient.auth.signInWithPassword({
        email: DELETE_ACCOUNT_TEST_EMAIL,
        password: TEST_PASSWORD,
      });

      return !!probe.error;
    },
    logger: silentLogger,
    signOutDeletedAccount: async () => {
      await signOutDeletedAccountForDevice(device, client, remote);
      localCleanupRan = true;
    },
    withTimeout: async (promiseFactory) => promiseFactory(),
  });

  assert.equal(
    localCleanupRan,
    true,
    "Delete account core ran local cleanup"
  );
  assert.equal(
    device.userId,
    null,
    "Delete account clears local auth state"
  );
  assert.equal(
    device.appMetaRepo.getLocalDataOwnerUserId(),
    null,
    "Delete account clears local owner"
  );

  const localPractice = device.practiceRepo.getPracticeById(practiceId);

  assert.ok(
    localPractice,
    "Delete account keeps local practice data on device"
  );
  assert.equal(
    localPractice.userId,
    null,
    "Delete account releases local practice ownership"
  );
  assert.equal(
    localPractice.syncStatus,
    "pending",
    "Delete account resets local practice sync state"
  );

  const deletedSignIn = await makeSupabaseClient()
    .auth
    .signInWithPassword({
      email: DELETE_ACCOUNT_TEST_EMAIL,
      password: TEST_PASSWORD,
    });

  assert.ok(
    deletedSignIn.error,
    "Deleted account can no longer sign in"
  );
}

async function runOfflineLocalDataNewAccountSyncTest() {
  loadEnv();

  const deviceAClient = makeSupabaseClient();
  const remote = createSupabaseSyncRemote(deviceAClient);
  const deviceA = makeLocalDevice("Device A", null, remote);
  const deletedSeed = DEFAULT_PRACTICES[3];
  const keptSeed = DEFAULT_PRACTICES[4];

  seedDefaultPractices(deviceA);

  await deviceA.operations.deletePractice(deletedSeed.id);

  const customPracticeId = deviceA.operations.createPractice(
    TEST_PRACTICE_NAME,
    6000,
    500
  );

  deviceA.operations.addSession(customPracticeId, 400);
  deviceA.operations.addSession(keptSeed.id, 300);

  const user = await createAccount(
    deviceAClient,
    TEST_EMAIL,
    TEST_PASSWORD
  );

  deviceA.attachAccount(user.id);
  await deviceA.sync("merge_local");

  const remoteSnapshot = await pullRemoteSnapshot(remote, user.id);
  const remoteCustom = activeRemotePracticeByName(
    remoteSnapshot,
    TEST_PRACTICE_NAME
  );

  assert.ok(
    remoteCustom,
    "New account sync pushed offline custom practice"
  );
  assert.equal(
    remotePracticeTotal(remoteSnapshot, remoteCustom.id),
    400,
    "New account sync pushed offline custom total"
  );
  assert.equal(
    remotePracticeTotal(remoteSnapshot, keptSeed.id),
    300,
    "New account sync pushed offline seeded session"
  );
  assertRemotePracticeDeleted(
    remoteSnapshot,
    deletedSeed.id,
    "New account sync pushed offline seeded deletion"
  );

  const { device: deviceB } = await createDeviceBForManualSync({
    seedDefaults: true,
  });

  await deviceB.sync("remote_overwrite_local");

  const deviceBCustom = findPracticeByName(deviceB, TEST_PRACTICE_NAME);

  assert.ok(
    deviceBCustom,
    "Device B fetched offline-created custom practice"
  );
  assert.equal(
    localPracticeTotal(deviceB, deviceBCustom.id),
    400,
    "Device B fetched offline-created custom total"
  );
  assert.equal(
    localPracticeTotal(deviceB, keptSeed.id),
    300,
    "Device B fetched offline seeded session"
  );
  assert.equal(
    deviceB.practiceRepo.getPracticeById(deletedSeed.id),
    null,
    "Device B does not resurrect offline-deleted seeded practice"
  );
}

async function runEditedTotalsSyncTest() {
  const { device: deviceA, remote, user } =
    await createLoggedInDeviceA({ seedDefaults: true });
  const seededPractice = DEFAULT_PRACTICES[1];

  const customPracticeId = deviceA.operations.createPractice(
    TEST_PRACTICE_NAME,
    10000,
    500
  );

  deviceA.operations.addSession(customPracticeId, 500);
  deviceA.operations.updatePractice(
    customPracticeId,
    TEST_PRACTICE_NAME,
    10000,
    5000
  );

  deviceA.operations.addSession(seededPractice.id, 2000);
  deviceA.operations.updatePractice(
    seededPractice.id,
    seededPractice.name,
    seededPractice.targetCount,
    0
  );
  deviceA.operations.addSession(seededPractice.id, 1000);

  await deviceA.sync("merge_local");

  const remoteSnapshot = await pullRemoteSnapshot(remote, user.id);
  const remoteCustom = activeRemotePracticeByName(
    remoteSnapshot,
    TEST_PRACTICE_NAME
  );

  assert.ok(remoteCustom, "Remote has edited custom practice");
  assert.equal(
    remotePracticeTotal(remoteSnapshot, remoteCustom.id),
    5000,
    "Remote custom practice total is 5000"
  );
  assert.equal(
    remotePracticeTotal(remoteSnapshot, seededPractice.id),
    1000,
    "Remote seeded practice total is 1000"
  );

  const { device: deviceB } = await createDeviceBForManualSync({
    seedDefaults: true,
  });

  await deviceB.sync("remote_overwrite_local");

  const deviceBCustom = findPracticeByName(deviceB, TEST_PRACTICE_NAME);

  assert.ok(deviceBCustom, "Device B has edited custom practice");
  assert.equal(
    localPracticeTotal(deviceB, deviceBCustom.id),
    5000,
    "Device B custom practice total is 5000"
  );
  assert.equal(
    localPracticeTotal(deviceB, seededPractice.id),
    1000,
    "Device B seeded practice total is 1000"
  );
}

async function runDeletedCustomPracticeSyncTest() {
  const { device: deviceA, remote, user } =
    await createLoggedInDeviceA();
  const days = testDays();

  const deletedPracticeId = deviceA.operations.createPractice(
    TEST_PRACTICE_NAME,
    4000,
    500
  );

  deviceA.operations.addSession(deletedPracticeId, 500);
  deviceA.operations.adjustDayTotal(
    deletedPracticeId,
    days.yesterday,
    250
  );
  await deviceA.sync("merge_local");

  let remoteSnapshot = await pullRemoteSnapshot(remote, user.id);

  assert.equal(
    remotePracticeTotal(remoteSnapshot, deletedPracticeId),
    750,
    "Remote has custom practice before deletion"
  );

  await deviceA.operations.deletePractice(deletedPracticeId);
  await deviceA.sync("merge_local");

  remoteSnapshot = await pullRemoteSnapshot(remote, user.id);

  assertRemotePracticeDeleted(
    remoteSnapshot,
    deletedPracticeId,
    "Deleted custom practice"
  );
  assertRemotePracticeSessionsDeleted(
    remoteSnapshot,
    deletedPracticeId,
    "Deleted custom practice"
  );

  const { device: deviceB } = await createDeviceBForManualSync();

  await deviceB.sync("remote_overwrite_local");

  assert.equal(
    deviceB.practiceRepo.getPracticeById(deletedPracticeId),
    null,
    "Device B does not have deleted custom practice"
  );
  assert.equal(
    deviceB.sessionRepo
      .getAllSessionsForSync()
      .filter((session) => session.practiceId === deletedPracticeId)
      .length,
    0,
    "Device B does not have deleted custom sessions"
  );
}

async function runBackupDefaultsAndRestoreBackupSyncTest() {
  const { device: deviceA, remote, user } =
    await createLoggedInDeviceA({ seedDefaults: true });
  const deletedSeed = DEFAULT_PRACTICES[2];
  const prng = createPrng(108);

  const customPracticeId = deviceA.operations.createPractice(
    TEST_PRACTICE_NAME,
    20000,
    500
  );

  await deviceA.operations.deletePractice(deletedSeed.id);

  for (const practice of activeLocalPractices(deviceA)) {
    const sessionCount = 1 + Math.floor(prng() * 10);

    for (let dayIndex = 0; dayIndex < sessionCount; dayIndex++) {
      const date = dayString(utcDateDaysAgo(dayIndex));
      const count = 100 + Math.floor(prng() * 900);

      deviceA.operations.adjustDayTotal(
        practice.id,
        date,
        count
      );
    }
  }

  for (const practice of activeLocalPractices(deviceA)) {
    const currentTotal = localPracticeTotal(deviceA, practice.id);
    const delta = Math.floor(prng() * 4000) - 1500;
    const editedTotal = Math.max(0, currentTotal + delta);

    deviceA.operations.updatePractice(
      practice.id,
      practice.name,
      practice.targetCount,
      editedTotal
    );
  }

  const backupData = deviceA.operations.getBackupData();
  const backupExpected = captureExpectedLocalState(deviceA);

  assert.ok(
    backupExpected.has(customPracticeId),
    "Backup expected state has custom practice"
  );
  assert.equal(
    backupExpected.has(deletedSeed.id),
    false,
    "Backup expected state excludes deleted seeded practice"
  );

  await deviceA.sync("merge_local");

  const remoteBackupSnapshot = await pullRemoteSnapshot(remote, user.id);

  assertRemoteMatchesExpected(
    remoteBackupSnapshot,
    backupExpected,
    "Remote after backup source sync"
  );
  assertRemotePracticeDeleted(
    remoteBackupSnapshot,
    deletedSeed.id,
    "Remote after backup source sync deleted seed"
  );

  const { device: deviceB } = await createDeviceBForManualSync({
    seedDefaults: true,
  });

  await deviceB.sync("remote_overwrite_local");
  assertDeviceMatchesExpected(
    deviceB,
    backupExpected,
    "Device B after backup source sync"
  );
  assert.equal(
    deviceB.practiceRepo.getPracticeById(deletedSeed.id),
    null,
    "Device B after backup source sync excludes deleted seed"
  );

  await deviceA.operations.restoreDefaults();
  await deviceA.sync("merge_local");

  const remoteDefaultsSnapshot = await pullRemoteSnapshot(remote, user.id);

  assertOnlySeededRemoteZero(
    remoteDefaultsSnapshot,
    "Remote after restore defaults"
  );

  await deviceB.sync("remote_overwrite_local");
  assertOnlySeededDeviceZero(
    deviceB,
    "Device B after restore defaults"
  );

  await deviceA.operations.restoreBackupData(backupData);
  await deviceA.sync("merge_local");

  const remoteRestoredBackupSnapshot =
    await pullRemoteSnapshot(remote, user.id);

  assertRemoteMatchesExpected(
    remoteRestoredBackupSnapshot,
    backupExpected,
    "Remote after backup import"
  );
  assertRemotePracticeDeleted(
    remoteRestoredBackupSnapshot,
    deletedSeed.id,
    "Remote after backup import deleted seed"
  );

  await deviceB.sync("remote_overwrite_local");
  assertDeviceMatchesExpected(
    deviceB,
    backupExpected,
    "Device B after backup import"
  );
  assert.equal(
    deviceB.practiceRepo.getPracticeById(deletedSeed.id),
    null,
    "Device B after backup import excludes deleted seed"
  );
}

async function runRestoreDefaultsAfterPartialSeedBackupSyncTest() {
  const { device: deviceA, remote, user } =
    await createLoggedInDeviceA({ seedDefaults: true });
  const backupSeedPractices = DEFAULT_PRACTICES.slice(0, 4);
  const backupSeedIds = backupSeedPractices.map((practice) => practice.id);
  const partialSeedBackup = {
    app: "app108again",
    exportedAt: Date.now(),
    practices: backupSeedPractices.map((practice) => ({
      id: practice.id,
      name: practice.name,
      targetCount: practice.targetCount,
      orderIndex: practice.orderIndex,
      imageKey: practice.imageKey ?? null,
      defaultAddCount: practice.defaultAddCount ?? 108,
      totalOffset: 0,
    })),
    sessions: [],
  };

  await deviceA.operations.restoreBackupData(partialSeedBackup);
  await deviceA.sync("merge_local");

  let remoteSnapshot = await pullRemoteSnapshot(remote, user.id);

  assertOnlySeedIdsRemoteZero(
    remoteSnapshot,
    backupSeedIds,
    "Remote after four-seed backup import"
  );
  assert.equal(
    activeLocalPractices(deviceA).length,
    backupSeedIds.length,
    "Device A has only the imported four seeded practices before defaults"
  );

  await deviceA.operations.restoreDefaults();

  assertOnlySeededDeviceZero(
    deviceA,
    "Device A immediately after restoring defaults from four-seed backup"
  );

  await deviceA.sync("merge_local");

  assertOnlySeededDeviceZero(
    deviceA,
    "Device A after syncing restored defaults from four-seed backup"
  );

  remoteSnapshot = await pullRemoteSnapshot(remote, user.id);

  assertOnlySeededRemoteZero(
    remoteSnapshot,
    "Remote after syncing restored defaults from four-seed backup"
  );

  const { device: deviceB } = await createDeviceBForManualSync({
    seedDefaults: true,
  });

  await deviceB.sync("remote_overwrite_local");

  assertOnlySeededDeviceZero(
    deviceB,
    "Device B after syncing restored defaults from four-seed backup"
  );
}

async function runRestoreDefaultsBeatsStaleRemoteOverwriteTest() {
  const { device: deviceA, remote, user } =
    await createLoggedInDeviceA({ seedDefaults: true });

  await deviceA.operations.restoreDefaults();

  assertOnlySeededDeviceZero(
    deviceA,
    "Device A immediately after logged-in restore defaults"
  );

  await deviceA.sync("remote_overwrite_local");

  assertOnlySeededDeviceZero(
    deviceA,
    "Device A after stale remote overwrite sync request"
  );

  const remoteSnapshot = await pullRemoteSnapshot(remote, user.id);

  assertOnlySeededRemoteZero(
    remoteSnapshot,
    "Remote after stale remote overwrite sync request"
  );

  const { device: deviceB } = await createDeviceBForManualSync({
    seedDefaults: true,
  });

  await deviceB.sync("remote_overwrite_local");

  assertOnlySeededDeviceZero(
    deviceB,
    "Device B after stale remote overwrite sync request"
  );
}

const tests = [
  [
    "Device A operations sync to Device B through Supabase",
    runDeviceAToDeviceBSupabaseSyncTest,
  ],
  [
    "offline session after logout syncs on login",
    runLogoutOfflineLoginAutoSyncTest,
  ],
  [
    "existing-account first login overwrites pre-login local data",
    runExistingAccountFirstLoginRemoteOverwriteTest,
  ],
  [
    "existing-account first login overwrites pre-login backup restore",
    runExistingAccountFirstLoginAfterBackupRestoreRemoteOverwriteTest,
  ],
  [
    "one account per device blocks different account login and signup",
    runOneAccountPerDeviceGuardTest,
  ],
  [
    "reset password core calls real Supabase reset flow",
    runResetPasswordCoreTest,
  ],
  [
    "delete account core deletes real Supabase account and clears local owner",
    runDeleteAccountCoreTest,
  ],
  [
    "offline local data and seeded deletion sync when creating account",
    runOfflineLocalDataNewAccountSyncTest,
  ],
  [
    "deleted seeded practice syncs to remote and Device B",
    runDeletedSeededPracticeSyncTest,
  ],
  [
    "edited custom and seeded practice totals sync",
    runEditedTotalsSyncTest,
  ],
  [
    "deleted custom practice and sessions sync to remote and Device B",
    runDeletedCustomPracticeSyncTest,
  ],
  [
    "backup, restore defaults, and backup import sync end to end",
    runBackupDefaultsAndRestoreBackupSyncTest,
  ],
  [
    "restore defaults restores all seeds after partial seeded backup import",
    runRestoreDefaultsAfterPartialSeedBackupSyncTest,
  ],
  [
    "restore defaults beats stale remote-overwrite sync",
    runRestoreDefaultsBeatsStaleRemoteOverwriteTest,
  ],
];

loadEnv();
await cleanupKnownAutomatedAccounts();

for (const [index, [name, test]] of tests.entries()) {
  let testError = null;
  let cleanupError = null;

  try {
    await test();
  } catch (error) {
    testError = error;
  }

  try {
    await cleanupCreatedTestAccounts();
  } catch (error) {
    cleanupError = error;
  }

  if (testError && cleanupError) {
    throw new AggregateError(
      [testError, cleanupError],
      `${name} failed and account cleanup also failed`
    );
  }

  if (testError) throw testError;
  if (cleanupError) throw cleanupError;

  console.log(`ok ${index + 1} - ${name}`);
}
