import { randomUUID } from "expo-crypto"
import { DEFAULT_PRACTICES } from "../constants/defaultPractices"
import { db } from "./db"

export function seedPractices() {
  const result = db.getAllSync("SELECT * FROM practices")

  if (result.length === 0) {
    DEFAULT_PRACTICES.forEach(p => {
      db.runSync(
        "INSERT INTO practices (id, name, targetCount, orderIndex, imageKey, defaultAddCount) VALUES (?, ?, ?, ?, ?, ?)",
        randomUUID(),
        p.name,
        p.targetCount,
        p.orderIndex,
        p.imageKey,
        p.defaultAddCount ?? 108
      )
    })
  }
}