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

function createAppUpdateModule(packageName) {
    return `package ${packageName}

import android.os.Build
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.google.android.play.core.appupdate.AppUpdateManagerFactory
import com.google.android.play.core.appupdate.AppUpdateOptions
import com.google.android.play.core.install.model.AppUpdateType
import com.google.android.play.core.install.model.UpdateAvailability

class AppUpdateModule(
    reactContext: ReactApplicationContext
) : ReactContextBaseJavaModule(reactContext) {

    companion object {
        private const val UPDATE_REQUEST_CODE = 1081
    }

    override fun getName(): String = "AppUpdateModule"

    @Suppress("DEPRECATION")
    @ReactMethod
    fun getCurrentVersionCode(promise: Promise) {
        try {
            val packageInfo = reactApplicationContext.packageManager
                .getPackageInfo(reactApplicationContext.packageName, 0)
            val versionCode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                packageInfo.longVersionCode
            } else {
                packageInfo.versionCode.toLong()
            }

            promise.resolve(versionCode.toDouble())
        } catch (error: Exception) {
            promise.reject("APP_VERSION_CHECK_FAILED", error)
        }
    }

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
                promise.reject("APP_UPDATE_CHECK_FAILED", error)
            }
    }

    @ReactMethod
    fun startImmediateUpdate(promise: Promise) {
        val activity = reactApplicationContext.currentActivity
        if (activity == null) {
            promise.reject(
                "APP_UPDATE_ACTIVITY_UNAVAILABLE",
                "No Android activity is available to start the update."
            )
            return
        }

        val appUpdateManager =
            AppUpdateManagerFactory.create(reactApplicationContext)

        appUpdateManager.appUpdateInfo
            .addOnSuccessListener { info ->
                val canStart =
                    info.updateAvailability() ==
                        UpdateAvailability.UPDATE_AVAILABLE &&
                    info.isUpdateTypeAllowed(AppUpdateType.IMMEDIATE)

                if (!canStart) {
                    promise.resolve(false)
                    return@addOnSuccessListener
                }

                try {
                    val started = appUpdateManager.startUpdateFlowForResult(
                        info,
                        activity,
                        AppUpdateOptions.newBuilder(AppUpdateType.IMMEDIATE)
                            .build(),
                        UPDATE_REQUEST_CODE
                    )
                    promise.resolve(started)
                } catch (error: Exception) {
                    promise.reject("APP_UPDATE_START_FAILED", error)
                }
            }
            .addOnFailureListener { error ->
                promise.reject("APP_UPDATE_CHECK_FAILED", error)
            }
    }
}
`;
}

function createAppUpdatePackage(packageName) {
    return `package ${packageName}

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
}

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
                createAppUpdateModule(packageName)
            );
            fs.writeFileSync(
                path.join(javaDir, "AppUpdatePackage.kt"),
                createAppUpdatePackage(packageName)
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
