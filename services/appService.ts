import { db, initializeDatabase } from "../database/db";
import { seedPractices } from "../database/seed";
import * as practiceRepo from "../repositories/practiceRepo";
import * as sessionRepo from "../repositories/sessionRepo";
import { emit } from "../utils/events";

export function initializeApp() {

    initializeDatabase();

    const existing = db.getAllSync(
        `SELECT COUNT(*) as count FROM practices`
    ) as { count: number }[];

    if (existing[0].count === 0) {
        seedPractices();
    }

}

export function restoreDefaults() {
    db.execSync("BEGIN TRANSACTION");

    try {
        sessionRepo.deleteAllSessions();
        practiceRepo.deleteAllPractices();
        seedPractices();

        db.execSync("COMMIT");
        emit();
    } catch (error) {
        db.execSync("ROLLBACK");
        throw error;
    }
}