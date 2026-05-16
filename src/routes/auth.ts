import { createClient, type EmailOtpType } from "@supabase/supabase-js";
import { Hono } from "hono";

export const authRoute = new Hono();

const EMAIL_OTP_TYPES = new Set([
  "email",
  "magiclink",
  "signup",
  "invite",
  "recovery",
  "email_change",
]);

function getSupabaseClient() {
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_PUBLISHABLE_KEY ??
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      "SUPABASE_URL/VITE_SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY/VITE_SUPABASE_PUBLISHABLE_KEY must be set",
    );
  }

  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}

function callbackBaseUrl(requestUrl: string) {
  const configuredBase = process.env.VITE_BASE_URL ?? process.env.PUBLIC_BASE_URL;
  const base = configuredBase || new URL(requestUrl).origin;
  return new URL("/auth/callback", base.replace(/\/$/, ""));
}

authRoute.get("/confirm", async (c) => {
  const tokenHash = c.req.query("token_hash");
  const type = c.req.query("type") ?? "email";

  if (!tokenHash || !EMAIL_OTP_TYPES.has(type)) {
    return c.text("Invalid auth confirmation link", 400);
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: type as EmailOtpType,
  });

  if (error || !data.session) {
    console.error("[auth] token_hash verify failed", error?.message);
    return c.redirect("/login?error=auth_confirm_failed", 303);
  }

  const callbackUrl = callbackBaseUrl(c.req.url);
  const hash = new URLSearchParams({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
    expires_in: String(data.session.expires_in ?? ""),
    expires_at: String(data.session.expires_at ?? ""),
    token_type: data.session.token_type,
    type,
  });

  return c.redirect(`${callbackUrl.toString()}#${hash.toString()}`, 303);
});
