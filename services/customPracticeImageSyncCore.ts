type CustomImageBucket = {
    upload(
        path: string,
        data: Uint8Array,
        options: {
            cacheControl: string;
            contentType: string;
            upsert: boolean;
        }
    ): PromiseLike<{ error: unknown }>;
    createSignedUrl(
        path: string,
        expiresIn: number
    ): PromiseLike<{
        data: { signedUrl: string } | null;
        error: unknown;
    }>;
    list(
        path: string,
        options: { limit: number }
    ): PromiseLike<{
        data: { name: string }[] | null;
        error: unknown;
    }>;
    remove(paths: string[]): PromiseLike<{ error: unknown }>;
};

type CustomPracticeImageSyncCoreDeps = {
    deleteLocal(uri: string | null | undefined): void;
    downloadToLocal(url: string, practiceId: string): Promise<string>;
    getBucket(): CustomImageBucket;
    readLocalBytes(uri: string): Promise<Uint8Array>;
};

function storagePath(userId: string, practiceId: string) {
    return `${userId}/${practiceId}.jpg`;
}

export function createCustomPracticeImageSyncCore(
    deps: CustomPracticeImageSyncCoreDeps
) {
    return {
        deleteLocal: deps.deleteLocal,

        async upload(userId: string, practiceId: string, localUri: string) {
            const { error } = await deps.getBucket().upload(
                storagePath(userId, practiceId),
                await deps.readLocalBytes(localUri),
                {
                    cacheControl: "0",
                    contentType: "image/jpeg",
                    upsert: true,
                }
            );

            if (error) throw error;
        },

        async download(
            userId: string,
            practiceId: string,
            remoteUpdatedAt: string
        ) {
            const { data, error } = await deps.getBucket().createSignedUrl(
                storagePath(userId, practiceId),
                60
            );

            if (error) throw error;
            if (!data) throw new Error("Custom practice image URL is missing.");

            const separator = data.signedUrl.includes("?") ? "&" : "?";
            const versionedSignedUrl =
                `${data.signedUrl}${separator}v=` +
                encodeURIComponent(remoteUpdatedAt);

            return deps.downloadToLocal(versionedSignedUrl, practiceId);
        },

        async remove(userId: string, practiceId: string) {
            const { error } = await deps.getBucket().remove([
                storagePath(userId, practiceId),
            ]);

            if (error) throw error;
        },

        async removeAllForUser(userId: string) {
            const bucket = deps.getBucket();
            const { data, error } = await bucket.list(userId, { limit: 100 });

            if (error) throw error;
            if (!data?.length) return;

            const { error: removeError } = await bucket.remove(
                data.map(item => `${userId}/${item.name}`)
            );

            if (removeError) throw removeError;
        },
    };
}
