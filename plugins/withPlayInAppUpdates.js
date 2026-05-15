const {
    AndroidConfig,
    withAppBuildGradle,
    withDangerousMod,
    withMainApplication,
} = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

const PLAY_APP_UPDATE_DEPENDENCY =
    'implementation("com.google.android.play:app-update:2.1.0")';

const APP_UPDATE_MODULE = `package com.bandieramonte.app108again

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.google.android.play.core.appupdate.AppUpdateManagerFactory
import com.google.android.play.core.install.model.AppUpdateType
import com.google.android.play.core.install.model.UpdateAvailability

class AppUpdateModule(
    reactContext: ReactApplicationContext
) : ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "AppUpdateModule"

    @ReactMethod
    fun getUpdateAvailability(promise: Promise) {
        val appUpdateManager =
            AppUpdateManagerFactory.create(reactApplicationContext)

        appUpdateManager.appUpdateInfo
            .addOnSuccessListener { info ->
                val updateAvailable =
                    info.updateAvailability() ==
                        UpdateAvailability.UPDATE_AVAILABLE

                val result = Arguments.createMap().apply {
                    putBoolean("isUpdateAvailable", updateAvailable)
                    putBoolean(
                        "isFlexibleUpdateAllowed",
                        info.isUpdateTypeAllowed(AppUpdateType.FLEXIBLE)
                    )
                    putBoolean(
                        "isImmediateUpdateAllowed",
                        info.isUpdateTypeAllowed(AppUpdateType.IMMEDIATE)
                    )
                    putInt("availableVersionCode", info.availableVersionCode())
                    putInt("updatePriority", info.updatePriority())

                    val stalenessDays = info.clientVersionStalenessDays()
                    if (stalenessDays == null) {
                        putNull("clientVersionStalenessDays")
                    } else {
                        putInt("clientVersionStalenessDays", stalenessDays)
                    }
                }

                promise.resolve(result)
            }
            .addOnFailureListener { error ->
                promise.reject(
                    "APP_UPDATE_CHECK_FAILED",
                    error
                )
            }
    }
}
`;

const APP_UPDATE_PACKAGE = `package com.bandieramonte.app108again

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class AppUpdatePackage : ReactPackage {
    override fun createNativeModules(
        reactContext: ReactApplicationContext
    ): List<NativeModule> =
        listOf(AppUpdateModule(reactContext))

    override fun createViewManagers(
        reactContext: ReactApplicationContext
    ): List<ViewManager<*, *>> =
        emptyList()
}
`;

function withPlayAppUpdateDependency(config) {
    return withAppBuildGradle(config, (config) => {
        if (!config.modResults.contents.includes(PLAY_APP_UPDATE_DEPENDENCY)) {
            config.modResults.contents =
                config.modResults.contents.replace(
                    /dependencies\s*\{/,
                    `dependencies {\n    ${PLAY_APP_UPDATE_DEPENDENCY}`
                );
        }

        return config;
    });
}

function withPlayAppUpdateNativeFiles(config) {
    return withDangerousMod(config, [
        "android",
        async (config) => {
            const packageName =
                AndroidConfig.Package.getPackage(config);
            const packagePath = packageName.replace(/\./g, path.sep);
            const javaDir = path.join(
                config.modRequest.platformProjectRoot,
                "app",
                "src",
                "main",
                "java",
                packagePath
            );

            fs.mkdirSync(javaDir, { recursive: true });
            fs.writeFileSync(
                path.join(javaDir, "AppUpdateModule.kt"),
                APP_UPDATE_MODULE
            );
            fs.writeFileSync(
                path.join(javaDir, "AppUpdatePackage.kt"),
                APP_UPDATE_PACKAGE
            );

            return config;
        },
    ]);
}

function withPlayAppUpdatePackageRegistration(config) {
    return withMainApplication(config, (config) => {
        if (!config.modResults.contents.includes("AppUpdatePackage()")) {
            config.modResults.contents =
                config.modResults.contents.replace(
                    "// add(MyReactNativePackage())",
                    "// add(MyReactNativePackage())\n              add(AppUpdatePackage())"
                );
        }

        return config;
    });
}

module.exports = function withPlayInAppUpdates(config) {
    config = withPlayAppUpdateDependency(config);
    config = withPlayAppUpdateNativeFiles(config);
    config = withPlayAppUpdatePackageRegistration(config);

    return config;
};
