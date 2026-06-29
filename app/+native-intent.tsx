function getUrl(path: string) {
    try {
        return new URL(path);
    } catch {
        try {
            return new URL(path, "app108again://placeholder");
        } catch {
            return null;
        }
    }
}

function isResetPasswordUrl(url: URL) {
    const pathName = url.pathname.replace(/^\/+/, "");

    return url.hostname === "reset-password" || pathName === "reset-password";
}

function getRecoveryParams(url: URL) {
    const hash = url.hash.startsWith("#") ? url.hash.slice(1) : url.hash;
    const hashParams = new URLSearchParams(hash);

    return {
        accessToken:
            hashParams.get("access_token") ?? url.searchParams.get("access_token"),
        refreshToken:
            hashParams.get("refresh_token") ?? url.searchParams.get("refresh_token"),
        type: hashParams.get("type") ?? url.searchParams.get("type"),
    };
}

export function redirectSystemPath({
    path,
}: {
    path: string;
    initial: boolean;
}) {
    const url = getUrl(path);
    if (!url || !isResetPasswordUrl(url)) return path;

    const { accessToken, refreshToken, type } = getRecoveryParams(url);
    if (type !== "recovery" || !accessToken || !refreshToken) return path;

    const params = new URLSearchParams({
        access_token: accessToken,
        refresh_token: refreshToken,
        type,
    });

    return `/reset-password?${params.toString()}`;
}
