import { AUTH_FIELD_LIMITS } from "../constants/authFieldLimits";

type AuthErrorLike = {
    message?: string;
};

type AuthResult = {
    error?: AuthErrorLike | null;
};

type AuthLogger = Pick<Console, "warn">;

type WithTimeout = <T>(
    promiseFactory: () => Promise<T>,
    ms?: number
) => Promise<T>;

export type DeleteAccountCoreDeps = {
    invokeDeleteUser: () => Promise<AuthResult>;
    isUserDeleted: () => Promise<boolean>;
    logger?: AuthLogger;
    onAccountDeletedDespiteInvokeError?: () => void;
    signOutDeletedAccount: () => Promise<void>;
    withTimeout: WithTimeout;
};

export type ResetPasswordCoreDeps = {
    redirectTo: string;
    resetPasswordForEmail: (
        email: string,
        options: { redirectTo: string }
    ) => Promise<AuthResult>;
};

function validateAuthFieldLength(
    value: string,
    label: string,
    maxLength: number
) {
    if (value.length > maxLength) {
        throw new Error(`${label} must be ${maxLength} characters or fewer.`);
    }
}

export async function deleteAccountCore(
    deps: DeleteAccountCoreDeps
) {
    try {
        const { error } = await deps.withTimeout(
            () => deps.invokeDeleteUser(),
            15000
        );

        if (error) {
            deps.logger?.warn("Delete account error:", error);

            const deleted = await deps.isUserDeleted();

            if (deleted) {
                deps.onAccountDeletedDespiteInvokeError?.();
                await deps.signOutDeletedAccount();
                return;
            }

            throw new Error(
                "Failed to delete account. Please try again."
            );
        }

        await deps.signOutDeletedAccount();

    } catch (e: any) {
        if (e?.message?.includes("timeout")) {
            throw new Error(
                "Request timed out. Please try again in a few minutes. If the issue persists, please reopen the app and try again."
            );
        }

        throw e;
    }
}

export async function resetPasswordCore(
    deps: ResetPasswordCoreDeps,
    email: string
) {

    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedEmail) {
        throw new Error("Email is required.");
    }

    validateAuthFieldLength(
        trimmedEmail,
        "Email",
        AUTH_FIELD_LIMITS.email
    );

    const { error } = await deps.resetPasswordForEmail(
        trimmedEmail,
        {
            redirectTo: deps.redirectTo,
        }
    );

    if (error) {
        throw new Error(error.message);
    }
}
