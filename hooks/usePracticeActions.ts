import { useRouter } from "expo-router";
import { useState } from "react";
import { Alert } from "react-native";
import { useI18n } from "../i18n";
import * as practiceService from "../services/practiceService";

export type PracticeActionTarget = {
    id: string;
    name: string;
    total: number;
};

type Options = {
    onDeleted?: () => void | Promise<void>;
};

export function usePracticeActions({ onDeleted }: Options = {}) {
    const router = useRouter();
    const { t } = useI18n();
    const [historyPractice, setHistoryPractice] =
        useState<PracticeActionTarget | null>(null);

    function editPractice(practice: PracticeActionTarget) {
        router.push({
            pathname: "/edit-practice",
            params: {
                id: practice.id,
                practiceName: practice.name,
            },
        });
    }

    function openPracticeHistory(practice: PracticeActionTarget) {
        setHistoryPractice(practice);
    }

    function closePracticeHistory() {
        setHistoryPractice(null);
    }

    function confirmDeletePractice(practice: PracticeActionTarget) {
        Alert.alert(
            t("practiceMenu.deleteTitle"),
            t("practiceMenu.deleteMessage"),
            [
                { text: t("common.cancel"), style: "cancel" },
                {
                    text: t("common.delete"),
                    style: "destructive",
                    onPress: async () => {
                        await practiceService.deletePractice(practice.id);
                        await onDeleted?.();
                    },
                },
            ]
        );
    }

    return {
        historyPractice,
        editPractice,
        openPracticeHistory,
        closePracticeHistory,
        confirmDeletePractice,
    };
}
