import { useRouter } from "expo-router";
import { useState } from "react";
import {
    Image,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import { DEFAULT_PRACTICES } from "../constants/defaultPractices";
import {
    extraPracticeImageOptions,
    practiceImages,
} from "../constants/practiceImages";
import { useI18n } from "../i18n";
import { getPracticeDisplayName } from "../i18n/practiceNames";
import * as practiceService from "../services/practiceService";
import { colors } from "../styles/theme";
import {
    digitsOnly,
    MAX_PRACTICE_NAME,
    MAX_REPETITIONS_PER_DAY,
    MAX_TARGET_COUNT,
    validateRepetitionCount,
    validateTargetCount,
} from "../utils/numberUtils";

const CUSTOM_IMAGE_FALLBACK = "generic";

export default function AddPractice() {

    const router = useRouter();
    const { t } = useI18n();

    const [name, setName] = useState("");
    const [target, setTarget] = useState("");
    const [defaultSession, setDefaultSession] = useState("108");
    const [selectedSeedId, setSelectedSeedId] = useState<string | null>(null);
    const [customImageKey, setCustomImageKey] = useState(CUSTOM_IMAGE_FALLBACK);

    const activePracticeIds = new Set(
        practiceService
            .getAllPractices()
            .map(practice => practice.id)
    );
    const missingSeedPractices =
        DEFAULT_PRACTICES.filter(practice => !activePracticeIds.has(practice.id));
    const selectedSeedPractice =
        selectedSeedId
            ? DEFAULT_PRACTICES.find(practice => practice.id === selectedSeedId) ?? null
            : null;
    const isSeedMode = selectedSeedPractice !== null;

    function selectSeedPractice(seedPractice: typeof DEFAULT_PRACTICES[number]) {
        setSelectedSeedId(seedPractice.id);
        setName(getPracticeDisplayName(seedPractice.id, seedPractice.name, t));
        setTarget(String(seedPractice.targetCount));
        setDefaultSession(String(seedPractice.defaultSessionCount ?? 108));
    }

    function selectCustomPractice() {
        setSelectedSeedId(null);
        setName("");
        setTarget("");
        setDefaultSession("108");
    }

    function validateTargetAndDefaultSession() {
        if (!target.trim()) {
            alert(t("form.targetCountRequired"));
            return false;
        }

        const targetError =
            validateTargetCount(target);

        if (targetError) {
            alert(targetError);
            return false;
        }

        const defaultSessionError =
            validateRepetitionCount(
                defaultSession,
                t("form.defaultSessionCount")
            );

        if (defaultSessionError) {
            alert(defaultSessionError);
            return false;
        }

        return true;
    }

    function savePractice() {
        if (!selectedSeedPractice && !name.trim()) {
            alert(t("form.practiceNameRequired"));
            return;
        }

        if (!validateTargetAndDefaultSession()) {
            return;
        }

        if (selectedSeedPractice) {
            try {
                practiceService.createSeedPractice(
                    selectedSeedPractice.id,
                    {
                        targetCount: Number(target),
                        defaultSessionCount: Number(defaultSession),
                    }
                );
                router.back();
            } catch (error: any) {
                alert(error.message);
            }
            return;
        }

        try {
            practiceService.createPractice(
                name,
                Number(target),
                null,
                Number(defaultSession),
                customImageKey
            );

            router.back();

        } catch (error: any) {
            alert(error.message);
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

                <Text style={styles.title}>{t("form.addPracticeTitle")}</Text>

                {missingSeedPractices.length > 0 && (
                    <View style={styles.sectionCard}>
                        <Text style={styles.sectionTitle}>
                            {t("addPractice.restoreSeedPractice")}
                        </Text>
                        <Text style={styles.sectionDescription}>
                            {t("addPractice.seedPracticeDescription")}
                        </Text>

                        <View style={styles.seedGrid}>
                            {missingSeedPractices.map(seedPractice => {
                                const seedDisplayName =
                                    getPracticeDisplayName(
                                        seedPractice.id,
                                        seedPractice.name,
                                        t
                                    );
                                const selected = selectedSeedId === seedPractice.id;

                                return (
                                    <Pressable
                                        key={seedPractice.id}
                                        style={({ pressed }) => [
                                            styles.seedOption,
                                            selected && styles.selectedOption,
                                            pressed && styles.optionPressed,
                                        ]}
                                        onPress={() => selectSeedPractice(seedPractice)}
                                        accessibilityRole="button"
                                        accessibilityLabel={`${t("addPractice.seedPractice")}: ${seedDisplayName}`}
                                    >
                                        <Image
                                            source={
                                                seedPractice.imageKey &&
                                                    practiceImages[seedPractice.imageKey]
                                                    ? practiceImages[seedPractice.imageKey]
                                                    : practiceImages[CUSTOM_IMAGE_FALLBACK]
                                            }
                                            style={styles.seedImage}
                                            resizeMode="contain"
                                        />
                                        <Text
                                            style={styles.seedName}
                                            numberOfLines={2}
                                        >
                                            {seedDisplayName}
                                        </Text>
                                    </Pressable>
                                );
                            })}
                        </View>
                    </View>
                )}

                <View style={styles.sectionCard}>
                    {!isSeedMode ? (
                        <View style={styles.sectionHeaderText}>
                            <Text style={styles.sectionTitle}>
                                {t("addPractice.customPractice")}
                            </Text>
                            <Text style={styles.sectionDescription}>
                                {t("addPractice.customPracticeDescription")}
                            </Text>
                        </View>
                    ) : (
                        <View style={styles.customModeRow}>
                            <Pressable
                                style={({ pressed }) => [
                                    styles.customModeButton,
                                    pressed && styles.optionPressed,
                                ]}
                                onPress={selectCustomPractice}
                                accessibilityRole="button"
                                accessibilityLabel={t("addPractice.customPractice")}
                            >
                                <Text style={styles.customModeButtonText}>
                                    {t("addPractice.customInstead")}
                                </Text>
                            </Pressable>
                        </View>
                    )}

                    {isSeedMode && selectedSeedPractice ? (
                        <View style={styles.fixedSeedPreview}>
                            <Image
                                source={
                                    selectedSeedPractice.imageKey &&
                                        practiceImages[selectedSeedPractice.imageKey]
                                        ? practiceImages[selectedSeedPractice.imageKey]
                                        : practiceImages[CUSTOM_IMAGE_FALLBACK]
                                }
                                style={styles.fixedSeedImage}
                                resizeMode="contain"
                            />
                            <View style={styles.fixedSeedText}>
                                <Text style={styles.fixedSeedName}>
                                    {getPracticeDisplayName(
                                        selectedSeedPractice.id,
                                        selectedSeedPractice.name,
                                        t
                                    )}
                                </Text>
                                <Text style={styles.fixedSeedMeta}>
                                    {t("addPractice.fixedSeedImage")}
                                </Text>
                            </View>
                        </View>
                    ) : null}

                    <Text style={styles.inputLabel}>
                        {t("form.practiceName")}
                    </Text>
                    <TextInput
                        placeholder={t("form.practiceName")}
                        placeholderTextColor="#999"
                        value={name}
                        onChangeText={(text) => setName(text.slice(0, MAX_PRACTICE_NAME))}
                        maxLength={25}
                        editable={!isSeedMode}
                        style={[
                            styles.input,
                            isSeedMode && styles.readOnlyInput,
                        ]}
                    />

                    <Text style={styles.inputLabel}>
                        {t("form.targetCount")}
                    </Text>
                    <TextInput
                        placeholder={t("form.targetCount")}
                        placeholderTextColor="#999"
                        value={target}
                        onChangeText={(v) => {
                            const clean = digitsOnly(v);
                            if (Number(clean) > MAX_TARGET_COUNT) return;
                            setTarget(clean);
                        }}
                        keyboardType="numeric"
                        style={styles.input}
                    />

                    <Text style={styles.inputLabel}>
                        {t("form.defaultSessionCount")}
                    </Text>
                    <TextInput
                        placeholder={t("form.defaultSessionCount")}
                        placeholderTextColor="#999"
                        value={defaultSession}
                        onChangeText={(v) => {
                            const clean = digitsOnly(v);
                            if (Number(clean) > MAX_REPETITIONS_PER_DAY) return;
                            setDefaultSession(clean);
                        }}
                        keyboardType="numeric"
                        style={styles.input}
                    />

                    {!isSeedMode && (
                        <View style={styles.imagePicker}>
                            <Text style={styles.imagePickerTitle}>
                                {t("addPractice.optionalImage")}
                            </Text>

                            <View style={styles.imageOptionGrid}>
                                <Pressable
                                    style={({ pressed }) => [
                                        styles.imageOption,
                                        customImageKey === CUSTOM_IMAGE_FALLBACK &&
                                        styles.selectedImageOption,
                                        pressed && styles.optionPressed,
                                    ]}
                                    onPress={() => setCustomImageKey(CUSTOM_IMAGE_FALLBACK)}
                                    accessibilityRole="button"
                                    accessibilityLabel={t("practiceImage.generic")}
                                >
                                    <Image
                                        source={practiceImages[CUSTOM_IMAGE_FALLBACK]}
                                        style={styles.imageOptionImage}
                                        resizeMode="contain"
                                    />
                                    <Text
                                        style={styles.imageOptionText}
                                        numberOfLines={2}
                                    >
                                        {t("practiceImage.generic")}
                                    </Text>
                                </Pressable>

                                {extraPracticeImageOptions.map(option => {
                                    const selected = customImageKey === option.key;

                                    return (
                                        <Pressable
                                            key={option.key}
                                            style={({ pressed }) => [
                                                styles.imageOption,
                                                selected && styles.selectedImageOption,
                                                pressed && styles.optionPressed,
                                            ]}
                                            onPress={() => setCustomImageKey(option.key)}
                                            accessibilityRole="button"
                                            accessibilityLabel={t(option.labelKey)}
                                        >
                                            <Image
                                                source={practiceImages[option.key]}
                                                style={styles.imageOptionImage}
                                                resizeMode="contain"
                                            />
                                            <Text
                                                style={styles.imageOptionText}
                                                numberOfLines={2}
                                            >
                                                {t(option.labelKey)}
                                            </Text>
                                        </Pressable>
                                    );
                                })}
                            </View>
                        </View>
                    )}
                </View>

                <Pressable
                    style={styles.saveButton}
                    onPress={savePractice}
                >
                    <Text style={styles.saveButtonText}>
                        {t("common.save")}
                    </Text>
                </Pressable>

            </ScrollView>
        </KeyboardAvoidingView>

    );
}

const styles = StyleSheet.create({

    container: {
        flexGrow: 1,
        padding: 20,
        paddingTop: 26,
        paddingBottom: 36,
    },

    title: {
        fontSize: 24,
        fontWeight: "700",
        color: "#111",
        marginBottom: 20,
    },

    sectionCard: {
        borderWidth: 1,
        borderColor: "#E1E7F5",
        backgroundColor: "#FAFBFF",
        borderRadius: 18,
        padding: 14,
        marginBottom: 18,
    },

    customModeRow: {
        flexDirection: "row",
        justifyContent: "flex-end",
        marginBottom: 12,
    },

    sectionHeaderText: {
        flex: 1,
    },

    sectionTitle: {
        fontSize: 17,
        fontWeight: "700",
        color: "#111",
        marginBottom: 4,
    },

    sectionDescription: {
        fontSize: 13,
        color: "#667085",
        marginBottom: 12,
        lineHeight: 18,
    },

    seedGrid: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 10,
    },

    seedOption: {
        width: "31%",
        minWidth: 92,
        flexGrow: 1,
        alignItems: "center",
        gap: 7,
        borderWidth: 1,
        borderColor: "#E1E7F5",
        borderRadius: 14,
        backgroundColor: "white",
        padding: 9,
    },

    selectedOption: {
        borderColor: colors.primary,
        backgroundColor: "#EEF2FF",
    },

    optionPressed: {
        opacity: 0.72,
    },

    seedImage: {
        width: 48,
        height: 48,
        borderRadius: 10,
    },

    seedName: {
        minHeight: 32,
        fontSize: 12,
        fontWeight: "600",
        color: "#111",
        textAlign: "center",
    },

    customModeButton: {
        borderWidth: 1,
        borderColor: colors.primary,
        borderRadius: 999,
        paddingVertical: 6,
        paddingHorizontal: 12,
    },

    customModeButtonText: {
        color: colors.primary,
        fontSize: 13,
        fontWeight: "700",
    },

    fixedSeedPreview: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        borderWidth: 1,
        borderColor: "#DBE4FF",
        backgroundColor: "#EEF2FF",
        borderRadius: 14,
        padding: 10,
        marginBottom: 14,
    },

    fixedSeedImage: {
        width: 54,
        height: 54,
        borderRadius: 11,
    },

    fixedSeedText: {
        flex: 1,
        minWidth: 0,
    },

    fixedSeedName: {
        fontSize: 16,
        fontWeight: "700",
        color: "#111",
        marginBottom: 3,
    },

    fixedSeedMeta: {
        fontSize: 13,
        color: "#667085",
    },

    input: {
        borderWidth: 1,
        borderColor: "#D0D5DD",
        padding: 11,
        marginBottom: 12,
        color: "black",
        borderRadius: 10,
        backgroundColor: "white",
    },

    inputLabel: {
        fontSize: 13,
        fontWeight: "700",
        color: "#344054",
        marginBottom: 6,
    },

    readOnlyInput: {
        backgroundColor: "#F2F4F7",
        color: "#667085",
    },

    imagePicker: {
        marginTop: 4,
    },

    imagePickerTitle: {
        fontSize: 15,
        fontWeight: "700",
        color: "#111",
        marginBottom: 3,
    },

    imagePickerDescription: {
        fontSize: 13,
        color: "#667085",
        marginBottom: 10,
    },

    imageOptionGrid: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 10,
    },

    imageOption: {
        width: "47%",
        minWidth: 120,
        flexGrow: 1,
        flexDirection: "row",
        alignItems: "center",
        gap: 9,
        borderWidth: 1,
        borderColor: "#E1E7F5",
        borderRadius: 14,
        backgroundColor: "white",
        padding: 9,
    },

    selectedImageOption: {
        borderColor: colors.primary,
        backgroundColor: "#EEF2FF",
    },

    imageOptionImage: {
        width: 42,
        height: 42,
        borderRadius: 9,
    },

    imageOptionText: {
        flex: 1,
        minWidth: 0,
        color: "#111",
        fontSize: 13,
        fontWeight: "600",
    },

    saveButton: {
        backgroundColor: colors.primary,
        paddingVertical: 12,
        borderRadius: 10,
        alignItems: "center",
        marginTop: 2,
    },

    saveButtonText: {
        color: "white",
        fontSize: 16,
        fontWeight: "600",
    }

});
