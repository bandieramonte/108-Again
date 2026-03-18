import { randomUUID } from "expo-crypto";
import { db } from "../database/db";
import * as practiceRepo from "../repositories/practiceRepo";
import * as sessionRepo from "../repositories/sessionRepo";
import { emit } from "../utils/events";

export function createPractice(name: string, target: number, defaultAddCount: number = 108) {

    const orderResult = practiceRepo.getMaxOrderIndex();
    const nextOrder = (orderResult.maxOrder ?? 0) + 1;

    practiceRepo.insertPractice(
        randomUUID(),
        name,
        target,
        nextOrder,
        null,
        defaultAddCount
    );
    emit();
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
    emit();
}

export function deletePractice(id: string) {
    db.execSync("BEGIN TRANSACTION");
    sessionRepo.deleteSessionsByPractice(id);
    practiceRepo.deletePractice(id);
    db.execSync("COMMIT");
    emit();
}

export function getPracticeEditData(id: string) {

    const practice = practiceRepo.getPracticeById(id);

    const totalResult = sessionRepo.getPracticeTotal(id);

    return {
        name: practice.name,
        targetCount: practice.targetCount,
        total: totalResult.total,
        defaultAddCount: practice.defaultAddCount ?? 108
    };
}

export function getPracticeName(id: string) {
    return practiceRepo.getPracticeName(id);
}

export function getPractice(id: string) {
    return practiceRepo.getPracticeById(id);
}

export function getAllPractices() {
    return practiceRepo.getAllPractices();
}

export function updatePracticeDefaultAddCount(id: string, defaultAddCount: number) {
    practiceRepo.updatePracticeDefaultAddCount(id, defaultAddCount);
    emit();
}