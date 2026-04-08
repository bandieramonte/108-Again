import * as authService from "@/services/authService";
import { getBackupData, restoreBackupData, validateBackup } from "@/services/backupService";
import * as syncService from "@/services/syncService";
import { emitDataChanged } from "@/utils/events";
import * as DocumentPicker from "expo-document-picker";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { Alert } from "react-native";

export async function exportBackup() {

    const data = getBackupData();

    const json = JSON.stringify(data, null, 2);

    const file = new File(Paths.document, "ngondro-backup.json");

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

            if (userId) {
                await syncService.wipeRemoteUserData(userId);
            }

            await restoreBackupData(data);

            if (userId) {
                await syncService.syncNow(userId);
            }

            if (onComplete) {
                onComplete();
            }

            emitDataChanged();

            alert("Backup restored successfully");

        } catch (error) {

            Alert.alert(
                "Restore failed",
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