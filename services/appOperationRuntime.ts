import type { createAppOperationEngine } from "./appOperationEngine";

type AppOperationEngine = ReturnType<typeof createAppOperationEngine>;
type AppOperationEngineFactory = () => AppOperationEngine;

declare const require: {
    (path: string): {
        createConcreteAppOperationEngine: AppOperationEngineFactory;
    };
};

let factoryOverride: AppOperationEngineFactory | null = null;

export function setAppOperationEngineFactoryForTests(
    factory: AppOperationEngineFactory | null
) {
    factoryOverride = factory;
}

export function getAppOperationEngine(): AppOperationEngine {
    if (factoryOverride) {
        return factoryOverride();
    }

    return require("./appOperationDeps")
        .createConcreteAppOperationEngine();
}
