import { db } from "@/database/db";
import { createProfileRepo } from "./profileRepoFactory";

export {
    createProfileRepo,
    type ProfileRepository,
    type UserProfileRow,
} from "./profileRepoFactory";

const defaultRepo = createProfileRepo(db);

export const {
    deleteUserProfileById,
    getUserProfileById,
    upsertUserProfile,
} = defaultRepo;
