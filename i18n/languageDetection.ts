export type LanguageCode = "en" | "es" | "ru" | "de" | "pl" | "cs" | "hu";

type LocaleLike = {
    languageCode?: string | null;
    languageTag?: string | null;
};

export function detectSupportedLanguageFromLocale(
    locale?: LocaleLike | null
): LanguageCode {
    const languageCode = locale?.languageCode?.toLowerCase();
    const languageTag = locale?.languageTag?.toLowerCase();
    const primaryLanguage =
        languageCode ??
        languageTag?.split(/[-_]/)[0] ??
        null;

    if (primaryLanguage === "es") return "es";
    if (primaryLanguage === "ru") return "ru";
    if (primaryLanguage === "de") return "de";
    if (primaryLanguage === "pl") return "pl";
    if (primaryLanguage === "cs") return "cs";
    if (primaryLanguage === "hu") return "hu";

    return "en";
}
