import HeaderMenu from "@/components/HeaderMenu";
import { exportBackup, importBackup } from "@/utils/backup";
import { Stack, router } from "expo-router";
import { useEffect } from "react";
import { Alert } from "react-native";
import * as appService from "../services/appService";

export default function Layout() {

    useEffect(() => {
        appService.initializeApp();
    }, []);

    function handleRestoreDefaults() {
        Alert.alert(
            "Restore Defaults?",
            "This will remove all your practices, sessions, adjustments, and local data, and restore the original default practices. This cannot be undone.",
            [
                {
                    text: "Cancel",
                    style: "cancel"
                },
                {
                    text: "Restore",
                    style: "destructive",
                    onPress: () => {
                        appService.restoreDefaults();
                        router.replace("/");
                    }
                }
            ]
        );
    }

    return (
        <Stack
            screenOptions={{
                headerTitle: "Ngöndro Tracker",

                headerRight: () => (
                    <HeaderMenu
                        onExport={exportBackup}
                        onImport={importBackup}
                        onRestoreDefaults={handleRestoreDefaults}
                    />
                )
            }}
        />
    );

}