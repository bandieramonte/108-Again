export type AuthEmailLanguage = "en" | "es" | "ru";

type AuthEmailMessage = {
  button: string;
  fallback: string;
  footer: string;
  ignore: string;
  intro: string;
  preview: string;
  subject: string;
  title: string;
  tokenLabel: string;
};

const SUPPORTED_AUTH_EMAIL_LANGUAGES: AuthEmailLanguage[] = [
  "en",
  "es",
  "ru",
];

const DEFAULT_AUTH_EMAIL_LANGUAGE: AuthEmailLanguage = "en";

const authEmailTranslations: Record<
  AuthEmailLanguage,
  Record<string, AuthEmailMessage>
> = {
  en: {
    default: {
      button: "Open 108 Again",
      fallback: "If the button does not work, copy and paste this link into your browser:",
      footer: "108 Again",
      ignore: "If you did not request this email, you can safely ignore it.",
      intro: "Use the secure link below to continue.",
      preview: "Continue with 108 Again",
      subject: "Continue with 108 Again",
      title: "Continue with 108 Again",
      tokenLabel: "Temporary code:",
    },
    email_change: {
      button: "Confirm email change",
      fallback: "If the button does not work, copy and paste this link into your browser:",
      footer: "108 Again",
      ignore: "If you did not request this change, you can safely ignore this email.",
      intro: "Follow the link below to confirm your email address change.",
      preview: "Confirm your email address change",
      subject: "Confirm your email change",
      title: "Confirm your email change",
      tokenLabel: "Temporary code:",
    },
    invite: {
      button: "Accept invitation",
      fallback: "If the button does not work, copy and paste this link into your browser:",
      footer: "108 Again",
      ignore: "If you did not expect this invitation, you can safely ignore this email.",
      intro: "Follow the link below to accept your invitation and finish setting up your account.",
      preview: "Accept your 108 Again invitation",
      subject: "You have been invited to 108 Again",
      title: "Accept your invitation",
      tokenLabel: "Temporary code:",
    },
    magiclink: {
      button: "Log in",
      fallback: "If the button does not work, copy and paste this link into your browser:",
      footer: "108 Again",
      ignore: "If you did not request this login link, you can safely ignore this email.",
      intro: "Follow the link below to log in to 108 Again.",
      preview: "Log in to 108 Again",
      subject: "Log in to 108 Again",
      title: "Log in to 108 Again",
      tokenLabel: "Temporary code:",
    },
    reauthentication: {
      button: "Confirm it was you",
      fallback: "If the button does not work, copy and paste this link into your browser:",
      footer: "108 Again",
      ignore: "If you did not request this confirmation, you can safely ignore this email.",
      intro: "Follow the link below to confirm this sensitive account action.",
      preview: "Confirm your 108 Again account action",
      subject: "Confirm your 108 Again account action",
      title: "Confirm this action",
      tokenLabel: "Temporary code:",
    },
    recovery: {
      button: "Reset password",
      fallback: "If the button does not work, copy and paste this link into your browser:",
      footer: "108 Again",
      ignore: "If you did not request a password reset, you can safely ignore this email.",
      intro: "Follow the link below to reset the password for your account.",
      preview: "Reset your 108 Again password",
      subject: "Reset your password",
      title: "Reset password",
      tokenLabel: "Temporary code:",
    },
    signup: {
      button: "Confirm email address",
      fallback: "If the button does not work, copy and paste this link into your browser:",
      footer: "108 Again",
      ignore: "If you did not create a 108 Again account, you can safely ignore this email.",
      intro: "Follow the link below to confirm this email address and finish signing up.",
      preview: "Confirm your 108 Again email address",
      subject: "Confirm your email address",
      title: "Confirm your email address",
      tokenLabel: "Temporary code:",
    },
  },
  es: {
    default: {
      button: "Abrir 108 Again",
      fallback: "Si el botón no funciona, copia y pega este enlace en tu navegador:",
      footer: "108 Again",
      ignore: "Si no solicitaste este email, puedes ignorarlo.",
      intro: "Usa el enlace seguro de abajo para continuar.",
      preview: "Continuar con 108 Again",
      subject: "Continuar con 108 Again",
      title: "Continuar con 108 Again",
      tokenLabel: "Código temporal:",
    },
    email_change: {
      button: "Confirmar cambio de email",
      fallback: "Si el botón no funciona, copia y pega este enlace en tu navegador:",
      footer: "108 Again",
      ignore: "Si no solicitaste este cambio, puedes ignorar este email.",
      intro: "Sigue el enlace de abajo para confirmar el cambio de tu email.",
      preview: "Confirma el cambio de tu email",
      subject: "Confirma el cambio de tu email",
      title: "Confirmar cambio de email",
      tokenLabel: "Código temporal:",
    },
    invite: {
      button: "Aceptar invitación",
      fallback: "Si el botón no funciona, copia y pega este enlace en tu navegador:",
      footer: "108 Again",
      ignore: "Si no esperabas esta invitación, puedes ignorar este email.",
      intro: "Sigue el enlace de abajo para aceptar la invitación y terminar de configurar tu cuenta.",
      preview: "Acepta tu invitación a 108 Again",
      subject: "Te han invitado a 108 Again",
      title: "Aceptar invitación",
      tokenLabel: "Código temporal:",
    },
    magiclink: {
      button: "Iniciar sesión",
      fallback: "Si el botón no funciona, copia y pega este enlace en tu navegador:",
      footer: "108 Again",
      ignore: "Si no solicitaste este enlace de inicio de sesión, puedes ignorar este email.",
      intro: "Sigue el enlace de abajo para iniciar sesión en 108 Again.",
      preview: "Inicia sesión en 108 Again",
      subject: "Inicia sesión en 108 Again",
      title: "Iniciar sesión en 108 Again",
      tokenLabel: "Código temporal:",
    },
    reauthentication: {
      button: "Confirmar que fuiste tú",
      fallback: "Si el botón no funciona, copia y pega este enlace en tu navegador:",
      footer: "108 Again",
      ignore: "Si no solicitaste esta confirmación, puedes ignorar este email.",
      intro: "Sigue el enlace de abajo para confirmar esta acción sensible de la cuenta.",
      preview: "Confirma esta acción en 108 Again",
      subject: "Confirma esta acción en 108 Again",
      title: "Confirmar esta acción",
      tokenLabel: "Código temporal:",
    },
    recovery: {
      button: "Restablecer contraseña",
      fallback: "Si el botón no funciona, copia y pega este enlace en tu navegador:",
      footer: "108 Again",
      ignore: "Si no solicitaste restablecer la contraseña, puedes ignorar este email.",
      intro: "Sigue el enlace de abajo para restablecer la contraseña de tu cuenta.",
      preview: "Restablece tu contraseña de 108 Again",
      subject: "Restablece tu contraseña",
      title: "Restablecer contraseña",
      tokenLabel: "Código temporal:",
    },
    signup: {
      button: "Confirmar email",
      fallback: "Si el botón no funciona, copia y pega este enlace en tu navegador:",
      footer: "108 Again",
      ignore: "Si no creaste una cuenta de 108 Again, puedes ignorar este email.",
      intro: "Sigue el enlace de abajo para confirmar este email y terminar el registro.",
      preview: "Confirma tu email de 108 Again",
      subject: "Confirma tu email",
      title: "Confirma tu email",
      tokenLabel: "Código temporal:",
    },
  },
  ru: {
    default: {
      button: "Открыть 108 Again",
      fallback: "Если кнопка не работает, скопируйте и вставьте эту ссылку в браузер:",
      footer: "108 Again",
      ignore: "Если вы не запрашивали это письмо, его можно проигнорировать.",
      intro: "Используйте безопасную ссылку ниже, чтобы продолжить.",
      preview: "Продолжить в 108 Again",
      subject: "Продолжить в 108 Again",
      title: "Продолжить в 108 Again",
      tokenLabel: "Временный код:",
    },
    email_change: {
      button: "Подтвердить смену email",
      fallback: "Если кнопка не работает, скопируйте и вставьте эту ссылку в браузер:",
      footer: "108 Again",
      ignore: "Если вы не запрашивали это изменение, письмо можно проигнорировать.",
      intro: "Перейдите по ссылке ниже, чтобы подтвердить смену email.",
      preview: "Подтвердите смену email",
      subject: "Подтвердите смену email",
      title: "Подтвердить смену email",
      tokenLabel: "Временный код:",
    },
    invite: {
      button: "Принять приглашение",
      fallback: "Если кнопка не работает, скопируйте и вставьте эту ссылку в браузер:",
      footer: "108 Again",
      ignore: "Если вы не ожидали это приглашение, письмо можно проигнорировать.",
      intro: "Перейдите по ссылке ниже, чтобы принять приглашение и завершить настройку аккаунта.",
      preview: "Примите приглашение в 108 Again",
      subject: "Вас пригласили в 108 Again",
      title: "Принять приглашение",
      tokenLabel: "Временный код:",
    },
    magiclink: {
      button: "Войти",
      fallback: "Если кнопка не работает, скопируйте и вставьте эту ссылку в браузер:",
      footer: "108 Again",
      ignore: "Если вы не запрашивали ссылку для входа, письмо можно проигнорировать.",
      intro: "Перейдите по ссылке ниже, чтобы войти в 108 Again.",
      preview: "Войти в 108 Again",
      subject: "Войти в 108 Again",
      title: "Войти в 108 Again",
      tokenLabel: "Временный код:",
    },
    reauthentication: {
      button: "Подтвердить действие",
      fallback: "Если кнопка не работает, скопируйте и вставьте эту ссылку в браузер:",
      footer: "108 Again",
      ignore: "Если вы не запрашивали это подтверждение, письмо можно проигнорировать.",
      intro: "Перейдите по ссылке ниже, чтобы подтвердить это важное действие с аккаунтом.",
      preview: "Подтвердите действие в 108 Again",
      subject: "Подтвердите действие в 108 Again",
      title: "Подтвердить действие",
      tokenLabel: "Временный код:",
    },
    recovery: {
      button: "Сбросить пароль",
      fallback: "Если кнопка не работает, скопируйте и вставьте эту ссылку в браузер:",
      footer: "108 Again",
      ignore: "Если вы не запрашивали сброс пароля, письмо можно проигнорировать.",
      intro: "Перейдите по ссылке ниже, чтобы сбросить пароль вашего аккаунта.",
      preview: "Сбросьте пароль 108 Again",
      subject: "Сброс пароля",
      title: "Сброс пароля",
      tokenLabel: "Временный код:",
    },
    signup: {
      button: "Подтвердить email",
      fallback: "Если кнопка не работает, скопируйте и вставьте эту ссылку в браузер:",
      footer: "108 Again",
      ignore: "Если вы не создавали аккаунт 108 Again, письмо можно проигнорировать.",
      intro: "Перейдите по ссылке ниже, чтобы подтвердить email и завершить регистрацию.",
      preview: "Подтвердите email для 108 Again",
      subject: "Подтвердите email",
      title: "Подтвердите email",
      tokenLabel: "Временный код:",
    },
  },
};

