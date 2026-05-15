import "dotenv/config";

const scheme = process.env.SCHEME || "app108again";
const isDev = scheme === "app108againdev";

export default {
    expo: {
        name: "108 Again",
        slug: "108-again",
        scheme,
        version: "1.0.12",

        orientation: "portrait",
        icon: "./assets/images/icon.png",
        userInterfaceStyle: "automatic",
        newArchEnabled: true,

        ios: {
            supportsTablet: true,
        },

        android: {
            package: "com.bandieramonte.app108again",
            adaptiveIcon: {
                backgroundColor: "#1A5FCC",
                foregroundImage: "./assets/images/icon.png",
            },

            edgeToEdgeEnabled: true,
            predictiveBackGestureEnabled: false,

            intentFilters: [
                {
                    action: "VIEW",
                    data: [
                        {
                            scheme,
                            host: "reset-password"
                        },
                    ],
                    category: ["BROWSABLE", "DEFAULT"],
                },
            ],
        },

        web: {
            output: "static",
            favicon: "./assets/images/favicon.png",
        },

        plugins: [
            "expo-router",
            "expo-dev-client",
            [
                "expo-splash-screen",
                {
                    image: "./assets/images/splash.png",
                    imageWidth: 240,
                    resizeMode: "contain",
                    backgroundColor: "#1A5FCC",
                },
            ],
            "expo-sqlite",
        ],

        experiments: {
            typedRoutes: true,
            reactCompiler: true,
        },

        extra: {
            router: {
                origin: false,
            },

            eas: {
                projectId: "f9c2cb6d-62a2-4be0-a561-c4ea996d26b6",
            },

            appEnv: isDev ? "development" : "production",
        },
    },
};