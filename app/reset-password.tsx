import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View
} from "react-native";
import { supabase } from "../lib/supabase";
import * as authService from "../services/authService";

export default function ResetPasswordScreen() {
    const [password, setPassword] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);

    async function handleReset() {
        if (!password || !confirmPassword) {
            Alert.alert("Missing fields", "Please fill all fields.");
            return;
        }

        if (password !== confirmPassword) {
            Alert.alert("Mismatch", "Passwords do not match.");
            return;
        }

        try {
            setSubmitting(true);
            const { error } = await supabase.auth.updateUser({
                password,
            });

            if (error) {
                throw new Error(error.message);
            }

            Alert.alert("Success", "Your password has been updated.");

            // refresh auth state
            await authService.initializeAuth();

            router.replace("/");
        } catch (error: any) {

            const message =
                error?.message?.toLowerCase().includes("session")
                    ? "Your reset link has expired. Please request a new one."
                    : error?.message ?? "Unknown error";

            Alert.alert("Reset failed", message);
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Set new password</Text>

            <Text style={styles.label}>New password</Text>
            <View style={styles.passwordContainer}>
                <TextInput
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                    style={styles.passwordInput}
                    placeholder="Enter new password"
                />

                <Pressable onPress={() => setShowPassword((v) => !v)} style={styles.icon}>
                    <Ionicons
                        name={showPassword ? "eye-off" : "eye"}
                        size={20}
                        color="#666"
                    />
                </Pressable>
            </View>

            <Text style={styles.label}>Confirm password</Text>

            <TextInput
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showPassword}
                style={styles.input}
                placeholder="Confirm password"
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
                        Update Password
                    </Text>
                )}
            </Pressable>
        </View>
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