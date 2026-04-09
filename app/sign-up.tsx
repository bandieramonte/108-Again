import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
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

export default function SignUpScreen() {
    const [firstName, setFirstName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    async function handleSignUp() {
        if (submitting) return;

        try {
            setSubmitting(true);
            const result = await authService.signUp(firstName, email, password);

            if (result?.needsEmailConfirmation) {
                Alert.alert(
                    "Confirm your email",
                    "Please check your email and confirm your account before signing in.",
                    [{ text: "OK", onPress: () => router.replace("/sign-in") }]
                );
                return;
            }

            router.replace("/");
        } catch (error: any) {
            Alert.alert("Sign up failed", error?.message ?? "Unknown error");
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
                contentContainerStyle={styles.container}
                keyboardShouldPersistTaps="handled"
            >
                <Text style={styles.title}>Sign Up</Text>

                <Text style={styles.label}>First name</Text>
                <TextInput
                    value={firstName}
                    onChangeText={setFirstName}
                    autoCapitalize="words"
                    autoCorrect={false}
                    style={styles.input}
                    placeholder="Enter your first name"
                />

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
                        style={styles.passwordInput}
                        placeholder="Create a password"
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
                    style={({ pressed }) => [
                        styles.button,
                        pressed && styles.buttonPressed,
                        submitting && styles.buttonDisabled,
                    ]}
                    onPress={handleSignUp}
                    disabled={submitting}
                >
                    {submitting ? (
                        <ActivityIndicator />
                    ) : (
                        <Text style={styles.buttonText}>Sign Up</Text>
                    )}
                </Pressable>

                <Pressable
                    onPress={() => router.push("/sign-in")}
                    style={styles.linkButton}
                >
                    <Text style={styles.linkText}>Already have an account? Sign In</Text>
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
});