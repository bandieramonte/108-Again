import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
    Image,
    ActivityIndicator,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CUSTOM_PRACTICE_IMAGE_FALLBACK } from "../components/PracticeImagePicker";
import { DEFAULT_PRACTICES } from "../constants/defaultPractices";
import {
    CUSTOM_PRACTICE_IMAGE_KEY,
    mantraCounterImageOptions,
    normalizePracticeImageKey,
    practiceImages,
} from "../constants/practiceImages";
import { useI18n } from "../i18n";
import { getPracticeDisplayName } from "../i18n/practiceNames";
import * as practiceService from "../services/practiceService";
import {
    deleteLocalCustomPracticeImage,
    pickAndNormalizeCustomPracticeImage,
} from "../services/customPracticeImageService";
import { useAppTheme, useGlobalStyles } from "../styles/theme";
import {
    digitsOnly,
    formatNumberInput,
    MAX_PRACTICE_NAME,
    MAX_REPETITIONS_PER_DAY,
    MAX_TARGET_COUNT,
    parseFormattedNumberInput,
    validateRepetitionCount,
    validateTargetCount,
} from "../utils/numberUtils";

export default function AddPractice() {

    const router = useRouter();
    const insets = useSafeAreaInsets();
    const globalStyles = useGlobalStyles();
    const { colors } = useAppTheme();
    const { locale, t } = useI18n();
    const formBottomPadding = Math.max(36, insets.bottom + 24);

    const [name, setName] = useState("");
    const [target, setTarget] = useState("");
    const [defaultSession, setDefaultSession] =
        useState(formatNumberInput("108", locale));
    const [selectedSeedId, setSelectedSeedId] = useState<string | null>(null);
    const [selectedExtraImageKey, setSelectedExtraImageKey] =
        useState<string | null>(null);
    const [customImageUri, setCustomImageUri] = useState<string | null>(null);
    const [pendingCustomImageUri, setPendingCustomImageUri] =
        useState<string | null>(null);
    const [uploadModalOpen, setUploadModalOpen] = useState(false);
    const [processingImage, setProcessingImage] = useState(false);
    const customImageUriRef = useRef<string | null>(null);
    const customImageCommittedRef = useRef(false);

    useEffect(() => {
        customImageUriRef.current = customImageUri;
    }, [customImageUri]);

    useEffect(() => {
        return () => {
            if (!customImageCommittedRef.current) {
                deleteLocalCustomPracticeImage(customImageUriRef.current);
            }
        };
    }, []);

    const activePractices = practiceService.getAllPractices();
    const activePracticeIds = new Set(
        activePractices.map(practice => practice.id)
    );
    const activeMantraCounterImageKeys = new Set(
        activePractices
            .map(practice => normalizePracticeImageKey(practice.imageKey))
            .filter((imageKey): imageKey is string =>
                typeof imageKey === "string"
            )
    );
    const availableMantraCounterImageOptions =
        mantraCounterImageOptions.filter(
            option =>
                option.key === CUSTOM_PRACTICE_IMAGE_FALLBACK ||
                !activeMantraCounterImageKeys.has(option.key)
        );
    const missingSeedPractices =
        DEFAULT_PRACTICES.filter(practice => !activePracticeIds.has(practice.id));
    const selectedSeedPractice =
        selectedSeedId
            ? DEFAULT_PRACTICES.find(practice => practice.id === selectedSeedId) ?? null
            : null;
    const selectedMantraCounterOption =
        selectedExtraImageKey
            ? mantraCounterImageOptions.find(option => option.key === selectedExtraImageKey) ?? null
            : null;
    const isSeedMode = selectedSeedPractice !== null;

    function selectSeedPractice(seedPractice: typeof DEFAULT_PRACTICES[number]) {
        setSelectedSeedId(seedPractice.id);
        setSelectedExtraImageKey(null);
        setName(getPracticeDisplayName(seedPractice.id, seedPractice.name, t));
        setTarget(formatNumberInput(String(seedPractice.targetCount), locale));
        setDefaultSession(
            formatNumberInput(
                String(seedPractice.defaultSessionCount ?? 108),
                locale
            )
        );
    }

    function selectMantraCounterOption(
        option: typeof mantraCounterImageOptions[number]
    ) {
        const wasSeedMode = selectedSeedId !== null;

        setSelectedSeedId(null);
        setSelectedExtraImageKey(option.key);
        setName(
            option.key === CUSTOM_PRACTICE_IMAGE_FALLBACK
                ? ""
                : t(option.labelKey).slice(0, MAX_PRACTICE_NAME)
        );

        if (wasSeedMode) {
            setTarget("");
            setDefaultSession(formatNumberInput("108", locale));
        }
    }

    function selectCustomPractice() {
        setSelectedSeedId(null);
        setSelectedExtraImageKey(null);
        setName("");
        setTarget("");
        setDefaultSession(formatNumberInput("108", locale));
    }

    function openUploadModal() {
        setPendingCustomImageUri(customImageUri);
        setUploadModalOpen(true);
    }

    function closeUploadModal() {
        if (
            pendingCustomImageUri &&
            pendingCustomImageUri !== customImageUri
        ) {
            deleteLocalCustomPracticeImage(pendingCustomImageUri);
        }

        setPendingCustomImageUri(null);
        setUploadModalOpen(false);
    }

    async function browseForImage() {
        setProcessingImage(true);

        try {
            const uri = await pickAndNormalizeCustomPracticeImage();

            if (!uri) return;

            if (
                pendingCustomImageUri &&
                pendingCustomImageUri !== customImageUri
            ) {
                deleteLocalCustomPracticeImage(pendingCustomImageUri);
            }

            setPendingCustomImageUri(uri);
        } catch (error) {
            alert(
                error instanceof Error && error.message === "IMAGE_TOO_LARGE"
                    ? t("practiceImage.tooLarge")
                    : t("practiceImage.invalid")
            );
        } finally {
            setProcessingImage(false);
        }
    }

    function useUploadedImage() {
        if (!pendingCustomImageUri) return;

        const wasSeedMode = selectedSeedId !== null;
        const wasAnotherImageOption =
            selectedExtraImageKey !== CUSTOM_PRACTICE_IMAGE_KEY;

        if (
            customImageUri &&
            customImageUri !== pendingCustomImageUri
        ) {
            deleteLocalCustomPracticeImage(customImageUri);
        }

        setCustomImageUri(pendingCustomImageUri);
        setPendingCustomImageUri(null);
        setSelectedSeedId(null);
        setSelectedExtraImageKey(CUSTOM_PRACTICE_IMAGE_KEY);
        setUploadModalOpen(false);

        if (wasSeedMode || wasAnotherImageOption) {
            setName("");
        }

        if (wasSeedMode) {
            setTarget("");
            setDefaultSession(formatNumberInput("108", locale));
        }
    }

    function selectUploadedImage() {
        if (!customImageUri) {
            openUploadModal();
            return;
        }

        const wasSeedMode = selectedSeedId !== null;
        const wasAnotherImageOption =
            selectedExtraImageKey !== CUSTOM_PRACTICE_IMAGE_KEY;
        setSelectedSeedId(null);
        setSelectedExtraImageKey(CUSTOM_PRACTICE_IMAGE_KEY);

        if (wasSeedMode || wasAnotherImageOption) {
            setName("");
        }

        if (wasSeedMode) {
            setTarget("");
            setDefaultSession(formatNumberInput("108", locale));
        }
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
                        targetCount: parseFormattedNumberInput(target),
                        defaultSessionCount:
                            parseFormattedNumberInput(defaultSession),
                    }
                );
                router.back();
            } catch (error: any) {
                alert(error.message);
            }
            return;
        }

        try {
            const usesCustomImage =
                selectedExtraImageKey === CUSTOM_PRACTICE_IMAGE_KEY;

            if (usesCustomImage && !customImageUri) {
                alert(t("practiceImage.invalid"));
                return;
            }

            practiceService.createPractice(
                name,
                parseFormattedNumberInput(target),
                null,
                parseFormattedNumberInput(defaultSession),
                usesCustomImage
                    ? CUSTOM_PRACTICE_IMAGE_KEY
                    : selectedMantraCounterOption?.key ??
                        CUSTOM_PRACTICE_IMAGE_FALLBACK,
                usesCustomImage ? customImageUri : null
            );

            if (!usesCustomImage && customImageUri) {
                deleteLocalCustomPracticeImage(customImageUri);
            }

            customImageCommittedRef.current = usesCustomImage;

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
                contentContainerStyle={[
                    globalStyles.sidePadding,
                    globalStyles.formScreen,
                    { paddingBottom: formBottomPadding },
                ]}
                keyboardShouldPersistTaps="handled"
            >

                <Text style={globalStyles.formTitle}>
                    {t("form.addPracticeTitle")}
                </Text>

                {missingSeedPractices.length > 0 && (
                    <View style={globalStyles.formSectionCard}>
                        <Text style={globalStyles.formSectionTitle}>
                            {t("addPractice.restoreSeedPractice")}
                        </Text>
                        <Text style={globalStyles.formSectionDescription}>
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
                                            {
                                                backgroundColor:
                                                    colors.inputBackground,
                                                borderColor:
                                                    colors.borderSubtle,
                                            },
                                            selected && styles.selectedOption,
                                            selected && {
                                                backgroundColor:
                                                    colors.surfaceSelected,
                                                borderColor: colors.primary,
                                            },
                                            pressed &&
                                                globalStyles.formOptionPressed,
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
                                                    : practiceImages[CUSTOM_PRACTICE_IMAGE_FALLBACK]
                                            }
                                            style={styles.seedImage}
                                            resizeMode="contain"
                                        />
                                        <Text
                                            style={[
                                                styles.seedName,
                                                { color: colors.textPrimary },
                                            ]}
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

                <View style={globalStyles.formSectionCard}>
                    {!isSeedMode ? (
                        <Text style={globalStyles.formSectionTitle}>
                            {t("addPractice.customPractice")}
                        </Text>
                    ) : (
                        <View style={styles.customModeRow}>
                            <Pressable
                                style={({ pressed }) => [
                                    styles.customModeButton,
                                    { borderColor: colors.primary },
                                    pressed && globalStyles.formOptionPressed,
                                ]}
                                onPress={selectCustomPractice}
                                accessibilityRole="button"
                                accessibilityLabel={t("addPractice.customPractice")}
                            >
                                <Text
                                    style={[
                                        styles.customModeButtonText,
                                        { color: colors.primary },
                                    ]}
                                >
                                    {t("addPractice.customInstead")}
                                </Text>
                            </Pressable>
                        </View>
                    )}

                    {isSeedMode && selectedSeedPractice ? (
                        <View
                            style={[
                                styles.fixedSeedPreview,
                                {
                                    backgroundColor: colors.surfaceSelected,
                                    borderColor: colors.quickAddBorder,
                                },
                            ]}
                        >
                            <Image
                                source={
                                    selectedSeedPractice.imageKey &&
                                        practiceImages[selectedSeedPractice.imageKey]
                                        ? practiceImages[selectedSeedPractice.imageKey]
                                        : practiceImages[CUSTOM_PRACTICE_IMAGE_FALLBACK]
                                }
                                style={styles.fixedSeedImage}
                                resizeMode="contain"
                            />
                            <View style={styles.fixedSeedText}>
                                <Text
                                    style={[
                                        styles.fixedSeedName,
                                        { color: colors.textPrimary },
                                    ]}
                                >
                                    {getPracticeDisplayName(
                                        selectedSeedPractice.id,
                                        selectedSeedPractice.name,
                                        t
                                    )}
                                </Text>
                            </View>
                        </View>
                    ) : null}

                    {!isSeedMode && (
                        <View style={styles.extraPracticeBlock}>
                            <View style={styles.seedGrid}>
                                {availableMantraCounterImageOptions.map(option => {
                                    const optionName = t(option.labelKey);
                                    const selected =
                                        selectedExtraImageKey === option.key;

                                    return (
                                        <Pressable
                                            key={option.key}
                                            style={({ pressed }) => [
                                                styles.seedOption,
                                                {
                                                    backgroundColor:
                                                        colors.inputBackground,
                                                    borderColor:
                                                        colors.borderSubtle,
                                                },
                                                selected && styles.selectedOption,
                                                selected && {
                                                    backgroundColor:
                                                        colors.surfaceSelected,
                                                    borderColor: colors.primary,
                                                },
                                                pressed &&
                                                    globalStyles.formOptionPressed,
                                            ]}
                                            onPress={() => selectMantraCounterOption(option)}
                                            accessibilityRole="button"
                                            accessibilityLabel={`${t("addPractice.customPractice")}: ${optionName}`}
                                        >
                                            <Image
                                                source={practiceImages[option.key]}
                                                style={styles.seedImage}
                                                resizeMode="contain"
                                            />
                                            <Text
                                                style={[
                                                    styles.seedName,
                                                    {
                                                        color:
                                                            colors.textPrimary,
                                                    },
                                                ]}
                                                numberOfLines={2}
                                            >
                                                {optionName}
                                            </Text>
                                        </Pressable>
                                    );
                                })}
                                <Pressable
                                    style={({ pressed }) => [
                                        styles.seedOption,
                                        {
                                            backgroundColor: colors.inputBackground,
                                            borderColor: colors.borderSubtle,
                                        },
                                        selectedExtraImageKey ===
                                            CUSTOM_PRACTICE_IMAGE_KEY &&
                                            styles.selectedOption,
                                        selectedExtraImageKey ===
                                            CUSTOM_PRACTICE_IMAGE_KEY && {
                                            backgroundColor: colors.surfaceSelected,
                                            borderColor: colors.primary,
                                        },
                                        pressed && globalStyles.formOptionPressed,
                                    ]}
                                    onPress={selectUploadedImage}
                                    accessibilityRole="button"
                                    accessibilityLabel={t("practiceImage.upload")}
                                >
                                    <View style={styles.uploadCardImageWrap}>
                                        {customImageUri ? (
                                            <Image
                                                source={{ uri: customImageUri }}
                                                style={styles.seedImage}
                                                resizeMode="contain"
                                            />
                                        ) : (
                                            <View
                                                style={[
                                                    styles.uploadCardPlaceholder,
                                                    {
                                                        backgroundColor:
                                                            colors.surfaceElevated,
                                                        borderColor:
                                                            colors.iconMuted,
                                                    },
                                                ]}
                                            >
                                                <MaterialIcons
                                                    name="add-photo-alternate"
                                                    size={30}
                                                    color={colors.primary}
                                                />
                                            </View>
                                        )}
                                    </View>
                                    <Text
                                        style={[
                                            styles.seedName,
                                            { color: colors.textPrimary },
                                        ]}
                                        numberOfLines={2}
                                    >
                                        {t("practiceImage.upload")}
                                    </Text>
                                    {customImageUri && (
                                        <Pressable
                                            onPress={(event) => {
                                                event.stopPropagation();
                                                openUploadModal();
                                            }}
                                            hitSlop={6}
                                            accessibilityRole="button"
                                            accessibilityLabel={t("practiceImage.change")}
                                        >
                                            <Text
                                                style={[
                                                    styles.changeImageText,
                                                    { color: colors.primary },
                                                ]}
                                            >
                                                {t("practiceImage.change")}
                                            </Text>
                                        </Pressable>
                                    )}
                                </Pressable>
                            </View>
                        </View>
                    )}

                    <Text style={globalStyles.formInputLabel}>
                        {t("form.practiceName")}
                    </Text>
                    <TextInput
                        placeholder={t("form.practiceName")}
                        placeholderTextColor={colors.inputPlaceholder}
                        value={name}
                        onChangeText={(text) => setName(text.slice(0, MAX_PRACTICE_NAME))}
                        maxLength={25}
                        editable={!isSeedMode}
                        style={[
                            globalStyles.formInput,
                            isSeedMode && globalStyles.formReadOnlyInput,
                        ]}
                    />

                    <Text style={globalStyles.formInputLabel}>
                        {t("form.targetCount")}
                    </Text>
                    <TextInput
                        placeholder={t("form.targetCount")}
                        placeholderTextColor={colors.inputPlaceholder}
                        value={target}
                        onChangeText={(v) => {
                            const clean = digitsOnly(v);
                            if (Number(clean) > MAX_TARGET_COUNT) return;
                            setTarget(formatNumberInput(clean, locale));
                        }}
                        keyboardType="numeric"
                        style={globalStyles.formInput}
                    />

                    <Text style={globalStyles.formInputLabel}>
                        {t("form.defaultSessionCount")}
                    </Text>
                    <TextInput
                        placeholder={t("form.defaultSessionCount")}
                        placeholderTextColor={colors.inputPlaceholder}
                        value={defaultSession}
                        onChangeText={(v) => {
                            const clean = digitsOnly(v);
                            if (Number(clean) > MAX_REPETITIONS_PER_DAY) return;
                            setDefaultSession(formatNumberInput(clean, locale));
                        }}
                        keyboardType="numeric"
                        style={globalStyles.formInput}
                    />

                </View>

                <Pressable
                    style={globalStyles.formSaveButton}
                    onPress={savePractice}
                >
                    <Text style={globalStyles.formSaveButtonText}>
                        {t("common.add")}
                    </Text>
                </Pressable>

            </ScrollView>

            <Modal
                visible={uploadModalOpen}
                transparent
                animationType="fade"
                onRequestClose={closeUploadModal}
            >
                <View
                    style={[
                        styles.modalOverlay,
                        { backgroundColor: colors.overlay },
                    ]}
                >
                    <View
                        style={[
                            styles.uploadModalCard,
                            { backgroundColor: colors.surfaceElevated },
                        ]}
                    >
                        <Text
                            style={[
                                styles.uploadModalTitle,
                                { color: colors.textPrimary },
                            ]}
                        >
                            {t("practiceImage.uploadTitle")}
                        </Text>
                        <Text
                            style={[
                                styles.uploadGuidance,
                                { color: colors.textSecondary },
                            ]}
                        >
                            {t("practiceImage.uploadGuidance", {
                                pixels: (165000).toLocaleString(locale),
                            })}
                        </Text>

                        <Pressable
                            style={({ pressed }) => [
                                styles.uploadPreview,
                                {
                                    backgroundColor: colors.inputBackground,
                                    borderColor: colors.borderSubtle,
                                    borderStyle: pendingCustomImageUri
                                        ? "solid"
                                        : "dashed",
                                },
                                pressed && globalStyles.formOptionPressed,
                            ]}
                            onPress={() => void browseForImage()}
                            disabled={processingImage}
                            accessibilityRole="button"
                            accessibilityLabel={t("practiceImage.browseFiles")}
                        >
                            {pendingCustomImageUri ? (
                                <Image
                                    source={{ uri: pendingCustomImageUri }}
                                    style={styles.uploadPreviewImage}
                                    resizeMode="contain"
                                />
                            ) : (
                                <MaterialIcons
                                    name="add-photo-alternate"
                                    size={48}
                                    color={colors.primary}
                                />
                            )}
                        </Pressable>

                        <Pressable
                            style={[
                                styles.browseButton,
                                { backgroundColor: colors.primary },
                            ]}
                            onPress={() => void browseForImage()}
                            disabled={processingImage}
                            accessibilityRole="button"
                        >
                            {processingImage ? (
                                <ActivityIndicator color="#FFFFFF" />
                            ) : (
                                <Text style={styles.browseButtonText}>
                                    {t("practiceImage.browseFiles")}
                                </Text>
                            )}
                        </Pressable>

                        {processingImage && (
                            <Text
                                style={[
                                    styles.processingText,
                                    { color: colors.textSecondary },
                                ]}
                            >
                                {t("practiceImage.processing")}
                            </Text>
                        )}

                        <View style={styles.modalButtons}>
                            <Pressable
                                onPress={closeUploadModal}
                                disabled={processingImage}
                            >
                                <Text style={{ color: colors.textSecondary }}>
                                    {t("common.cancel")}
                                </Text>
                            </Pressable>
                            <Pressable
                                onPress={useUploadedImage}
                                disabled={!pendingCustomImageUri || processingImage}
                            >
                                <Text
                                    style={{
                                        color: pendingCustomImageUri
                                            ? colors.primary
                                            : colors.iconMuted,
                                        fontWeight: "700",
                                    }}
                                >
                                    {t("practiceImage.useImage")}
                                </Text>
                            </Pressable>
                        </View>
                    </View>
                </View>
            </Modal>
        </KeyboardAvoidingView>

    );
}

