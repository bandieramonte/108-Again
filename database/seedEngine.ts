import { DEFAULT_PRACTICES } from "../constants/defaultPractices";
import type { SyncMetadata } from "../types/sync";

type SeedPracticeRepo = {
  getAllPractices(): unknown[];
  insertPractice(
    id: string,
    name: string,
    target: number,
    orderIndex: number,
    syncMetadata: SyncMetadata,
    imageKey?: string | null,
    dailyTargetCount?: number | null,
    defaultSessionCount?: number,
    totalOffset?: number
  ): void;
};

export type SeedPracticesDeps = {
  getCurrentUserId: () => string | null;
  now?: () => number;
  practiceRepo: SeedPracticeRepo;
};

export function seedPracticesCore(deps: SeedPracticesDeps) {
  const existing = deps.practiceRepo.getAllPractices();

  if (existing.length > 0) return;

  const userId = deps.getCurrentUserId();
  const seededAt = (deps.now ?? Date.now)();

  const syncMetadata: SyncMetadata = {
    userId,
    updatedAt: seededAt,
    syncStatus: userId ? "pending" : "synced",
    lastSyncedAt: userId ? null : seededAt,
  };

  DEFAULT_PRACTICES.forEach((practice) => {
    deps.practiceRepo.insertPractice(
      practice.id,
      practice.name,
      practice.targetCount,
      practice.orderIndex,
      syncMetadata,
      practice.imageKey,
      practice.dailyTargetCount ?? null,
      practice.defaultSessionCount ?? 108,
      practice.totalOffset ?? 0
    );
  });
}
