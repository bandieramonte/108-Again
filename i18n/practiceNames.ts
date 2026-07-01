import { DEFAULT_PRACTICES } from "../constants/defaultPractices";
import type { TranslationKey } from "./locales/en";

type Translate = (key: TranslationKey) => string;

const seedPracticeNameKeyById: Record<string, TranslationKey> = {
    "11111111-1111-1111-1111-111111111001": "seedPractice.shortRefuge",
    "11111111-1111-1111-1111-111111111002": "seedPractice.prostrations",
    "11111111-1111-1111-1111-111111111003": "seedPractice.diamondMind",
    "11111111-1111-1111-1111-111111111004": "seedPractice.mandala",
    "11111111-1111-1111-1111-111111111005": "seedPractice.guruYoga",
};

const defaultSeedNameById = new Map(
    DEFAULT_PRACTICES.map(practice => [
        practice.id,
        practice.name,
    ])
);

export function getPracticeDisplayName(
    practiceId: string,
    storedName: string,
    t: Translate
) {
    const translationKey = seedPracticeNameKeyById[practiceId];
    const defaultSeedName = defaultSeedNameById.get(practiceId);

    if (!translationKey || storedName !== defaultSeedName) {
        return storedName;
    }

    return t(translationKey);
}
