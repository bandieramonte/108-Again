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
import {
    detectSupportedLanguageFromLocale,
    type LanguageCode,
} from "./languageDetection";
import {
    resolveInitialLanguagePreference,
    type StoredLanguageSource,
} from "./languagePreference";
import { en, type TranslationKey } from "./locales/en";
import { es } from "./locales/es";
import { ru } from "./locales/ru";
import { de } from "./locales/de";
import { pl } from "./locales/pl";
import { cs } from "./locales/cs";
import { hu } from "./locales/hu";

export type { LanguageCode } from "./languageDetection";

type TranslationParams = Record<string, number | string | null | undefined>;

type I18nContextValue = {
    language: LanguageCode;
    locale: string;
    setLanguage: (language: LanguageCode) => Promise<void>;
    t: (key: TranslationKey, params?: TranslationParams) => string;
};

const LANGUAGE_STORAGE_KEY = "preferredLanguage";
const LANGUAGE_SOURCE_STORAGE_KEY = "preferredLanguageSource";
const LANGUAGE_LOCALE_MIGRATION_KEY =
    "preferredLanguageLocaleMigrationApplied";
const LEGACY_LANGUAGE_LOCALE_MIGRATION_KEY =
    "preferredLanguageLocaleMigration.v1";
const TRUE_STORAGE_VALUE = "true";

const resources: Record<LanguageCode, Record<TranslationKey, string>> = {
    en,
    es,
    ru,
    de,
    pl,
    cs,
    hu,
};

const localeByLanguage: Record<LanguageCode, string> = {
    en: "en-GB",
    es: "es-ES",
    ru: "ru-RU",
    de: "de-DE",
    pl: "pl-PL",
    cs: "cs-CZ",
    hu: "hu-HU",
};

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
        {
            code: "de",
            flag: "🇩🇪",
            labelKey: "language.german",
        },
        {
            code: "pl",
            flag: "🇵🇱",
            labelKey: "language.polish",
        },
        {
            code: "cs",
            flag: "🇨🇿",
            labelKey: "language.czech",
        },
        {
            code: "hu",
            flag: "🇭🇺",
            labelKey: "language.hungarian",
        },
    ];

function detectDeviceLanguage(): LanguageCode {
    return detectSupportedLanguageFromLocale(Localization.getLocales()[0]);
}

async function persistLanguagePreference(
    language: LanguageCode,
    source: StoredLanguageSource
) {
    await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    await AsyncStorage.setItem(LANGUAGE_SOURCE_STORAGE_KEY, source);
}

async function markLanguageLocaleMigrationApplied() {
    await AsyncStorage.setItem(
        LANGUAGE_LOCALE_MIGRATION_KEY,
        TRUE_STORAGE_VALUE
    );
}

async function resolveStoredOrDetectedLanguage() {
    const detectedLanguage = detectDeviceLanguage();

    try {
        const [
            savedLanguage,
            savedLanguageSource,
            migrationAppliedValue,
            legacyMigrationAppliedValue,
        ] = await Promise.all([
            AsyncStorage.getItem(LANGUAGE_STORAGE_KEY),
            AsyncStorage.getItem(LANGUAGE_SOURCE_STORAGE_KEY),
            AsyncStorage.getItem(LANGUAGE_LOCALE_MIGRATION_KEY),
            AsyncStorage.getItem(LEGACY_LANGUAGE_LOCALE_MIGRATION_KEY),
        ]);
        const migrationApplied =
            migrationAppliedValue === TRUE_STORAGE_VALUE ||
            legacyMigrationAppliedValue === TRUE_STORAGE_VALUE;
        const preference = resolveInitialLanguagePreference({
            detectedLanguage,
            migrationApplied,
            savedLanguage,
            savedLanguageSource,
        });
        const writes: Promise<void>[] = [];

        if (preference.shouldPersistLanguage) {
            writes.push(
                persistLanguagePreference(
                    preference.language,
                    preference.source
                )
            );
        }

        if (
            preference.shouldMarkMigration ||
            (
                migrationApplied &&
                migrationAppliedValue !== TRUE_STORAGE_VALUE
            )
        ) {
            writes.push(markLanguageLocaleMigrationApplied());
        }

        if (writes.length > 0) {
            await Promise.all(writes);
        }

        return preference.language;
    } catch {
        return detectedLanguage;
    }
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

        void (async () => {
            const nextLanguage =
                await resolveStoredOrDetectedLanguage();

            if (!active) return;

            setLanguageState(nextLanguage);
        })();

        return () => {
            active = false;
        };
    }, []);

    const setLanguage = useCallback(async (nextLanguage: LanguageCode) => {
        setLanguageState(nextLanguage);

        await persistLanguagePreference(nextLanguage, "manual");
        await markLanguageLocaleMigrationApplied();
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

export function getLocaleForLanguage(language: LanguageCode) {
    return localeByLanguage[language];
}

export function translateForLanguage(
    language: LanguageCode,
    key: TranslationKey,
    params?: TranslationParams
) {
    const messages = resources[language] ?? resources.en;

    return interpolate(
        messages[key] ?? resources.en[key] ?? key,
        params
    );
}

export async function getStoredOrDetectedLanguage(): Promise<LanguageCode> {
    return resolveStoredOrDetectedLanguage();
}

export async function getRuntimeI18n() {
    const language = await getStoredOrDetectedLanguage();

    return {
        language,
        locale: getLocaleForLanguage(language),
        t: (key: TranslationKey, params?: TranslationParams) =>
            translateForLanguage(language, key, params),
    };
}
