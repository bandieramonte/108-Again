import * as practiceRepo from "../repositories/practiceRepo"
import * as authService from "../services/authService"
import { seedPracticesCore } from "./seedEngine"

export function seedPractices() {
  seedPracticesCore({
    getCurrentUserId: authService.getCurrentUserId,
    practiceRepo,
  })
}
