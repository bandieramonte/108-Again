import { db } from "../database/db";

type PracticeRow = {
    id: string;
    name: string;
    targetCount: number;
    orderIndex: number;
    imageKey?: string | null;
};

type MaxOrderRow = {
    maxOrder: number | null;
};

export function getPracticeById(id: string): PracticeRow {
    return db.getAllSync(
        `SELECT id, name, targetCount, orderIndex, imageKey
         FROM practices
         WHERE id = ?`,
        id
    )[0] as PracticeRow;
}

export function getAllPractices(): PracticeRow[] {
    return db.getAllSync(
        `SELECT id, name, targetCount, orderIndex, imageKey FROM practices ORDER BY orderIndex`
    ) as PracticeRow[];
}

export function insertPractice(id: string, name: string, target: number, orderIndex: number, imageKey?: string | null): void {
    db.runSync(
        `INSERT INTO practices (id,name,targetCount,orderIndex, imageKey) VALUES (?,?,?,?,?)`,
        id,
        name,
        target,
        orderIndex,
        imageKey ?? null
    );
}

export function updatePractice(id: string, name: string, target: number): void {
    db.runSync(
        `UPDATE practices SET name=?, targetCount=? WHERE id=?`,
        name,
        target,
        id
    );
}

export function deletePractice(id: string): void {
    db.runSync(`DELETE FROM practices WHERE id=?`, id);
}

export function getMaxOrderIndex(): MaxOrderRow {
    return db.getAllSync(`SELECT MAX(orderIndex) as maxOrder FROM practices`)[0] as MaxOrderRow;
}

export function getPracticeName(id: string) {
    const result = db.getAllSync(
        `SELECT name FROM practices WHERE id = ?`,
        id
    ) as { name: string }[];

    return result.length > 0 ? result[0].name : null;
}

export function deleteAllPractices() {
    db.execSync(`DELETE FROM practices`);
}