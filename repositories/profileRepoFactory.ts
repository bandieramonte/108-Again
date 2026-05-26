import type { SqliteDatabase } from "../database/sqliteTypes";

export type UserProfileRow = {
    userId: string;
    email: string | null;
    firstName: string | null;
    updatedAt: number;
};

export function createProfileRepo(database: SqliteDatabase) {
    function upsertUserProfile(
        userId: string,
        email: string | null,
        firstName: string | null,
        updatedAt: number
    ) {
        database.runSync(
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

    function getUserProfileById(userId: string): UserProfileRow | null {
        const rows = database.getAllSync(
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

    function deleteUserProfileById(userId: string) {
        database.runSync(
            `DELETE FROM user_profile WHERE userId = ?`,
            userId
        );
    }

    return {
        deleteUserProfileById,
        getUserProfileById,
        upsertUserProfile,
    };
}

export type ProfileRepository = ReturnType<typeof createProfileRepo>;
