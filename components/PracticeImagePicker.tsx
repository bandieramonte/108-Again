import { Image, Pressable, Text, View } from "react-native";
import {
    extraPracticeImageOptions,
    normalizePracticeImageKey,
    practiceImages,
} from "../constants/practiceImages";
import { useI18n } from "../i18n";
import { useGlobalStyles } from "../styles/theme";

export const CUSTOM_PRACTICE_IMAGE_FALLBACK = "generic";

type Props = {
    selectedImageKey: string;
    title?: string;
    onSelect: (imageKey: string) => void;
};

export default function PracticeImagePicker({
    selectedImageKey,
    title,
    onSelect,
}: Props) {
    const globalStyles = useGlobalStyles();
    const { t } = useI18n();
    const normalizedSelectedImageKey =
        normalizePracticeImageKey(selectedImageKey) ?? selectedImageKey;
    const options = [
        {
            key: CUSTOM_PRACTICE_IMAGE_FALLBACK,
            label: t("practiceImage.generic"),
        },
        ...extraPracticeImageOptions.map(option => ({
            key: option.key,
            label: t(option.labelKey),
        })),
    ];

    return (
        <View style={globalStyles.formImagePicker}>
            {title ? (
                <Text style={globalStyles.formImagePickerTitle}>
                    {title}
                </Text>
            ) : null}

            <View style={globalStyles.formImageOptionGrid}>
                {options.map(option => {
                    const selected = normalizedSelectedImageKey === option.key;

                    return (
                        <Pressable
                            key={option.key}
                            style={({ pressed }) => [
                                globalStyles.formImageOption,
                                selected &&
                                    globalStyles.formSelectedImageOption,
                                pressed && globalStyles.formOptionPressed,
                            ]}
                            onPress={() => onSelect(option.key)}
                            accessibilityRole="button"
                            accessibilityLabel={option.label}
                        >
                            <Image
                                source={practiceImages[option.key]}
                                style={globalStyles.formImageOptionImage}
                                resizeMode="contain"
                            />
                            <Text
                                style={globalStyles.formImageOptionText}
                                numberOfLines={2}
                            >
                                {option.label}
                            </Text>
                        </Pressable>
                    );
                })}
            </View>
        </View>
    );
}
