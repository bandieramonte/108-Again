import type { UpdateRequirement } from "./appUpdatePolicy";

type OfflineFirstStartupDependencies = {
    initializeLocalApp(): Promise<void>;
    readCachedUpdateRequirement(): Promise<UpdateRequirement>;
    applyCachedUpdateRequirement(requirement: UpdateRequirement): void;
    checkRemoteUpdate(): Promise<unknown>;
};

/**
 * Starts all local services without waiting for a remote update check.
 * Only device-local work may delay the first rendered app screen.
 */
export async function initializeOfflineFirstStartup(
    deps: OfflineFirstStartupDependencies
) {
    const localInitialization = deps.initializeLocalApp();
    const cachedRequirement =
        await deps.readCachedUpdateRequirement();

    deps.applyCachedUpdateRequirement(cachedRequirement);
    await localInitialization;

    // The remote policy can still replace the cached decision (and show the
    // required-update screen), but it is never part of the local startup gate.
    void deps.checkRemoteUpdate();
}
