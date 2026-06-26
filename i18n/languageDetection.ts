export type LanguageCode = "en" | "es" | "ru";

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

    return "en";
}
