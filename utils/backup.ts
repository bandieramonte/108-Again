import * as deletedRecordRepo from "@/repositories/deletedRecordRepo";
import * as practiceRepo from "@/repositories/practiceRepo";
import * as authService from "@/services/authService";
import { getBackupData, restoreBackupData, validateBackup } from "@/services/backupService";
import * as syncService from "@/services/syncService";
import { emitDataChanged } from "@/utils/events";
import { randomUUID } from "expo-crypto";
import * as DocumentPicker from "expo-document-picker";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { Alert } from "react-native";
import { getIsOnline } from "../services/networkService";

export async function exportBackup() {

    const data = getBackupData();

    const json = JSON.stringify(data, null, 2);

    const file = new File(Paths.document, "app108again-backup.json");

    file.write(json);

    if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri);
    } else {
        alert("Backup saved to: " + file.uri);
    }
}

export async function importBackup(onComplete?: () => void) {

    const result = await DocumentPicker.getDocumentAsync({
        type: "application/json"
    });

    if (result.canceled) return;

    const uri = result.assets[0].uri;
    const file = new File(uri);

    const content = await file.text();
    let data:any;

    try {
        data = JSON.parse(content);
    } catch {
        Alert.alert(
            "Invalid file",
            "The selected file is not a valid backup."
        );
        return;
    }

    async function performImport() {
        try {
            validateBackup(data);

            const userId = authService.getCurrentUserId();

            // ✅ 1. Clear stale deletions FIRST (fix for your original bug)
            if (userId) {
                deletedRecordRepo.clearAllPendingDeletions(userId);
            }

            // ✅ 2. Capture current state BEFORE overwrite
            const existingPractices = practiceRepo.getAllPractices();

            // ✅ 3. Replace local DB with backup
            await restoreBackupData(data);

            if (userId && getIsOnline()) {
                console.log("IMPORT: wiping remote before sync");
                await syncService.wipeRemoteUserData(userId);
            }

            // ✅ 4. Compute what should be deleted remotely
            const importedIds = new Set(
                data.practices.map((p: any) => p.id)
            );

            const deletedPractices = existingPractices.filter(
                p => !importedIds.has(p.id)
            );

            // ✅ 5. Create correct deletion intent
            if (userId) {
                const now = Date.now();

                for (const p of deletedPractices) {
                    // only delete things that actually existed remotely
                    if (!p.lastSyncedAt) continue;

                    deletedRecordRepo.insertDeletedRecord(
                        randomUUID(),
                        "practice",
                        p.id,
                        userId,
                        now,
                        "pending",
                        JSON.stringify({
                            name: p.name,
                            targetCount: p.targetCount,
                            orderIndex: p.orderIndex,
                            imageKey: p.imageKey ?? null,
                            defaultAddCount: p.defaultAddCount ?? 108,
                        })
                    );
                }
            }

            // ✅ 6. Reset sync state so everything is pushed cleanly
            if (userId) {
                await syncService.resetLocalSyncState();
                await syncService.requestSync(userId, { immediate: true });
            }

            if (onComplete) {
                onComplete();
            }

            emitDataChanged();

            alert("Backup restored successfully");

        } catch (error) {
            Alert.alert(
                "Backup failed",
                error instanceof Error
                    ? error.message
                    : "The backup file could not be imported."
            );
        }
    }

    Alert.alert(
        "Overwrite data?",
        "Importing a backup will replace all current practice data.",
        [
            { text: "Cancel", style: "cancel" },
            { text: "OK", onPress: performImport }
        ]
    );

}