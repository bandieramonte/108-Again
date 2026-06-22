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
const { validateBackup } =
  require("../.build/services/backupService.js");
const { createLastPracticeScreenService } =
  require("../.build/services/lastPracticeScreenService.js");
const { formatCountProgress } =
  require("../.build/utils/numberUtils.js");

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
