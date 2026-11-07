import { Webhook } from "https://esm.sh/standardwebhooks@1.0.0";

type AuthEmailPayload = {
  user?: {
    email?: string;
    new_email?: string;
  };
  email_data?: {
    email_action_type?: string;
    token?: string;
    token_hash?: string;
    token_new?: string;
    token_hash_new?: string;
    redirect_to?: string;
    site_url?: string;
  };
};

Deno.serve(async (request: Request) => {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const hookSecret = Deno.env.get("SEND_EMAIL_HOOK_SECRET");
  const appScriptUrl = Deno.env.get("APP_SCRIPT_URL");
  const bridgeSecret = Deno.env.get("APP_SCRIPT_SHARED_SECRET");
  if (!hookSecret || !appScriptUrl || !bridgeSecret) {
    console.error("The send-email function is missing required environment configuration.");
    return new Response("Email delivery is not configured", { status: 500 });
  }

  let payload: AuthEmailPayload;
  try {
    const rawBody = await request.text();
    const secret = hookSecret.replace(/^v1,whsec_/, "");
    payload = new Webhook(secret).verify(
      rawBody,
      Object.fromEntries(request.headers),
    ) as AuthEmailPayload;
  } catch {
    return new Response("Invalid webhook signature", { status: 401 });
  }

  if (
    !payload.user?.email ||
    !payload.email_data?.email_action_type
  ) {
    return new Response("Invalid email event payload", { status: 400 });
  }

  try {
    const response = await fetch(appScriptUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        secret: bridgeSecret,
        user: payload.user,
        email_data: payload.email_data,
      }),
    });
    if (!response.ok) {
      console.error(`Apps Script returned HTTP ${response.status}.`);
      return new Response("Email delivery failed", { status: 502 });
    }

    const result = await response.json();
    if (result?.ok !== true) {
      console.error("Apps Script did not confirm email delivery.");
      return new Response("Email delivery failed", { status: 502 });
    }
  } catch (error) {
    console.error("Apps Script email delivery request failed.", error);
    return new Response("Email delivery failed", { status: 502 });
  }

  return Response.json({});
});
