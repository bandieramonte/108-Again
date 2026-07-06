const { withFinalizedMod } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

function removeGeneratedStatusBarColor(androidProjectRoot) {
    const stylesPath = path.join(
        androidProjectRoot,
        "app",
        "src",
        "main",
        "res",
        "values",
        "styles.xml"
    );

    if (!fs.existsSync(stylesPath)) return;

    const contents = fs.readFileSync(stylesPath, "utf8");
    const nextContents = contents.replace(
        /^\s*<item name="android:statusBarColor">.*<\/item>\r?\n?/gm,
        ""
    );

    if (nextContents !== contents) {
        fs.writeFileSync(stylesPath, nextContents);
    }
}

function removeDeprecatedExpoEdgeToEdgeProperty(androidProjectRoot) {
    const propertiesPath = path.join(androidProjectRoot, "gradle.properties");

    if (!fs.existsSync(propertiesPath)) return;

    const contents = fs.readFileSync(propertiesPath, "utf8");
    const nextContents = contents
        .split(/\r?\n/)
        .filter(line =>
            line.trim() !== "expo.edgeToEdgeEnabled=true" &&
            !line.includes(
                "Specifies whether the app is configured to use edge-to-edge via the app config or plugin"
            ) &&
            !line.includes(
                "WARNING: This property has been deprecated and will be removed in Expo SDK 55"
            )
        )
        .join("\n")
        .replace(/\n{3,}/g, "\n\n");

    if (nextContents !== contents) {
        fs.writeFileSync(propertiesPath, nextContents);
    }
}

module.exports = function withAndroidEdgeToEdgeCleanup(config) {
    return withFinalizedMod(config, [
        "android",
        async (config) => {
            const androidProjectRoot = config.modRequest.platformProjectRoot;

            removeGeneratedStatusBarColor(androidProjectRoot);
            removeDeprecatedExpoEdgeToEdgeProperty(androidProjectRoot);

            return config;
        },
    ]);
};