type RenderAuthEmailInput = {
  actionType: string;
  firstName?: string | null;
  language: AuthEmailLanguage;
  token?: string | null;
  verificationUrl: string;
};

type BuildVerificationUrlInput = {
  actionType: string;
  redirectTo: string;
  supabaseUrl: string;
  tokenHash: string;
};

type GetAuthEmailLanguageInput = {
  redirectTo?: string | null;
  userMetadata?: Record<string, unknown> | null;
};

const ACTION_ALIASES: Record<string, string> = {
  email_change_current: "email_change",
  email_change_new: "email_change",
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normalizeActionType(actionType: string) {
  const normalized = actionType.trim().toLowerCase();

  return ACTION_ALIASES[normalized] ?? normalized;
}

export function normalizeAuthEmailLanguage(
  value: unknown
): AuthEmailLanguage | null {
  if (typeof value !== "string") return null;

  const normalized = value.trim().toLowerCase();

  return SUPPORTED_AUTH_EMAIL_LANGUAGES.includes(
    normalized as AuthEmailLanguage
  )
    ? (normalized as AuthEmailLanguage)
    : null;
}

function getLanguageFromRedirect(redirectTo?: string | null) {
  if (!redirectTo) return null;

  try {
    return normalizeAuthEmailLanguage(
      new URL(redirectTo).searchParams.get("lang")
    );
  } catch {
    return null;
  }
}

export function getAuthEmailLanguage({
  redirectTo,
  userMetadata,
}: GetAuthEmailLanguageInput): AuthEmailLanguage {
  return (
    getLanguageFromRedirect(redirectTo) ??
    normalizeAuthEmailLanguage(userMetadata?.preferred_language) ??
    DEFAULT_AUTH_EMAIL_LANGUAGE
  );
}

export function buildVerificationUrl({
  actionType,
  redirectTo,
  supabaseUrl,
  tokenHash,
}: BuildVerificationUrlInput) {
  const url = new URL("/auth/v1/verify", supabaseUrl);

  url.searchParams.set("token", tokenHash);
  url.searchParams.set("type", actionType);
  url.searchParams.set("redirect_to", redirectTo);

  return url.toString();
}

export function renderAuthEmail({
  actionType,
  firstName,
  language,
  token,
  verificationUrl,
}: RenderAuthEmailInput) {
  const messages = authEmailTranslations[language];
  const text =
    messages[normalizeActionType(actionType)] ?? messages.default;
  const safeTitle = escapeHtml(text.title);
  const safeIntro = escapeHtml(
    firstName ? `${firstName}, ${text.intro}` : text.intro
  );
  const safeButton = escapeHtml(text.button);
  const safeFallback = escapeHtml(text.fallback);
  const safeIgnore = escapeHtml(text.ignore);
  const safeFooter = escapeHtml(text.footer);
  const safeUrl = escapeHtml(verificationUrl);
  const tokenBlock = token
    ? `<p style="margin:24px 0 8px;color:#333;font-size:14px;line-height:22px;">${escapeHtml(text.tokenLabel)}</p>
      <code style="display:block;padding:14px 16px;background:#f4f4f4;border:1px solid #e5e7eb;border-radius:6px;color:#111;font-size:18px;letter-spacing:2px;text-align:center;">${escapeHtml(token)}</code>`
    : "";

  const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${safeTitle}</title>
  </head>
  <body style="margin:0;padding:0;background:#f7f7f8;">
    <div style="display:none;max-height:0;overflow:hidden;">${escapeHtml(text.preview)}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f7f7f8;padding:32px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border-radius:8px;padding:32px;border:1px solid #e5e7eb;">
            <tr>
              <td style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
                <h1 style="margin:0 0 18px;color:#111827;font-size:24px;line-height:32px;">${safeTitle}</h1>
                <p style="margin:0 0 24px;color:#333;font-size:16px;line-height:24px;">${safeIntro}</p>
                <p style="margin:0 0 24px;">
                  <a href="${safeUrl}" style="display:inline-block;background:#1A5FCC;color:#ffffff;text-decoration:none;border-radius:8px;padding:13px 20px;font-size:16px;font-weight:600;">${safeButton}</a>
                </p>
                <p style="margin:0 0 8px;color:#555;font-size:13px;line-height:20px;">${safeFallback}</p>
                <p style="margin:0;word-break:break-all;color:#1A5FCC;font-size:13px;line-height:20px;"><a href="${safeUrl}" style="color:#1A5FCC;">${safeUrl}</a></p>
                ${tokenBlock}
                <p style="margin:28px 0 0;color:#555;font-size:13px;line-height:20px;">${safeIgnore}</p>
                <p style="margin:28px 0 0;color:#9ca3af;font-size:12px;line-height:18px;">${safeFooter}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const plainTextParts = [
    text.title,
    firstName ? `${firstName}, ${text.intro}` : text.intro,
    `${text.button}: ${verificationUrl}`,
    `${text.fallback} ${verificationUrl}`,
    token ? `${text.tokenLabel} ${token}` : null,
    text.ignore,
    text.footer,
  ].filter(Boolean);

  return {
    html,
    subject: text.subject,
    text: plainTextParts.join("\n\n"),
  };
}
