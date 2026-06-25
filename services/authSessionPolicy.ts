const UNRECOVERABLE_REFRESH_TOKEN_CODES = new Set([
    "refresh_token_not_found",
    "refresh_token_already_used",
]);

type AuthErrorLike = {
    code?: unknown;
    message?: unknown;
};

export function isUnrecoverableRefreshTokenError(
    error: unknown
): boolean {
    if (typeof error !== "object" || error === null) {
        return false;
    }

    const { code, message } = error as AuthErrorLike;

    if (
        typeof code === "string" &&
        UNRECOVERABLE_REFRESH_TOKEN_CODES.has(code)
    ) {
        return true;
    }

    return (
        typeof message === "string" &&
        message.toLowerCase().includes("invalid refresh token")
    );
}
