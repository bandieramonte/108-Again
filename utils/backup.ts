import * as deletedRecordRepo from "@/repositories/deletedRecordRepo";
import * as practiceRepo from "@/repositories/practiceRepo";
import * as authService from "@/services/authService";
import { getBackupData, restoreBackupData, validateBackup } from "@/services/backupService";
import * as syncService from "@/services/syncService";
import { emitDataChanged } from "@/utils/events";
import { CUSTOM_PRACTICE_IMAGE_KEY } from "@/constants/practiceImages";
import {
    deleteLocalCustomPracticeImage,
    readCustomPracticeImageForBackup,
    restoreCustomPracticeImageFromBackup,
} from "@/services/customPracticeImageService";
import { randomUUID } from "expo-crypto";
import * as DocumentPicker from "expo-document-picker";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { Alert } from "react-native";
import * as appMetaRepo from "../repositories/appMetaRepo";

export async function exportBackup() {

    const data = await getBackupData();
    const portablePractices = await Promise.all(
        data.practices.map(async (practice: any) => {
            const {
                customImageUri,
                customImage: _existingCustomImage,
                ...portablePractice
            } = practice;

            if (practice.imageKey !== CUSTOM_PRACTICE_IMAGE_KEY) {
                return portablePractice;
            }

            if (!customImageUri) {
                throw new Error(
                    `Custom image is missing for ${practice.name}.`
                );
            }

            return {
                ...portablePractice,
                customImage:
                    await readCustomPracticeImageForBackup(customImageUri),
            };
        })
    );

    const json = JSON.stringify(
        { ...data, practices: portablePractices },
        null,
        2
    );

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
        const restoredImageUris: string[] = [];
        let restoreCompleted = false;

        try {
            validateBackup(data);

            const userId = authService.getCurrentUserId();

            // ✅ 1. Clear stale deletions FIRST (fix for your original bug)
            if (userId) {
                deletedRecordRepo.clearAllPendingDeletions(userId);
            }

            // ✅ 2. Capture current state BEFORE overwrite
            const existingPractices = practiceRepo.getAllPractices();

            const preparedPractices = data.practices.map((practice: any) => {
                const {
                    customImageUri: _deviceLocalUri,
                    customImage,
                    ...preparedPractice
                } = practice;

                if (practice.imageKey !== CUSTOM_PRACTICE_IMAGE_KEY) {
                    return preparedPractice;
                }

                const customImageUri =
                    restoreCustomPracticeImageFromBackup(
                        practice.id,
                        customImage
                    );
                restoredImageUris.push(customImageUri);

                return { ...preparedPractice, customImageUri };
            });
            const preparedData = {
                ...data,
                practices: preparedPractices,
            };

            // ✅ 3. Replace local DB with backup
            await restoreBackupData(preparedData);
            restoreCompleted = true;

            const retainedImageUris = new Set(restoredImageUris);
            for (const practice of existingPractices) {
                if (
                    practice.customImageUri &&
                    !retainedImageUris.has(practice.customImageUri)
                ) {
                    deleteLocalCustomPracticeImage(
                        practice.customImageUri
                    );
                }
            }

            appMetaRepo.setMeta(
                "pendingBackupRestore",
                "true"
            );

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
                            dailyTargetCount: p.dailyTargetCount ?? null,
                            defaultSessionCount:
                                p.defaultSessionCount ?? 108,
                            totalOffset: p.totalOffset ?? 0,
                            reminderEnabled:
                                p.reminderEnabled === true ||
                                p.reminderEnabled === 1,
                            reminderHour: p.reminderHour ?? 20,
                            reminderMinute: p.reminderMinute ?? 0,
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
            if (!restoreCompleted) {
                for (const uri of restoredImageUris) {
                    deleteLocalCustomPracticeImage(uri);
                }
            }
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
