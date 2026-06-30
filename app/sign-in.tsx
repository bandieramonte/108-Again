import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { AUTH_FIELD_LIMITS } from "../constants/authFieldLimits";
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import { useI18n } from "../i18n";
import * as authService from "../services/authService";
import { globalStyles } from "../styles/global";
import { getLocalizedAuthErrorMessage } from "../utils/authErrorText";

export default function SignInScreen() {
    const { t } = useI18n();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [sendingReset, setSendingReset] = useState(false);
    const { confirmed } = useLocalSearchParams();
    const [showConfirmedBanner, setShowConfirmedBanner] = useState(false);

    useEffect(() => {
        if (confirmed === "true") {
            setShowConfirmedBanner(true);

            const timeout = setTimeout(() => {
                setShowConfirmedBanner(false);
            }, 4000);

            return () => clearTimeout(timeout);
        }
    }, [confirmed]);

    async function handleSignIn() {
        if (submitting) return;

        try {
            setSubmitting(true);
            await authService.signIn(email, password);
            router.replace("/");
        } catch (error: any) {
            Alert.alert(
                t("auth.loginFailed"),
                getLocalizedAuthErrorMessage(error, t)
            );
        } finally {
            setSubmitting(false);
        }
    }
    async function handleForgotPassword() {
        if (sendingReset) return;

        if (!email) {
            Alert.alert(
                t("auth.missingEmailTitle"),
                t("auth.missingEmailMessage")
            );
            return;
        }

        try {
            setSendingReset(true);

            await AsyncStorage.setItem("reset_email", email);

            await authService.resetPassword(email);

            Alert.alert(
                t("auth.checkEmailTitle"),
                t("auth.checkEmailMessage")
            );
        } catch (error: any) {
            Alert.alert(
                t("auth.resetFailed"),
                getLocalizedAuthErrorMessage(error, t)
            );
        } finally {
            setSendingReset(false);
        }
    }

    return (
        <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
            <ScrollView
                contentContainerStyle={[
                    globalStyles.sidePadding,
                    styles.container,
                ]}
                keyboardShouldPersistTaps="handled"
            >
                <Text style={styles.title}>{t("menu.logIn")}</Text>

                {showConfirmedBanner && (
                    <View style={styles.successBanner}>
                        <Text style={styles.successBannerText}>
                            {t("auth.emailConfirmed")}
                        </Text>
                    </View>
                )}

                <Text style={styles.label}>{t("account.email")}</Text>
                <TextInput
                    value={email}
                    onChangeText={setEmail}
                    maxLength={AUTH_FIELD_LIMITS.email}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="email-address"
                    style={styles.input}
                    placeholder={t("auth.emailPlaceholder")}
                />

                <Text style={styles.label}>{t("auth.password")}</Text>
                <View style={styles.passwordContainer}>
                    <TextInput
                        value={password}
                        onChangeText={setPassword}
                        maxLength={AUTH_FIELD_LIMITS.password}
                        secureTextEntry={!showPassword}
                        autoCapitalize="none"
                        autoCorrect={false}
                        style={styles.passwordInput}
                        placeholder={t("auth.passwordPlaceholder")}
                    />

                    <Pressable
                        onPress={() => setShowPassword((v) => !v)}
                        style={styles.icon}
                    >
                        <Ionicons
                            name={showPassword ? "eye-off" : "eye"}
                            size={20}
                            color="#666"
                        />
                    </Pressable>
                </View>

                <Pressable
                    onPress={handleForgotPassword}
                    style={({ pressed }) => [
                        styles.forgotButton,
                        pressed && { opacity: 0.7 },
                        sendingReset && { opacity: 0.5 }
                    ]}
                    disabled={sendingReset}
                >
                    {sendingReset ? (
                        <Text style={styles.forgotText}>
                            {t("auth.sending")}
                        </Text>
                    ) : (
                        <Text style={styles.forgotText}>
                            {t("auth.forgotPassword")}
                        </Text>
                    )}
                </Pressable>

                <Pressable
                    style={({ pressed }) => [
                        styles.button,
                        pressed && styles.buttonPressed,
                        submitting && styles.buttonDisabled,
                    ]}
                    onPress={handleSignIn}
                    disabled={submitting}
                >
                    {submitting ? (
                        <ActivityIndicator />
                    ) : (
                        <Text style={styles.buttonText}>
                            {t("menu.logIn")}
                        </Text>
                    )}
                </Pressable>

                <Pressable
                    onPress={() => router.push("/sign-up")}
                    style={styles.linkButton}
                >
                    <Text style={styles.linkText}>
                        {t("auth.needAccount")}
                    </Text>
                </Pressable>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingVertical: 14,
        backgroundColor: "white",
    },

    title: {
        fontSize: 28,
        fontWeight: "bold",
        marginBottom: 24,
    },

    label: {
        fontSize: 14,
        fontWeight: "600",
        marginBottom: 6,
        marginTop: 10,
    },

    input: {
        borderWidth: 1,
        borderColor: "#ccc",
        borderRadius: 8,
        padding: 12,
        fontSize: 16,
    },

    button: {
        marginTop: 24,
        backgroundColor: "#e5e7eb",
        borderRadius: 8,
        paddingVertical: 14,
        alignItems: "center",
    },

    buttonPressed: {
        opacity: 0.7,
    },

    buttonDisabled: {
        opacity: 0.6,
    },

    buttonText: {
        fontSize: 16,
        fontWeight: "600",
    },

    linkButton: {
        marginTop: 16,
        alignItems: "center",
    },

    linkText: {
        fontSize: 14,
        color: "#444",
    },

    toggle: {
        fontSize: 14,
        color: "#444",
        fontWeight: "600",
    },

    passwordContainer: {
        position: "relative",
        justifyContent: "center",
    },

    passwordInput: {
        borderWidth: 1,
        borderColor: "#ccc",
        borderRadius: 8,
        padding: 12,
        paddingRight: 40,
        fontSize: 16,
        color: "black"
    },

    icon: {
        position: "absolute",
        right: 12,
    },

    forgotButton: {
        marginTop: 10,
        alignSelf: "flex-end",
    },

    forgotText: {
        fontSize: 13,
        color: "#666",
    },

    successBanner: {
        backgroundColor: "#e6f4ea",
        borderColor: "#34a853",
        borderWidth: 1,
        padding: 10,
        borderRadius: 8,
        marginBottom: 12,
    },

    successBannerText: {
        color: "#137333",
        fontSize: 14,
    },
});
