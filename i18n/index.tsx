import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Localization from "expo-localization";
import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
    type ReactNode,
} from "react";
import { en, type TranslationKey } from "./locales/en";
import { es } from "./locales/es";
import { ru } from "./locales/ru";

export type LanguageCode = "en" | "es" | "ru";

type TranslationParams = Record<string, number | string | null | undefined>;

type I18nContextValue = {
    language: LanguageCode;
    locale: string;
    setLanguage: (language: LanguageCode) => Promise<void>;
    t: (key: TranslationKey, params?: TranslationParams) => string;
};

const LANGUAGE_STORAGE_KEY = "preferredLanguage";

const resources: Record<LanguageCode, Record<TranslationKey, string>> = {
    en,
    es,
    ru,
};

const localeByLanguage: Record<LanguageCode, string> = {
    en: "en-GB",
    es: "es-ES",
    ru: "ru-RU",
};

const spanishRegions = new Set([
    "AR",
    "BO",
    "CL",
    "CO",
    "CR",
    "CU",
    "DO",
    "EC",
    "ES",
    "GQ",
    "GT",
    "HN",
    "MX",
    "NI",
    "PA",
    "PE",
    "PR",
    "PY",
    "SV",
    "UY",
    "VE",
]);

const russianRegions = new Set(["RU"]);

export const languageOptions: {
    code: LanguageCode;
    flag: string;
    labelKey: TranslationKey;
}[] = [
        {
            code: "en",
            flag: "🇬🇧",
            labelKey: "language.english",
        },
        {
            code: "es",
            flag: "🇪🇸",
            labelKey: "language.spanish",
        },
        {
            code: "ru",
            flag: "🇷🇺",
            labelKey: "language.russian",
        },
    ];

function isLanguageCode(value: string | null): value is LanguageCode {
    return value === "en" || value === "es" || value === "ru";
}

function detectDeviceLanguage(): LanguageCode {
    const locale = Localization.getLocales()[0];
    const languageCode = locale?.languageCode?.toLowerCase();
    const regionCode = locale?.regionCode?.toUpperCase();

    if (
        languageCode === "es" ||
        (regionCode != null && spanishRegions.has(regionCode))
    ) {
        return "es";
    }

    if (
        languageCode === "ru" ||
        (regionCode != null && russianRegions.has(regionCode))
    ) {
        return "ru";
    }

    return "en";
}

function interpolate(template: string, params?: TranslationParams) {
    if (!params) return template;

    return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key) => {
        const value = params[key];

        if (value == null) return match;

        return String(value);
    });
}

const fallbackContext: I18nContextValue = {
    language: "en",
    locale: localeByLanguage.en,
    setLanguage: async () => { },
    t: (key, params) => interpolate(en[key] ?? key, params),
};

const I18nContext =
    createContext<I18nContextValue>(fallbackContext);

export function I18nProvider({ children }: { children: ReactNode }) {
    const [language, setLanguageState] =
        useState<LanguageCode>(() => detectDeviceLanguage());

    useEffect(() => {
        let active = true;

        void AsyncStorage
            .getItem(LANGUAGE_STORAGE_KEY)
            .then(savedLanguage => {
                if (!active || !isLanguageCode(savedLanguage)) return;
                setLanguageState(savedLanguage);
            });

        return () => {
            active = false;
        };
    }, []);

    const setLanguage = useCallback(async (nextLanguage: LanguageCode) => {
        setLanguageState(nextLanguage);
        await AsyncStorage.setItem(
            LANGUAGE_STORAGE_KEY,
            nextLanguage
        );
    }, []);

    const value = useMemo<I18nContextValue>(() => {
        const messages = resources[language];

        return {
            language,
            locale: localeByLanguage[language],
            setLanguage,
            t: (key, params) =>
                interpolate(
                    messages[key] ?? resources.en[key] ?? key,
                    params
                ),
        };
    }, [language, setLanguage]);

    return (
        <I18nContext.Provider value={value}>
            {children}
        </I18nContext.Provider>
    );
}

export function useI18n() {
    return useContext(I18nContext);
}
