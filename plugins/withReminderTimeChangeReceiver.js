const {
    AndroidConfig,
    withAndroidManifest,
    withDangerousMod,
} = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

function createReminderTimeChangeReceiver(packageName) {
    return `package ${packageName}

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import expo.modules.notifications.notifications.model.NotificationRequest
import expo.modules.notifications.notifications.triggers.DateTrigger
import expo.modules.notifications.service.delegates.ExpoSchedulingDelegate
import expo.modules.notifications.service.delegates.SharedPreferencesNotificationsStore
import java.util.Calendar

class ReminderTimeChangeReceiver : BroadcastReceiver() {
    companion object {
        private const val CHANNEL_ID = "practice-reminders"
        private val reminderIdentifier = Regex(
            "^practiceReminder:.*:(\\\\d{4})-(\\\\d{2})-(\\\\d{2}):(\\\\d{1,2}):(\\\\d{1,2})$"
        )
    }

    override fun onReceive(context: Context, intent: Intent?) {
        val pendingResult = goAsync()

        Thread {
            try {
                reschedulePracticeReminders(context.applicationContext)
            } finally {
                pendingResult.finish()
            }
        }.start()
    }

    private fun reschedulePracticeReminders(context: Context) {
        val store = SharedPreferencesNotificationsStore(context)
        val schedulingDelegate = ExpoSchedulingDelegate(context)

        store.allNotificationRequests.forEach { request ->
            val match = reminderIdentifier.matchEntire(request.identifier)
                ?: return@forEach
            val (year, month, day, hour, minute) =
                match.destructured.toList().map(String::toInt)
            val localTriggerTime = Calendar.getInstance().apply {
                set(Calendar.YEAR, year)
                set(Calendar.MONTH, month - 1)
                set(Calendar.DAY_OF_MONTH, day)
                set(Calendar.HOUR_OF_DAY, hour)
                set(Calendar.MINUTE, minute)
                set(Calendar.SECOND, 0)
                set(Calendar.MILLISECOND, 0)
            }.timeInMillis
            val adjustedRequest = NotificationRequest(
                request.identifier,
                request.content,
                DateTrigger(CHANNEL_ID, localTriggerTime)
            )

            schedulingDelegate.scheduleNotification(adjustedRequest)
        }
    }
}
`;
}

function withReminderTimeChangeReceiverManifest(config) {
    return withAndroidManifest(config, config => {
        const application =
            AndroidConfig.Manifest.getMainApplicationOrThrow(
                config.modResults
            );
        application.receiver = application.receiver ?? [];

        if (
            !application.receiver.some(
                receiver =>
                    receiver.$?.["android:name"] ===
                    ".ReminderTimeChangeReceiver"
            )
        ) {
            application.receiver.push({
                $: {
                    "android:name": ".ReminderTimeChangeReceiver",
                    "android:enabled": "true",
                    "android:exported": "false",
                },
                "intent-filter": [
                    {
                        action: [
                            {
                                $: {
                                    "android:name":
                                        "android.intent.action.TIMEZONE_CHANGED",
                                },
                            },
                            {
                                $: {
                                    "android:name":
                                        "android.intent.action.TIME_SET",
                                },
                            },
                        ],
                    },
                ],
            });
        }

        return config;
    });
}

function withReminderTimeChangeReceiverFile(config) {
    return withDangerousMod(config, [
        "android",
        async config => {
            const packageName = AndroidConfig.Package.getPackage(config);
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
                path.join(javaDir, "ReminderTimeChangeReceiver.kt"),
                createReminderTimeChangeReceiver(packageName)
            );

            return config;
        },
    ]);
}

module.exports = function withReminderTimeChangeReceiver(config) {
    config = withReminderTimeChangeReceiverManifest(config);
    config = withReminderTimeChangeReceiverFile(config);

    return config;
};
