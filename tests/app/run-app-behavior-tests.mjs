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
const { createLastPracticeScreenService } =
  require("../.build/services/lastPracticeScreenService.js");

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
