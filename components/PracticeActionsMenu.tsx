import {
    type PracticeActionTarget,
    usePracticeActions,
} from "../hooks/usePracticeActions";
import PracticeDropdownMenu, {
    type PracticeMenuAnchor,
} from "./PracticeDropdownMenu";
import PracticeHistoryModal from "./PracticeHistoryModal";

export type { PracticeMenuAnchor } from "./PracticeDropdownMenu";
export type { PracticeActionTarget } from "../hooks/usePracticeActions";

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
    const actions = usePracticeActions({ onDeleted });

    function editPractice() {
        if (!practice) return;

        onClose();
        actions.editPractice(practice);
    }

    function openPracticeHistory() {
        if (!practice) return;

        onClose();
        actions.openPracticeHistory(practice);
    }

    function confirmDeletePractice() {
        if (!practice) return;

        onClose();
        actions.confirmDeletePractice(practice);
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

            {actions.historyPractice && (
                <PracticeHistoryModal
                    visible
                    onClose={actions.closePracticeHistory}
                    practiceId={actions.historyPractice.id}
                    total={actions.historyPractice.total}
                />
            )}
        </>
    );
}
