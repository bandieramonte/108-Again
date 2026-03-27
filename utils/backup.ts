import { getBackupData, restoreBackupData } from "@/services/backupService";
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
    const data = JSON.parse(content);
    function performImport() {

        restoreBackupData(data);

        if (onComplete) {
            onComplete();
        }

        alert("Backup restored successfully");

        emitDataChanged();
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