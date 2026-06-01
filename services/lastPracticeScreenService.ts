import AsyncStorage from "@react-native-async-storage/async-storage";

const LAST_PRACTICE_SCREEN_KEY = "lastPracticeContentPracticeId";

type LastPracticeStorage = {
    getItem(key: string): Promise<string | null>;
    removeItem(key: string): Promise<void>;
    setItem(key: string, value: string): Promise<void>;
};

type PracticeExists = (practiceId: string) => boolean;

export function createLastPracticeScreenService(
    storage: LastPracticeStorage
) {
    async function rememberLastPracticeScreen(
        practiceId: string
    ) {
        await storage.setItem(
            LAST_PRACTICE_SCREEN_KEY,
            practiceId
        );
    }

    async function getLastPracticeScreen() {
        return storage.getItem(LAST_PRACTICE_SCREEN_KEY);
    }

    async function clearLastPracticeScreen() {
        await storage.removeItem(LAST_PRACTICE_SCREEN_KEY);
    }

    async function getRestorableLastPracticeScreen(
        practiceExists: PracticeExists
    ) {
        const practiceId = await getLastPracticeScreen();

        if (!practiceId) return null;

        if (!practiceExists(practiceId)) {
            await clearLastPracticeScreen();
            return null;
        }

        return practiceId;
    }

    async function clearLastPracticeScreenIfNonPracticePath(
        pathname: string
    ) {
        if (pathname.startsWith("/practice")) return;

        await clearLastPracticeScreen();
    }

    return {
        clearLastPracticeScreen,
        clearLastPracticeScreenIfNonPracticePath,
        getLastPracticeScreen,
        getRestorableLastPracticeScreen,
        rememberLastPracticeScreen,
    };
}

const service = createLastPracticeScreenService(AsyncStorage);

export const clearLastPracticeScreen =
    service.clearLastPracticeScreen;
export const clearLastPracticeScreenIfNonPracticePath =
    service.clearLastPracticeScreenIfNonPracticePath;
export const getLastPracticeScreen =
    service.getLastPracticeScreen;
export const getRestorableLastPracticeScreen =
    service.getRestorableLastPracticeScreen;
export const rememberLastPracticeScreen =
    service.rememberLastPracticeScreen;
