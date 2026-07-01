export type AuthEmailLanguage =
  | "en"
  | "es"
  | "ru"
  | "de"
  | "pl"
  | "cs"
  | "hu";

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
  "de",
  "pl",
  "cs",
  "hu",
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
  de: {
    default: {
      button: "108 Again öffnen",
      fallback: "Wenn die Schaltfläche nicht funktioniert, kopiere diesen Link und füge ihn in deinen Browser ein:",
      footer: "108 Again",
      ignore: "Wenn du diese E-Mail nicht angefordert hast, kannst du sie ignorieren.",
      intro: "Verwende den sicheren Link unten, um fortzufahren.",
      preview: "Mit 108 Again fortfahren",
      subject: "Mit 108 Again fortfahren",
      title: "Mit 108 Again fortfahren",
      tokenLabel: "Vorübergehender Code:",
    },
    email_change: {
      button: "E-Mail-Änderung bestätigen",
      fallback: "Wenn die Schaltfläche nicht funktioniert, kopiere diesen Link und füge ihn in deinen Browser ein:",
      footer: "108 Again",
      ignore: "Wenn du diese Änderung nicht angefordert hast, kannst du diese E-Mail ignorieren.",
      intro: "Folge dem Link unten, um die Änderung deiner E-Mail-Adresse zu bestätigen.",
      preview: "Bestätige die Änderung deiner E-Mail-Adresse",
      subject: "Bestätige deine E-Mail-Änderung",
      title: "E-Mail-Änderung bestätigen",
      tokenLabel: "Vorübergehender Code:",
    },
    invite: {
      button: "Einladung annehmen",
      fallback: "Wenn die Schaltfläche nicht funktioniert, kopiere diesen Link und füge ihn in deinen Browser ein:",
      footer: "108 Again",
      ignore: "Wenn du diese Einladung nicht erwartet hast, kannst du diese E-Mail ignorieren.",
      intro: "Folge dem Link unten, um deine Einladung anzunehmen und dein Konto fertig einzurichten.",
      preview: "Nimm deine Einladung zu 108 Again an",
      subject: "Du wurdest zu 108 Again eingeladen",
      title: "Einladung annehmen",
      tokenLabel: "Vorübergehender Code:",
    },
    magiclink: {
      button: "Anmelden",
      fallback: "Wenn die Schaltfläche nicht funktioniert, kopiere diesen Link und füge ihn in deinen Browser ein:",
      footer: "108 Again",
      ignore: "Wenn du diesen Anmeldelink nicht angefordert hast, kannst du diese E-Mail ignorieren.",
      intro: "Folge dem Link unten, um dich bei 108 Again anzumelden.",
      preview: "Bei 108 Again anmelden",
      subject: "Bei 108 Again anmelden",
      title: "Bei 108 Again anmelden",
      tokenLabel: "Vorübergehender Code:",
    },
    reauthentication: {
      button: "Bestätigen, dass du es warst",
      fallback: "Wenn die Schaltfläche nicht funktioniert, kopiere diesen Link und füge ihn in deinen Browser ein:",
      footer: "108 Again",
      ignore: "Wenn du diese Bestätigung nicht angefordert hast, kannst du diese E-Mail ignorieren.",
      intro: "Folge dem Link unten, um diese sensible Kontoaktion zu bestätigen.",
      preview: "Bestätige deine Kontoaktion in 108 Again",
      subject: "Bestätige deine Kontoaktion in 108 Again",
      title: "Diese Aktion bestätigen",
      tokenLabel: "Vorübergehender Code:",
    },
    recovery: {
      button: "Passwort zurücksetzen",
      fallback: "Wenn die Schaltfläche nicht funktioniert, kopiere diesen Link und füge ihn in deinen Browser ein:",
      footer: "108 Again",
      ignore: "Wenn du kein Zurücksetzen des Passworts angefordert hast, kannst du diese E-Mail ignorieren.",
      intro: "Folge dem Link unten, um das Passwort für dein Konto zurückzusetzen.",
      preview: "Setze dein 108 Again-Passwort zurück",
      subject: "Passwort zurücksetzen",
      title: "Passwort zurücksetzen",
      tokenLabel: "Vorübergehender Code:",
    },
    signup: {
      button: "E-Mail-Adresse bestätigen",
      fallback: "Wenn die Schaltfläche nicht funktioniert, kopiere diesen Link und füge ihn in deinen Browser ein:",
      footer: "108 Again",
      ignore: "Wenn du kein 108 Again-Konto erstellt hast, kannst du diese E-Mail ignorieren.",
      intro: "Folge dem Link unten, um diese E-Mail-Adresse zu bestätigen und die Registrierung abzuschließen.",
      preview: "Bestätige deine 108 Again-E-Mail-Adresse",
      subject: "E-Mail-Adresse bestätigen",
      title: "E-Mail-Adresse bestätigen",
      tokenLabel: "Vorübergehender Code:",
    },
  },
  pl: {
    default: {
      button: "Otwórz 108 Again",
      fallback: "Jeśli przycisk nie działa, skopiuj i wklej ten link do przeglądarki:",
      footer: "108 Again",
      ignore: "Jeśli nie prosiłeś o tę wiadomość, możesz ją zignorować.",
      intro: "Użyj bezpiecznego linku poniżej, aby kontynuować.",
      preview: "Kontynuuj w 108 Again",
      subject: "Kontynuuj w 108 Again",
      title: "Kontynuuj w 108 Again",
      tokenLabel: "Kod tymczasowy:",
    },
    email_change: {
      button: "Potwierdź zmianę emaila",
      fallback: "Jeśli przycisk nie działa, skopiuj i wklej ten link do przeglądarki:",
      footer: "108 Again",
      ignore: "Jeśli nie prosiłeś o tę zmianę, możesz zignorować tę wiadomość.",
      intro: "Kliknij link poniżej, aby potwierdzić zmianę adresu email.",
      preview: "Potwierdź zmianę adresu email",
      subject: "Potwierdź zmianę emaila",
      title: "Potwierdź zmianę emaila",
      tokenLabel: "Kod tymczasowy:",
    },
    invite: {
      button: "Przyjmij zaproszenie",
      fallback: "Jeśli przycisk nie działa, skopiuj i wklej ten link do przeglądarki:",
      footer: "108 Again",
      ignore: "Jeśli nie spodziewałeś się tego zaproszenia, możesz zignorować tę wiadomość.",
      intro: "Kliknij link poniżej, aby przyjąć zaproszenie i dokończyć konfigurację konta.",
      preview: "Przyjmij zaproszenie do 108 Again",
      subject: "Zaproszono Cię do 108 Again",
      title: "Przyjmij zaproszenie",
      tokenLabel: "Kod tymczasowy:",
    },
    magiclink: {
      button: "Zaloguj się",
      fallback: "Jeśli przycisk nie działa, skopiuj i wklej ten link do przeglądarki:",
      footer: "108 Again",
      ignore: "Jeśli nie prosiłeś o ten link logowania, możesz zignorować tę wiadomość.",
      intro: "Kliknij link poniżej, aby zalogować się do 108 Again.",
      preview: "Zaloguj się do 108 Again",
      subject: "Zaloguj się do 108 Again",
      title: "Zaloguj się do 108 Again",
      tokenLabel: "Kod tymczasowy:",
    },
    reauthentication: {
      button: "Potwierdź, że to Ty",
      fallback: "Jeśli przycisk nie działa, skopiuj i wklej ten link do przeglądarki:",
      footer: "108 Again",
      ignore: "Jeśli nie prosiłeś o to potwierdzenie, możesz zignorować tę wiadomość.",
      intro: "Kliknij link poniżej, aby potwierdzić tę wrażliwą akcję na koncie.",
      preview: "Potwierdź akcję konta 108 Again",
      subject: "Potwierdź akcję konta 108 Again",
      title: "Potwierdź tę akcję",
      tokenLabel: "Kod tymczasowy:",
    },
    recovery: {
      button: "Zresetuj hasło",
      fallback: "Jeśli przycisk nie działa, skopiuj i wklej ten link do przeglądarki:",
      footer: "108 Again",
      ignore: "Jeśli nie prosiłeś o reset hasła, możesz zignorować tę wiadomość.",
      intro: "Kliknij link poniżej, aby zresetować hasło do swojego konta.",
      preview: "Zresetuj hasło do 108 Again",
      subject: "Zresetuj hasło",
      title: "Reset hasła",
      tokenLabel: "Kod tymczasowy:",
    },
    signup: {
      button: "Potwierdź email",
      fallback: "Jeśli przycisk nie działa, skopiuj i wklej ten link do przeglądarki:",
      footer: "108 Again",
      ignore: "Jeśli nie utworzyłeś konta 108 Again, możesz zignorować tę wiadomość.",
      intro: "Kliknij link poniżej, aby potwierdzić ten email i dokończyć rejestrację.",
      preview: "Potwierdź email w 108 Again",
      subject: "Potwierdź email",
      title: "Potwierdź email",
      tokenLabel: "Kod tymczasowy:",
    },
  },
  cs: {
    default: {
      button: "Otevřít 108 Again",
      fallback: "Pokud tlačítko nefunguje, zkopíruj a vlož tento odkaz do prohlížeče:",
      footer: "108 Again",
      ignore: "Pokud sis tento email nevyžádal(a), můžeš ho ignorovat.",
      intro: "Pokračuj pomocí bezpečného odkazu níže.",
      preview: "Pokračovat v 108 Again",
      subject: "Pokračovat v 108 Again",
      title: "Pokračovat v 108 Again",
      tokenLabel: "Dočasný kód:",
    },
    email_change: {
      button: "Potvrdit změnu emailu",
      fallback: "Pokud tlačítko nefunguje, zkopíruj a vlož tento odkaz do prohlížeče:",
      footer: "108 Again",
      ignore: "Pokud sis tuto změnu nevyžádal(a), můžeš tento email ignorovat.",
      intro: "Pomocí odkazu níže potvrď změnu své emailové adresy.",
      preview: "Potvrď změnu emailové adresy",
      subject: "Potvrď změnu emailu",
      title: "Potvrdit změnu emailu",
      tokenLabel: "Dočasný kód:",
    },
    invite: {
      button: "Přijmout pozvánku",
      fallback: "Pokud tlačítko nefunguje, zkopíruj a vlož tento odkaz do prohlížeče:",
      footer: "108 Again",
      ignore: "Pokud jsi tuto pozvánku nečekal(a), můžeš tento email ignorovat.",
      intro: "Pomocí odkazu níže přijmi pozvánku a dokonči nastavení účtu.",
      preview: "Přijmi pozvánku do 108 Again",
      subject: "Byl(a) jsi pozván(a) do 108 Again",
      title: "Přijmout pozvánku",
      tokenLabel: "Dočasný kód:",
    },
    magiclink: {
      button: "Přihlásit se",
      fallback: "Pokud tlačítko nefunguje, zkopíruj a vlož tento odkaz do prohlížeče:",
      footer: "108 Again",
      ignore: "Pokud sis tento přihlašovací odkaz nevyžádal(a), můžeš tento email ignorovat.",
      intro: "Pomocí odkazu níže se přihlas do 108 Again.",
      preview: "Přihlásit se do 108 Again",
      subject: "Přihlásit se do 108 Again",
      title: "Přihlásit se do 108 Again",
      tokenLabel: "Dočasný kód:",
    },
    reauthentication: {
      button: "Potvrdit, že jsi to byl(a) ty",
      fallback: "Pokud tlačítko nefunguje, zkopíruj a vlož tento odkaz do prohlížeče:",
      footer: "108 Again",
      ignore: "Pokud sis toto potvrzení nevyžádal(a), můžeš tento email ignorovat.",
      intro: "Pomocí odkazu níže potvrď tuto citlivou akci účtu.",
      preview: "Potvrď akci účtu 108 Again",
      subject: "Potvrď akci účtu 108 Again",
      title: "Potvrdit tuto akci",
      tokenLabel: "Dočasný kód:",
    },
    recovery: {
      button: "Resetovat heslo",
      fallback: "Pokud tlačítko nefunguje, zkopíruj a vlož tento odkaz do prohlížeče:",
      footer: "108 Again",
      ignore: "Pokud sis reset hesla nevyžádal(a), můžeš tento email ignorovat.",
      intro: "Pomocí odkazu níže resetuj heslo ke svému účtu.",
      preview: "Resetuj své heslo k 108 Again",
      subject: "Reset hesla",
      title: "Reset hesla",
      tokenLabel: "Dočasný kód:",
    },
    signup: {
      button: "Potvrdit email",
      fallback: "Pokud tlačítko nefunguje, zkopíruj a vlož tento odkaz do prohlížeče:",
      footer: "108 Again",
      ignore: "Pokud sis nevytvořil(a) účet 108 Again, můžeš tento email ignorovat.",
      intro: "Pomocí odkazu níže potvrď tento email a dokonči registraci.",
      preview: "Potvrď email pro 108 Again",
      subject: "Potvrď email",
      title: "Potvrď email",
      tokenLabel: "Dočasný kód:",
    },
  },
  hu: {
    default: {
      button: "108 Again megnyitása",
      fallback: "Ha a gomb nem működik, másold ki és illeszd be ezt a linket a böngésződbe:",
      footer: "108 Again",
      ignore: "Ha nem te kérted ezt az emailt, nyugodtan figyelmen kívül hagyhatod.",
      intro: "A folytatáshoz használd az alábbi biztonságos linket.",
      preview: "Folytatás a 108 Again alkalmazással",
      subject: "Folytatás a 108 Again alkalmazással",
      title: "Folytatás a 108 Again alkalmazással",
      tokenLabel: "Ideiglenes kód:",
    },
    email_change: {
      button: "Email módosításának megerősítése",
      fallback: "Ha a gomb nem működik, másold ki és illeszd be ezt a linket a böngésződbe:",
      footer: "108 Again",
      ignore: "Ha nem te kérted ezt a módosítást, nyugodtan figyelmen kívül hagyhatod ezt az emailt.",
      intro: "Az alábbi linkkel erősítsd meg az email címed módosítását.",
      preview: "Email cím módosításának megerősítése",
      subject: "Email módosításának megerősítése",
      title: "Email módosításának megerősítése",
      tokenLabel: "Ideiglenes kód:",
    },
    invite: {
      button: "Meghívás elfogadása",
      fallback: "Ha a gomb nem működik, másold ki és illeszd be ezt a linket a böngésződbe:",
      footer: "108 Again",
      ignore: "Ha nem számítottál erre a meghívásra, nyugodtan figyelmen kívül hagyhatod ezt az emailt.",
      intro: "Az alábbi linkkel fogadd el a meghívást, és fejezd be a fiókod beállítását.",
      preview: "Fogadd el a 108 Again meghívást",
      subject: "Meghívtak a 108 Again alkalmazásba",
      title: "Meghívás elfogadása",
      tokenLabel: "Ideiglenes kód:",
    },
    magiclink: {
      button: "Bejelentkezés",
      fallback: "Ha a gomb nem működik, másold ki és illeszd be ezt a linket a böngésződbe:",
      footer: "108 Again",
      ignore: "Ha nem te kérted ezt a bejelentkezési linket, nyugodtan figyelmen kívül hagyhatod ezt az emailt.",
      intro: "Az alábbi linkkel jelentkezz be a 108 Again alkalmazásba.",
      preview: "Bejelentkezés a 108 Again alkalmazásba",
      subject: "Bejelentkezés a 108 Again alkalmazásba",
      title: "Bejelentkezés a 108 Again alkalmazásba",
      tokenLabel: "Ideiglenes kód:",
    },
    reauthentication: {
      button: "Erősítsd meg, hogy te voltál",
      fallback: "Ha a gomb nem működik, másold ki és illeszd be ezt a linket a böngésződbe:",
      footer: "108 Again",
      ignore: "Ha nem te kérted ezt a megerősítést, nyugodtan figyelmen kívül hagyhatod ezt az emailt.",
      intro: "Az alábbi linkkel erősítsd meg ezt az érzékeny fiókműveletet.",
      preview: "108 Again fiókművelet megerősítése",
      subject: "108 Again fiókművelet megerősítése",
      title: "Művelet megerősítése",
      tokenLabel: "Ideiglenes kód:",
    },
    recovery: {
      button: "Jelszó visszaállítása",
      fallback: "Ha a gomb nem működik, másold ki és illeszd be ezt a linket a böngésződbe:",
      footer: "108 Again",
      ignore: "Ha nem te kérted a jelszó visszaállítását, nyugodtan figyelmen kívül hagyhatod ezt az emailt.",
      intro: "Az alábbi linkkel állítsd vissza a fiókod jelszavát.",
      preview: "108 Again jelszó visszaállítása",
      subject: "Jelszó visszaállítása",
      title: "Jelszó visszaállítása",
      tokenLabel: "Ideiglenes kód:",
    },
    signup: {
      button: "Email megerősítése",
      fallback: "Ha a gomb nem működik, másold ki és illeszd be ezt a linket a böngésződbe:",
      footer: "108 Again",
      ignore: "Ha nem hoztál létre 108 Again fiókot, nyugodtan figyelmen kívül hagyhatod ezt az emailt.",
      intro: "Az alábbi linkkel erősítsd meg ezt az email címet, és fejezd be a regisztrációt.",
      preview: "108 Again email megerősítése",
      subject: "Email megerősítése",
      title: "Email megerősítése",
      tokenLabel: "Ideiglenes kód:",
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
