import { db } from "../database/db";
import { createAppMetaRepo } from "./appMetaRepoFactory";

export {
  createAppMetaRepo,
  type AppMetaRepository,
} from "./appMetaRepoFactory";

const defaultRepo = createAppMetaRepo(db);

export const {
  clearLocalDataOwnerUserId,
  deleteMeta,
  getLocalDataOwnerUserId,
  getMeta,
  setLocalDataOwnerUserId,
  setMeta,
} = defaultRepo;