const styles = StyleSheet.create({
    customModeRow: {
        flexDirection: "row",
        justifyContent: "flex-end",
        marginBottom: 12,
    },

    extraPracticeBlock: {
        marginBottom: 12,
    },

    seedGrid: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 10,
    },

    seedOption: {
        width: "31%",
        minWidth: 92,
        minHeight: 112,
        alignItems: "center",
        justifyContent: "center",
        gap: 7,
        borderWidth: 1,
        borderColor: "#E1E7F5",
        borderRadius: 14,
        backgroundColor: "white",
        padding: 9,
    },

    selectedOption: {
        backgroundColor: "#EEF2FF",
    },

    seedImage: {
        width: 48,
        height: 48,
        borderRadius: 10,
    },

    uploadCardImageWrap: {
        position: "relative",
    },

    uploadCardPlaceholder: {
        width: 48,
        height: 48,
        borderWidth: 1,
        borderStyle: "dashed",
        borderRadius: 10,
        alignItems: "center",
        justifyContent: "center",
    },

    changeImageText: {
        fontSize: 11,
        fontWeight: "700",
        marginTop: -4,
    },

    modalOverlay: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        padding: 20,
    },

    uploadModalCard: {
        width: "100%",
        maxWidth: 380,
        borderRadius: 16,
        padding: 20,
        alignItems: "center",
    },

    uploadModalTitle: {
        alignSelf: "stretch",
        fontSize: 20,
        fontWeight: "800",
        marginBottom: 8,
    },

    uploadGuidance: {
        alignSelf: "stretch",
        fontSize: 14,
        lineHeight: 20,
        marginBottom: 16,
    },

    uploadPreview: {
        width: 154,
        height: 172,
        borderWidth: 1,
        borderRadius: 14,
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        marginBottom: 18,
    },

    uploadPreviewImage: {
        width: "100%",
        height: "100%",
    },

    browseButton: {
        minWidth: 160,
        minHeight: 44,
        paddingHorizontal: 20,
        borderRadius: 999,
        alignItems: "center",
        justifyContent: "center",
    },

    browseButtonText: {
        color: "#FFFFFF",
        fontSize: 15,
        fontWeight: "700",
    },

    processingText: {
        marginTop: 8,
        fontSize: 13,
    },

    modalButtons: {
        alignSelf: "stretch",
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginTop: 22,
        paddingHorizontal: 4,
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
        borderRadius: 999,
        paddingVertical: 6,
        paddingHorizontal: 12,
    },

    customModeButtonText: {
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

});
