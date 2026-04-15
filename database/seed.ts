import { SyncMetadata } from "@/types/sync"
import { DEFAULT_PRACTICES } from "../constants/defaultPractices"
import * as practiceRepo from "../repositories/practiceRepo"
import * as authService from "../services/authService"

export function seedPractices() {

  const existing = practiceRepo.getAllPractices()

  if (existing.length > 0) return

  const userId = authService.getCurrentUserId()
  const now = Date.now()

  const syncMetadata: SyncMetadata = {
    userId,
    updatedAt: now,
    syncStatus: userId ? "pending" : "synced",
    lastSyncedAt: userId ? null : now,
  }

  DEFAULT_PRACTICES.forEach(p => {
    practiceRepo.insertPractice(
      p.id,
      p.name,
      p.targetCount,
      p.orderIndex,
      syncMetadata,
      p.imageKey,
      p.defaultAddCount ?? 108,
      p.totalOffset ?? 0
    )
  })
}