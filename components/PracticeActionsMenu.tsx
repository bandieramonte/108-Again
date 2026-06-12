import { useRouter } from "expo-router";
import { useState } from "react";
import { Alert } from "react-native";
import * as practiceService from "../services/practiceService";
import PracticeDropdownMenu, {
    type PracticeMenuAnchor,
} from "./PracticeDropdownMenu";
import PracticeHistoryModal from "./PracticeHistoryModal";

export type { PracticeMenuAnchor } from "./PracticeDropdownMenu";

export type PracticeActionTarget = {
    id: string;
    name: string;
    total: number;
};

type Props = {
    visible: boolean;
    anchor: PracticeMenuAnchor | null;
    practice: PracticeActionTarget | null;
    onClose: () => void;
    onDeleted?: () => void | Promise<void>;
};

export default function PracticeActionsMenu({
    visible,
    anchor,
    practice,
    onClose,
    onDeleted,
}: Props) {
    const router = useRouter();
    const [historyPractice, setHistoryPractice] =
        useState<PracticeActionTarget | null>(null);

    function editPractice() {
        if (!practice) return;

        const selectedPractice = practice;
        onClose();
        router.push({
            pathname: "/edit-practice",
            params: {
                id: selectedPractice.id,
                practiceName: selectedPractice.name,
            },
        });
    }

    function openPracticeHistory() {
        if (!practice) return;

        const selectedPractice = practice;
        onClose();
        setHistoryPractice(selectedPractice);
    }

    function confirmDeletePractice() {
        if (!practice) return;

        const selectedPractice = practice;
        onClose();

        Alert.alert(
            "Delete practice?",
            "All sessions for this practice will also be deleted.",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: async () => {
                        await practiceService.deletePractice(
                            selectedPractice.id
                        );
                        await onDeleted?.();
                    },
                },
            ]
        );
    }

    return (
        <>
            <PracticeDropdownMenu
                visible={visible && practice !== null}
                anchor={anchor}
                onClose={onClose}
                onEdit={editPractice}
                onHistory={openPracticeHistory}
                onDelete={confirmDeletePractice}
            />

            {historyPractice && (
                <PracticeHistoryModal
                    visible
                    onClose={() => setHistoryPractice(null)}
                    practiceId={historyPractice.id}
                    total={historyPractice.total}
                />
            )}
        </>
    );
}
