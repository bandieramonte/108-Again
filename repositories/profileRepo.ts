import { db } from "@/database/db";

export type UserProfileRow = {
    userId: string;
    email: string | null;
    firstName: string | null;
    updatedAt: number;
};

export function upsertUserProfile(
    userId: string,
    email: string | null,
    firstName: string | null,
    updatedAt: number
) {
    db.runSync(
        `
      INSERT INTO user_profile (userId, email, firstName, updatedAt)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(userId) DO UPDATE SET
        email = excluded.email,
        firstName = excluded.firstName,
        updatedAt = excluded.updatedAt
    `,
        userId,
        email,
        firstName,
        updatedAt
    );
}

export function getUserProfileById(userId: string): UserProfileRow | null {
    const rows = db.getAllSync(
        `
      SELECT userId, email, firstName, updatedAt
      FROM user_profile
      WHERE userId = ?
      LIMIT 1
    `,
        userId
    ) as UserProfileRow[];

    return rows[0] ?? null;
}

export function deleteUserProfileById(userId: string) {
    db.runSync(
        `DELETE FROM user_profile WHERE userId = ?`,
        userId
    );
}