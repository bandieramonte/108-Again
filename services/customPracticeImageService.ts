import { getSupabase } from "../lib/supabase";
import { randomUUID } from "expo-crypto";
import * as DocumentPicker from "expo-document-picker";
import { Directory, File, Paths } from "expo-file-system";
import {
    ImageManipulator,
    SaveFormat,
} from "expo-image-manipulator";
import { Image } from "react-native";
import {
    CUSTOM_PRACTICE_IMAGE_HEIGHT,
    CUSTOM_PRACTICE_IMAGE_WIDTH,
} from "../constants/customPracticeImages";

const CUSTOM_IMAGE_BUCKET = "practice-images";
const MAX_SOURCE_IMAGE_BYTES = 15 * 1024 * 1024;
const JPEG_QUALITY = 0.84;

export type CustomPracticeBackupImage = {
    mimeType: "image/jpeg";
    width: number;
    height: number;
    data: string;
};

function getImageDirectory() {
    const directory = new Directory(Paths.document, "practice-images");

    if (!directory.exists) {
        directory.create({ intermediates: true, idempotent: true });
    }

    return directory;
}

function getImageSize(uri: string) {
    return new Promise<{ width: number; height: number }>((resolve, reject) => {
        Image.getSize(
            uri,
            (width, height) => resolve({ width, height }),
            reject
        );
    });
}

function storagePath(userId: string, practiceId: string) {
    return `${userId}/${practiceId}.jpg`;
}

export async function pickAndNormalizeCustomPracticeImage() {
    const result = await DocumentPicker.getDocumentAsync({
        type: ["image/jpeg", "image/png", "image/webp"],
        copyToCacheDirectory: true,
        multiple: false,
    });

    if (result.canceled) return null;

    const asset = result.assets[0];

    if (asset.size != null && asset.size > MAX_SOURCE_IMAGE_BYTES) {
        throw new Error("IMAGE_TOO_LARGE");
    }

    const source = await getImageSize(asset.uri);

    if (source.width <= 0 || source.height <= 0) {
        throw new Error("INVALID_IMAGE");
    }

    const targetRatio =
        CUSTOM_PRACTICE_IMAGE_WIDTH / CUSTOM_PRACTICE_IMAGE_HEIGHT;
    const sourceRatio = source.width / source.height;
    let cropWidth = source.width;
    let cropHeight = source.height;

    if (sourceRatio > targetRatio) {
        cropWidth = source.height * targetRatio;
    } else if (sourceRatio < targetRatio) {
        cropHeight = source.width / targetRatio;
    }

    const context = ImageManipulator.manipulate(asset.uri);
    context
        .crop({
            originX: Math.max(0, Math.round((source.width - cropWidth) / 2)),
            originY: Math.max(0, Math.round((source.height - cropHeight) / 2)),
            width: Math.round(cropWidth),
            height: Math.round(cropHeight),
        })
        .resize({
            width: CUSTOM_PRACTICE_IMAGE_WIDTH,
            height: CUSTOM_PRACTICE_IMAGE_HEIGHT,
        });

    const renderedImage = await context.renderAsync();
    const manipulated = await renderedImage.saveAsync({
        compress: JPEG_QUALITY,
        format: SaveFormat.JPEG,
    });

    const destination = new File(
        getImageDirectory(),
        `${randomUUID()}.jpg`
    );
    new File(manipulated.uri).copy(destination);

    return destination.uri;
}

export function deleteLocalCustomPracticeImage(uri: string | null | undefined) {
    if (!uri) return;

    const file = new File(uri);

    if (file.exists) {
        file.delete();
    }
}

export async function readCustomPracticeImageForBackup(
    uri: string
): Promise<CustomPracticeBackupImage> {
    const file = new File(uri);

    if (!file.exists) {
        throw new Error("Custom practice image is missing from this device.");
    }

    return {
        mimeType: "image/jpeg",
        width: CUSTOM_PRACTICE_IMAGE_WIDTH,
        height: CUSTOM_PRACTICE_IMAGE_HEIGHT,
        data: await file.base64(),
    };
}

export function restoreCustomPracticeImageFromBackup(
    practiceId: string,
    image: CustomPracticeBackupImage
) {
    const destination = new File(
        getImageDirectory(),
        `backup-${practiceId}-${randomUUID()}.jpg`
    );

    destination.write(image.data, { encoding: "base64" });
    return destination.uri;
}

export async function uploadCustomPracticeImage(
    userId: string,
    practiceId: string,
    localUri: string
) {
    const file = new File(localUri);

    if (!file.exists) {
        throw new Error("Custom practice image is missing from this device.");
    }

    const { error } = await getSupabase().storage
        .from(CUSTOM_IMAGE_BUCKET)
        .upload(storagePath(userId, practiceId), await file.bytes(), {
            contentType: "image/jpeg",
            upsert: true,
        });

    if (error) throw error;
}

export async function downloadCustomPracticeImage(
    userId: string,
    practiceId: string,
    currentUri?: string | null
) {
    if (currentUri) {
        const current = new File(currentUri);

        if (current.exists) return current.uri;
    }

    const { data, error } = await getSupabase().storage
        .from(CUSTOM_IMAGE_BUCKET)
        .createSignedUrl(storagePath(userId, practiceId), 60);

    if (error) throw error;

    const destination = new File(
        getImageDirectory(),
        `${practiceId}.jpg`
    );

    try {
        const downloaded = await File.downloadFileAsync(
            data.signedUrl,
            destination,
            { idempotent: true }
        );

        return downloaded.uri;
    } catch (error) {
        if (destination.exists) {
            destination.delete();
        }

        throw error;
    }
}

export async function removeRemoteCustomPracticeImage(
    userId: string,
    practiceId: string
) {
    const { error } = await getSupabase().storage
        .from(CUSTOM_IMAGE_BUCKET)
        .remove([storagePath(userId, practiceId)]);

    if (error) throw error;
}

export async function removeAllRemoteCustomPracticeImages(userId: string) {
    const bucket = getSupabase().storage.from(CUSTOM_IMAGE_BUCKET);
    const { data, error } = await bucket.list(userId, { limit: 100 });

    if (error) throw error;
    if (!data?.length) return;

    const { error: removeError } = await bucket.remove(
        data.map(item => `${userId}/${item.name}`)
    );

    if (removeError) throw removeError;
}
