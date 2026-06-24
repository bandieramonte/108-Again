import type { createAppOperationEngine } from "./appOperationEngine";

type AppOperationEngine = ReturnType<typeof createAppOperationEngine>;
type AppOperationEngineFactory = () => AppOperationEngine;

declare const require: {
    (path: string): {
        createConcreteAppOperationEngine: AppOperationEngineFactory;
    };
};

export function getAppOperationEngine(): AppOperationEngine {
    return require("./appOperationDeps")
        .createConcreteAppOperationEngine();
}
