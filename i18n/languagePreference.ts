import type { LanguageCode } from "./languageDetection";

export type StoredLanguageSource = "auto" | "manual";

type ResolveInitialLanguagePreferenceInput = {
    detectedLanguage: LanguageCode;
    migrationApplied: boolean;
    savedLanguage: string | null;
    savedLanguageSource: string | null;
};

type InitialLanguagePreference = {
    language: LanguageCode;
    source: StoredLanguageSource;
    shouldMarkMigration: boolean;
    shouldPersistLanguage: boolean;
};

const autoMigrationLanguages = new Set<LanguageCode>([
    "es",
    "ru",
    "de",
    "pl",
    "cs",
    "hu",
]);

export function isLanguageCode(
    value: string | null
): value is LanguageCode {
    return (
        value === "en" ||
        value === "es" ||
        value === "ru" ||
        value === "de" ||
        value === "pl" ||
        value === "cs" ||
        value === "hu"
    );
}

function isStoredLanguageSource(
    value: string | null
): value is StoredLanguageSource {
    return value === "auto" || value === "manual";
}

function isAutoMigrationLanguage(
    language: LanguageCode
) {
    return autoMigrationLanguages.has(language);
}

export function resolveInitialLanguagePreference({
    detectedLanguage,
    migrationApplied,
    savedLanguage,
    savedLanguageSource,
}: ResolveInitialLanguagePreferenceInput): InitialLanguagePreference {
    const validSavedLanguage = isLanguageCode(savedLanguage)
        ? savedLanguage
        : null;
    const validSavedSource = isStoredLanguageSource(savedLanguageSource)
        ? savedLanguageSource
        : null;

    if (!validSavedLanguage) {
        return {
            language: detectedLanguage,
            source: "auto",
            shouldMarkMigration: true,
            shouldPersistLanguage: true,
        };
    }

    const shouldMigrateLegacyEnglish =
        !migrationApplied &&
        validSavedSource !== "manual" &&
        validSavedLanguage === "en" &&
        isAutoMigrationLanguage(detectedLanguage);

    if (shouldMigrateLegacyEnglish) {
        return {
            language: detectedLanguage,
            source: "auto",
            shouldMarkMigration: true,
            shouldPersistLanguage: true,
        };
    }

    return {
        language: validSavedLanguage,
        source: validSavedSource ?? "auto",
        shouldMarkMigration: !migrationApplied,
        shouldPersistLanguage: validSavedSource == null,
    };
}
