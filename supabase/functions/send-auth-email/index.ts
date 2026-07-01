import { Webhook } from "https://esm.sh/standardwebhooks@1.0.0";
import { Resend } from "npm:resend@4.0.0";

// @ts-ignore
import "@supabase/functions-js/edge-runtime.d.ts";
import {
  buildVerificationUrl,
  getAuthEmailLanguage,
  renderAuthEmail,
} from "./renderAuthEmail.ts";

type HookPayload = {
  email_data: {
    email_action_type: string;
    redirect_to: string;
    token: string;
    token_hash: string;
    token_hash_new?: string;
    token_new?: string;
  };
  user: {
    email?: string;
    new_email?: string;
    user_metadata?: Record<string, unknown>;
  };
};

type EmailDelivery = {
  actionType: string;
  email: string;
  token: string;
  tokenHash: string;
};

function getRequiredEnv(name: string) {
  const value = Deno.env.get(name);

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

function getHookSecret() {
  return getRequiredEnv("SEND_EMAIL_HOOK_SECRET").replace(
    /^v1,whsec_/,
    ""
  );
}

function buildEmailDeliveries(payload: HookPayload): EmailDelivery[] {
  const { email_data: emailData, user } = payload;
  const actionType = emailData.email_action_type;

  if (actionType !== "email_change") {
    if (!user.email) throw new Error("Missing user email.");
    if (!emailData.token_hash) throw new Error("Missing token hash.");

    return [
      {
        actionType,
        email: user.email,
        token: emailData.token,
        tokenHash: emailData.token_hash,
      },
    ];
  }

  if (
    user.email &&
    user.new_email &&
    emailData.token_hash_new &&
    emailData.token_new
  ) {
    return [
      {
        actionType: "email_change_current",
        email: user.email,
        token: emailData.token,
        tokenHash: emailData.token_hash_new,
      },
      {
        actionType: "email_change_new",
        email: user.new_email,
        token: emailData.token_new,
        tokenHash: emailData.token_hash,
      },
    ];
  }

  const email = user.new_email ?? user.email;
  const tokenHash = emailData.token_hash || emailData.token_hash_new;
  const token = emailData.token || emailData.token_new || "";

  if (!email) throw new Error("Missing email change recipient.");
  if (!tokenHash) throw new Error("Missing email change token hash.");

  return [{ actionType, email, token, tokenHash }];
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const supabaseUrl = getRequiredEnv("SUPABASE_URL");
  const from = getRequiredEnv("AUTH_EMAIL_FROM");
  const resend = new Resend(getRequiredEnv("RESEND_API_KEY"));
  const payloadText = await req.text();
  const headers = Object.fromEntries(req.headers);
  let payload: HookPayload;

  try {
    payload = new Webhook(getHookSecret()).verify(
      payloadText,
      headers
    ) as HookPayload;
  } catch (error) {
    console.error("Invalid send email hook signature", error);

    return jsonResponse(401, {
      error: {
        message: "Invalid hook signature.",
      },
    });
  }

  try {
    const deliveries = buildEmailDeliveries(payload);
    const language = getAuthEmailLanguage({
      redirectTo: payload.email_data.redirect_to,
      userMetadata: payload.user.user_metadata,
    });
    const firstName =
      typeof payload.user.user_metadata?.first_name === "string"
        ? payload.user.user_metadata.first_name
        : null;

    for (const delivery of deliveries) {
      const verificationUrl = buildVerificationUrl({
        actionType: payload.email_data.email_action_type,
        redirectTo: payload.email_data.redirect_to,
        supabaseUrl,
        tokenHash: delivery.tokenHash,
      });
      const email = renderAuthEmail({
        actionType: delivery.actionType,
        firstName,
        language,
        token: delivery.token,
        verificationUrl,
      });
      const { error } = await resend.emails.send({
        from,
        html: email.html,
        subject: email.subject,
        text: email.text,
        to: [delivery.email],
      });

      if (error) {
        throw new Error(error.message);
      }
    }

    return jsonResponse(200, {});
  } catch (error) {
    console.error("Failed to send auth email", error);

    return jsonResponse(500, {
      error: {
        message:
          error instanceof Error
            ? error.message
            : "Failed to send auth email.",
      },
    });
  }
});
