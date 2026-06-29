import type { PracticeReminderText } from "../services/practiceReminderService";
import { formatNumber } from "../utils/numberUtils";
import type { TranslationKey } from "./locales/en";

type TranslationParams = Record<string, number | string | null | undefined>;
type Translate = (
    key: TranslationKey,
    params?: TranslationParams
) => string;

export function createPracticeReminderText(
    t: Translate
): PracticeReminderText {
    return {
        channelName: t("reminderNotification.channelName"),
        dailyTargetRequiredMessage:
            t("reminderNotification.dailyTargetRequired"),
        invalidTimeMessage:
            t("reminderNotification.invalidTime"),
        notificationBody: (remainingCount) =>
            t("reminderNotification.body", {
                count: formatNumber(remainingCount),
            }),
        notificationTitle: (practiceName) =>
            t("reminderNotification.title", { practiceName }),
        permissionDeniedMessage:
            t("reminderNotification.permissionDenied"),
        unavailableOnWebMessage:
            t("reminderNotification.unavailableOnWeb"),
    };
}
