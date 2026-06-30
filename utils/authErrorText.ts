import type { TranslationKey } from "../i18n/locales/en";
import { ONE_ACCOUNT_PER_DEVICE_MESSAGE } from "../services/authAccountGuard";

type Translate = (key: TranslationKey) => string;

function getErrorMessage(error: unknown) {
    if (
        typeof error === "object" &&
        error !== null &&
        "message" in error
    ) {
        return String(error.message ?? "");
    }

    return "";
}

export function getLocalizedAuthErrorMessage(
    error: unknown,
    t: Translate
) {
    const message = getErrorMessage(error).trim();
    const normalized = message.toLowerCase();

    if (!message) return t("common.unknownError");

    if (message === ONE_ACCOUNT_PER_DEVICE_MESSAGE) {
        return t("auth.oneAccountPerDeviceMessage");
    }

    if (
        normalized.includes(
            "new password should be different from the old password"
        )
    ) {
        return t("auth.passwordMustDifferFromOld");
    }

    switch (message) {
        case "First name is required.":
            return t("auth.firstNameRequired");
        case "Email is required.":
            return t("auth.emailRequired");
        case "Password is required.":
            return t("auth.passwordRequired");
        case "Failed to delete account. Please try again.":
            return t("auth.deleteAccountFailed");
        case "Request timed out. Please try again in a few minutes. If the issue persists, please reopen the app and try again.":
            return t("auth.requestTimedOut");
        default:
            return message;
    }
}
