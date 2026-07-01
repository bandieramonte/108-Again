import type { TranslationKey } from "../i18n/locales/en";

export const practiceImages: Record<string, any> = {
    "short-refuge": require("../assets/practice-icons/short-refuge.png"),
    "prostrations": require("../assets/practice-icons/prostrations.png"),
    "diamond-mind": require("../assets/practice-icons/diamond-mind.png"),
    "mandala": require("../assets/practice-icons/mandala.png"),
    "guru-yoga": require("../assets/practice-icons/guru-yoga.png"),
    "amitabha": require("../assets/practice-icons/extra/amitabha.png"),
    "generic": require("../assets/practice-icons/extra/generic.png"),
    "16th-karmapa": require("../assets/practice-icons/extra/16th-karmapa.png"),
    "chenrezig": require("../assets/practice-icons/extra/chenrezig.png"),
    "green-tara": require("../assets/practice-icons/extra/green-tara.png"),
    "white-tara": require("../assets/practice-icons/extra/white-tara.png"),
    "loving-eyes": require("../assets/practice-icons/extra/chenrezig.png"),
    "white-liberatrice": require("../assets/practice-icons/extra/white-tara.png"),
};

const legacyPracticeImageKeyMap: Record<string, string> = {
    "loving-eyes": "chenrezig",
    "white-liberatrice": "white-tara",
};

export function normalizePracticeImageKey(
    imageKey: string | null | undefined
) {
    if (!imageKey) return imageKey;

    return legacyPracticeImageKeyMap[imageKey] ?? imageKey;
}

export const extraPracticeImageOptions = [
    {
        key: "amitabha",
        labelKey: "seedPractice.amitabha",
        defaultName: "Amitabha",
    },
    {
        key: "16th-karmapa",
        labelKey: "practiceImage.sixteenthKarmapa",
        defaultName: "16th Karmapa",
    },
    {
        key: "green-tara",
        labelKey: "practiceImage.greenTara",
        defaultName: "Green Tara",
    },
    {
        key: "chenrezig",
        labelKey: "practiceImage.lovingEyes",
        defaultName: "Chenrezig",
    },
    {
        key: "white-tara",
        labelKey: "practiceImage.whiteLiberatrice",
        defaultName: "White Tara",
    },
] satisfies readonly {
    key: string;
    labelKey: TranslationKey;
    defaultName: string;
}[];

export const mantraCounterImageOptions = [
    ...extraPracticeImageOptions,
    {
        key: "generic",
        labelKey: "practiceImage.other",
        defaultName: "Other",
    },
] satisfies readonly {
    key: string;
    labelKey: TranslationKey;
    defaultName: string;
}[];
