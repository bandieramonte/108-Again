import { MaterialIcons } from "@expo/vector-icons";
import { useEffect, useRef, useState } from "react";
import { getPracticeImageSource } from "../constants/practiceImages";
import {
    ActivityIndicator,
    Image,
    Modal,
    Pressable,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { useI18n } from "../i18n";
import {
    deleteLocalCustomPracticeImage,
    pickAndNormalizeCustomPracticeImage,
} from "../services/customPracticeImageService";
import { useAppTheme, useGlobalStyles } from "../styles/theme";

type Props = {
    imageKey: string | null;
    currentUri: string | null;
    onReplace: (uri: string) => void;
    onRestoreOriginal?: () => void;
};

export default function CustomPracticeImageEditor({
    imageKey,
    currentUri,
    onReplace,
    onRestoreOriginal,
}: Props) {
    const { colors } = useAppTheme();
    const globalStyles = useGlobalStyles();
    const { locale, t } = useI18n();
    const [visible, setVisible] = useState(false);
    const [pendingUri, setPendingUri] = useState<string | null>(null);
    const [processing, setProcessing] = useState(false);
    const currentUriRef = useRef(currentUri);
    const pendingUriRef = useRef(pendingUri);

    useEffect(() => {
        currentUriRef.current = currentUri;
    }, [currentUri]);

    useEffect(() => {
        pendingUriRef.current = pendingUri;
    }, [pendingUri]);

    useEffect(() => {
        return () => {
            const stagedUri = pendingUriRef.current;

            if (stagedUri && stagedUri !== currentUriRef.current) {
                deleteLocalCustomPracticeImage(stagedUri);
            }
        };
    }, []);

    function openEditor() {
        setPendingUri(currentUri);
        setVisible(true);
    }

    function closeEditor() {
        if (pendingUri && pendingUri !== currentUri) {
            deleteLocalCustomPracticeImage(pendingUri);
        }

        setPendingUri(null);
        setVisible(false);
    }

    async function browseForImage() {
        setProcessing(true);

        try {
            const uri = await pickAndNormalizeCustomPracticeImage();

            if (!uri) return;

            if (pendingUri && pendingUri !== currentUri) {
                deleteLocalCustomPracticeImage(pendingUri);
            }

            pendingUriRef.current = uri;
            setPendingUri(uri);
        } catch (error) {
            alert(
                error instanceof Error && error.message === "IMAGE_TOO_LARGE"
                    ? t("practiceImage.tooLarge")
                    : t("practiceImage.invalid")
            );
        } finally {
            setProcessing(false);
        }
    }

    function useImage() {
        if (!pendingUri) return;

        if (pendingUri === currentUri) {
            setPendingUri(null);
            setVisible(false);
            return;
        }

        try {
            onReplace(pendingUri);
            currentUriRef.current = pendingUri;
            pendingUriRef.current = null;
            setPendingUri(null);
            setVisible(false);
        } catch (error) {
            alert(
                error instanceof Error
                    ? error.message
                    : t("practiceImage.invalid")
            );
        }
    }

    function restoreOriginalImage() {
        if (!onRestoreOriginal) return;
        try {
            onRestoreOriginal();
            if (pendingUri && pendingUri !== currentUri) {
                deleteLocalCustomPracticeImage(pendingUri);
            }
            currentUriRef.current = null;
            pendingUriRef.current = null;
            setPendingUri(null);
            setVisible(false);
        } catch (error) {
            alert(error instanceof Error ? error.message : t("practiceImage.invalid"));
        }
    }

    return (
        <>
            <Pressable
                style={({ pressed }) => [
                    styles.editorCard,
                    onRestoreOriginal && { marginBottom: 0 },
                    {
                        backgroundColor: colors.inputBackground,
                        borderColor: colors.borderSubtle,
                    },
                    pressed && globalStyles.formOptionPressed,
                ]}
                onPress={openEditor}
                accessibilityRole="button"
                accessibilityLabel={t("practiceImage.change")}
            >
                {imageKey ? (
                    <Image
                        source={getPracticeImageSource(imageKey, currentUri)}
                        style={styles.currentImage}
                        resizeMode="contain"
                    />
                ) : (
                    <View
                        style={[
                            styles.currentImagePlaceholder,
                            { borderColor: colors.iconMuted },
                        ]}
                    >
                        <MaterialIcons
                            name="add-photo-alternate"
                            size={32}
                            color={colors.primary}
                        />
                    </View>
                )}

                <Text
                    style={[styles.changeText, { color: colors.primary }]}
                >
                    {t("practiceImage.change")}
                </Text>

                <MaterialIcons
                    name="chevron-right"
                    size={22}
                    color={colors.iconMuted}
                />
            </Pressable>

            {onRestoreOriginal && (
                <Pressable
                    style={[
                        styles.restoreButton,
                        {
                            backgroundColor: colors.inputBackground,
                            borderColor: colors.borderSubtle,
                        },
                    ]}
                    onPress={restoreOriginalImage}
                    accessibilityRole="button"
                    accessibilityLabel={t("practiceImage.restoreOriginal")}
                >
                    <MaterialIcons
                        name="restore"
                        size={20}
                        color={colors.primary}
                    />
                    <Text
                        style={[
                            styles.restoreButtonText,
                            { color: colors.primary },
                        ]}
                    >
                        {t("practiceImage.restoreOriginal")}
                    </Text>
                </Pressable>
            )}

            <Modal
                visible={visible}
                transparent
                animationType="fade"
                onRequestClose={closeEditor}
            >
                <View
                    style={[
                        styles.modalOverlay,
                        { backgroundColor: colors.overlay },
                    ]}
                >
                    <View
                        style={[
                            styles.modalCard,
                            { backgroundColor: colors.surfaceElevated },
                        ]}
                    >
                        <Text
                            style={[
                                styles.modalTitle,
                                { color: colors.textPrimary },
                            ]}
                        >
                            {t("practiceImage.change")}
                        </Text>

                        <Text
                            style={[
                                styles.guidance,
                                { color: colors.textSecondary },
                            ]}
                        >
                            {t("practiceImage.uploadGuidance", {
                                pixels: (165000).toLocaleString(locale),
                            })}
                        </Text>

                        <Pressable
                            style={({ pressed }) => [
                                styles.preview,
                                {
                                    backgroundColor: colors.inputBackground,
                                    borderColor: colors.borderSubtle,
                                    borderStyle: pendingUri
                                        ? "solid"
                                        : "dashed",
                                },
                                pressed && globalStyles.formOptionPressed,
                            ]}
                            onPress={() => void browseForImage()}
                            disabled={processing}
                            accessibilityRole="button"
                            accessibilityLabel={t(
                                "practiceImage.browseFiles"
                            )}
                        >
                            {pendingUri ? (
                                <Image
                                    source={{ uri: pendingUri }}
                                    style={styles.previewImage}
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
                            disabled={processing}
                            accessibilityRole="button"
                        >
                            {processing ? (
                                <ActivityIndicator color="#FFFFFF" />
                            ) : (
                                <Text style={styles.browseButtonText}>
                                    {t("practiceImage.browseFiles")}
                                </Text>
                            )}
                        </Pressable>

                        {processing && (
                            <Text
                                style={[
                                    styles.processingText,
                                    { color: colors.textSecondary },
                                ]}
                            >
                                {t("practiceImage.processing")}
                            </Text>
                        )}

                        <View style={styles.actions}>
                            <Pressable
                                onPress={closeEditor}
                                disabled={processing}
                            >
                                <Text style={{ color: colors.textSecondary }}>
                                    {t("common.cancel")}
                                </Text>
                            </Pressable>

                            <Pressable
                                onPress={useImage}
                                disabled={!pendingUri || processing}
                            >
                                <Text
                                    style={{
                                        color: pendingUri
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
        </>
    );
}

const styles = StyleSheet.create({
    editorCard: {
        minHeight: 92,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        borderWidth: 1,
        borderRadius: 14,
        padding: 10,
        marginBottom: 14,
    },
    currentImage: {
        width: 64,
        height: 72,
        borderRadius: 10,
    },
    currentImagePlaceholder: {
        width: 64,
        height: 72,
        borderWidth: 1,
        borderStyle: "dashed",
        borderRadius: 10,
        alignItems: "center",
        justifyContent: "center",
    },
    changeText: {
        flex: 1,
        fontSize: 15,
        fontWeight: "700",
    },
    modalOverlay: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        padding: 20,
    },
    modalCard: {
        width: "100%",
        maxWidth: 380,
        borderRadius: 16,
        padding: 20,
        alignItems: "center",
    },
    modalTitle: {
        alignSelf: "stretch",
        fontSize: 20,
        fontWeight: "800",
        marginBottom: 8,
    },
    guidance: {
        alignSelf: "stretch",
        fontSize: 14,
        lineHeight: 20,
        marginBottom: 16,
    },
    preview: {
        width: 154,
        height: 172,
        borderWidth: 1,
        borderRadius: 14,
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        marginBottom: 18,
    },
    previewImage: {
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
    restoreButton: {
        alignSelf: "stretch",
        minHeight: 44,
        marginTop: 8,
        marginBottom: 14,
        borderWidth: 1,
        borderRadius: 12,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
    },
    restoreButtonText: {
        fontSize: 15,
        fontWeight: "700",
    },
    processingText: {
        marginTop: 8,
        fontSize: 13,
    },
    actions: {
        alignSelf: "stretch",
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginTop: 22,
        paddingHorizontal: 4,
    },
});
