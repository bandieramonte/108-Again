import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
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
import * as authService from "../services/authService";

export default function SignInScreen() {
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
            Alert.alert("Sign in failed", error?.message ?? "Unknown error");
        } finally {
            setSubmitting(false);
        }
    }
    async function handleForgotPassword() {
        if (sendingReset) return;

        if (!email) {
            Alert.alert("Missing email", "Please enter your email first.");
            return;
        }

        try {
            setSendingReset(true);

            await AsyncStorage.setItem("reset_email", email);

            await authService.resetPassword(email);

            Alert.alert(
                "Check your email",
                "If your email is registered, you will receive a password reset link."
            );
        } catch (error: any) {
            Alert.alert(
                "Reset failed",
                error?.message ?? "Unknown error"
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
                contentContainerStyle={styles.container}
                keyboardShouldPersistTaps="handled"
            >
                <Text style={styles.title}>Sign In</Text>

                {showConfirmedBanner && (
                    <View style={styles.successBanner}>
                        <Text style={styles.successBannerText}>
                            Email confirmed. You can now sign in.
                        </Text>
                    </View>
                )}

                <Text style={styles.label}>Email</Text>
                <TextInput
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="email-address"
                    style={styles.input}
                    placeholder="Enter your email"
                />

                <Text style={styles.label}>Password</Text>
                <View style={styles.passwordContainer}>
                    <TextInput
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry={!showPassword}
                        autoCapitalize="none"
                        autoCorrect={false}
                        style={styles.passwordInput}
                        placeholder="Enter your password"
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
                        <Text style={styles.forgotText}>Sending...</Text>
                    ) : (
                        <Text style={styles.forgotText}>Forgot password?</Text>
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
                        <Text style={styles.buttonText}>Sign In</Text>
                    )}
                </Pressable>

                <Pressable
                    onPress={() => router.push("/sign-up")}
                    style={styles.linkButton}
                >
                    <Text style={styles.linkText}>Need an account? Sign Up</Text>
                </Pressable>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 20,
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