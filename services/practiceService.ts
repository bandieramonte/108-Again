import { randomUUID } from "expo-crypto";
import { db } from "../database/db";
import * as practiceRepo from "../repositories/practiceRepo";
import * as sessionRepo from "../repositories/sessionRepo";

export function createPractice(name: string, target: number) {

    const orderResult = practiceRepo.getMaxOrderIndex();
    const nextOrder = (orderResult.maxOrder ?? 0) + 1;

    practiceRepo.insertPractice(
        randomUUID(),
        name,
        target,
        nextOrder
    );
}

export function updatePractice(id: string, name: string, target: number, newTotal: number) {

    const currentTotalResult = sessionRepo.getPracticeTotal(id);
    const currentTotal = currentTotalResult.total;

    const difference = newTotal - currentTotal;

    practiceRepo.updatePractice(id, name, target);

    if (difference !== 0) {
        sessionRepo.insertSession(
            randomUUID(),
            id,
            difference,
            Date.now(),
            1,   // adjustment
            0   // does not affect analytics
        );
    }
}

export function deletePractice(id: string) {
    db.execSync("BEGIN TRANSACTION");
    sessionRepo.deleteSessionsByPractice(id);
    practiceRepo.deletePractice(id);
    db.execSync("COMMIT");
}

export function getPracticeEditData(id: string) {

    const practice = practiceRepo.getPracticeById(id);

    const totalResult = sessionRepo.getPracticeTotal(id);

    return {
        name: practice.name,
        targetCount: practice.targetCount,
        total: totalResult.total
    };
}

export function getPracticeName(id: string) {
    return practiceRepo.getPracticeName(id);
}