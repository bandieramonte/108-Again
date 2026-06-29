import { getSupabase } from "@/lib/supabase";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
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

export default function ResetPasswordScreen() {
    const { t } = useI18n();
    const [password, setPassword] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);

    async function handleReset() {
        if (!password || !confirmPassword) {
            Alert.alert(t("auth.missingFieldsTitle"), t("auth.missingFieldsMessage"));
            return;
        }

        if (password.length > AUTH_FIELD_LIMITS.password) {
            Alert.alert(
                t("auth.passwordTooLongTitle"),
                t("auth.passwordTooLongMessage", {
                    count: AUTH_FIELD_LIMITS.password,
                })
            );
            return;
        }

        if (confirmPassword.length > AUTH_FIELD_LIMITS.password) {
            Alert.alert(
                t("auth.passwordTooLongTitle"),
                t("auth.confirmPasswordTooLongMessage", {
                    count: AUTH_FIELD_LIMITS.password,
                })
            );
            return;
        }

        if (password !== confirmPassword) {
            Alert.alert(t("auth.passwordMismatchTitle"), t("auth.passwordMismatchMessage"));
            return;
        }

        try {
            setSubmitting(true);
            const supabase = getSupabase();
            const { error } = await supabase.auth.updateUser({
                password,
            });
            if (error) {
                throw new Error(error.message);
            }

            Alert.alert(
                t("auth.passwordUpdatedTitle"),
                t("auth.passwordUpdatedMessage")
            );
            authService.setPasswordRecoveryFlow(false);
            await authService.signOut();
            router.replace("/sign-in");
        } catch (error: any) {

            const message =
                error?.message?.toLowerCase().includes("session")
                    ? t("auth.resetLinkExpired")
                    : error?.message ?? t("common.unknownError");

            Alert.alert(t("auth.resetFailed"), message);
        } finally {
            setSubmitting(false);
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
                <Text style={styles.title}>{t("auth.setNewPassword")}</Text>

                <Text style={styles.label}>{t("auth.newPassword")}</Text>
                <View style={styles.passwordContainer}>
                    <TextInput
                        value={password}
                        onChangeText={setPassword}
                        maxLength={AUTH_FIELD_LIMITS.password}
                        secureTextEntry={!showPassword}
                        style={styles.passwordInput}
                        placeholder={t("auth.newPasswordPlaceholder")}
                    />

                    <Pressable onPress={() => setShowPassword((v) => !v)} style={styles.icon}>
                        <Ionicons
                            name={showPassword ? "eye-off" : "eye"}
                            size={20}
                            color="#666"
                        />
                    </Pressable>
                </View>

                <Text style={styles.label}>{t("auth.confirmPassword")}</Text>

                <TextInput
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    maxLength={AUTH_FIELD_LIMITS.password}
                    secureTextEntry={!showPassword}
                    style={styles.input}
                    placeholder={t("auth.confirmPassword")}
                />

                <Pressable
                    style={({ pressed }) => [
                        styles.button,
                        pressed && styles.buttonPressed,
                        submitting && styles.buttonDisabled,
                    ]}
                    onPress={handleReset}
                    disabled={submitting}
                >
                    {submitting ? (
                        <ActivityIndicator />
                    ) : (
                        <Text style={styles.buttonText}>
                            {t("auth.updatePassword")}
                        </Text>
                    )}
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
    },

    input: {
        borderWidth: 1,
        borderColor: "#ccc",
        borderRadius: 8,
        padding: 12,
        fontSize: 16,
        color: "black"
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
});
