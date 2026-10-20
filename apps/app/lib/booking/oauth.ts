import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * OAuth plumbing for the direct calendar adapters (Google Calendar, Microsoft
 * 365). We store only the long-lived refresh token (encrypted, per org, in
 * org_secrets); each adapter exchanges it for a short-lived access token in
 * memory. The connect flow is CSRF-protected by a signed, short-lived `state`.
 */

export type CalendarOAuthProvider = "google" | "m365";

const STATE_TTL_MS = 10 * 60 * 1000; // a connect round-trip is seconds; 10 min is generous

function masterKey(): string {
  const s = process.env.SECRETS_MASTER_KEY;
  if (!s) throw new Error("SECRETS_MASTER_KEY is not set");
  return s;
}

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set`);
  return v;
}

function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

const microsoftTenant = () => process.env.MICROSOFT_OAUTH_TENANT ?? "common";

type ProviderSpec = {
  clientId: () => string;
  clientSecret: () => string;
  authUrl: string;
  tokenUrl: () => string;
  scope: string;
  /** Resolve the authorized account's email from an access token (best effort). */
  accountEmail: (accessToken: string) => Promise<string | null>;
};

const PROVIDERS: Record<CalendarOAuthProvider, ProviderSpec> = {
  google: {
    clientId: () => env("GOOGLE_OAUTH_CLIENT_ID"),
    clientSecret: () => env("GOOGLE_OAUTH_CLIENT_SECRET"),
    authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: () => "https://oauth2.googleapis.com/token",
    // `calendar` covers free/busy + event write; openid+email names the account.
    scope: "openid email https://www.googleapis.com/auth/calendar",
    async accountEmail(accessToken) {
      const res = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
        headers: { authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) return null;
      const json = (await res.json()) as { email?: string };
      return json.email ?? null;
    },
  },
  m365: {
    clientId: () => env("MICROSOFT_OAUTH_CLIENT_ID"),
    clientSecret: () => env("MICROSOFT_OAUTH_CLIENT_SECRET"),
    authUrl: `https://login.microsoftonline.com/${microsoftTenant()}/oauth2/v2.0/authorize`,
    tokenUrl: () => `https://login.microsoftonline.com/${microsoftTenant()}/oauth2/v2.0/token`,
    scope:
      "offline_access openid email https://graph.microsoft.com/Calendars.ReadWrite https://graph.microsoft.com/User.Read",
    async accountEmail(accessToken) {
      const res = await fetch("https://graph.microsoft.com/v1.0/me", {
        headers: { authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) return null;
      const json = (await res.json()) as { mail?: string; userPrincipalName?: string };
      return json.mail ?? json.userPrincipalName ?? null;
    },
  },
};

/** The refresh-token secret key for a provider (kept out of the UI registry). */
export function refreshTokenKey(provider: CalendarOAuthProvider): string {
  return provider === "google" ? "google_calendar_refresh_token" : "m365_calendar_refresh_token";
}

export function redirectUri(provider: CalendarOAuthProvider): string {
  const path = provider === "google" ? "google" : "microsoft";
  return `${appUrl()}/api/oauth/${path}/callback`;
}

// ── Signed state (CSRF + carries the org through the round-trip) ─────────────

export function signState(orgId: string, provider: CalendarOAuthProvider): string {
  const payload = Buffer.from(JSON.stringify({ o: orgId, p: provider, t: Date.now() })).toString(
    "base64url",
  );
  const sig = createHmac("sha256", masterKey()).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function verifyState(
  state: string,
): { orgId: string; provider: CalendarOAuthProvider } | null {
  const [payload, sig] = state.split(".");
  if (!payload || !sig) return null;
  const expected = createHmac("sha256", masterKey()).update(payload).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const obj = JSON.parse(Buffer.from(payload, "base64url").toString()) as {
      o?: string;
      p?: string;
      t?: number;
    };
    if (!obj.o || (obj.p !== "google" && obj.p !== "m365") || !obj.t) return null;
    if (Date.now() - obj.t > STATE_TTL_MS) return null;
    return { orgId: obj.o, provider: obj.p };
  } catch {
    return null;
  }
}

// ── Auth URL + token exchange ────────────────────────────────────────────────

export function buildAuthUrl(provider: CalendarOAuthProvider, orgId: string): string {
  const spec = PROVIDERS[provider];
  const qs = new URLSearchParams({
    client_id: spec.clientId(),
    redirect_uri: redirectUri(provider),
    response_type: "code",
    scope: spec.scope,
    state: signState(orgId, provider),
    access_type: "offline", // Google: get a refresh token
    prompt: "consent", // force a refresh token on re-consent
  });
  return `${spec.authUrl}?${qs}`;
}

export type ConnectedAccount = {
  refreshToken: string;
  accessToken: string;
  accountEmail: string | null;
};

/** Exchange an authorization code for tokens + the authorized account email. */
export async function exchangeCode(
  provider: CalendarOAuthProvider,
  code: string,
): Promise<ConnectedAccount> {
  const spec = PROVIDERS[provider];
  const res = await fetch(spec.tokenUrl(), {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: spec.clientId(),
      client_secret: spec.clientSecret(),
      redirect_uri: redirectUri(provider),
      grant_type: "authorization_code",
    }),
  });
  const json = (await res.json()) as {
    access_token?: string;
    refresh_token?: string;
    error_description?: string;
    error?: string;
  };
  if (!res.ok || !json.access_token) {
    throw new Error(json.error_description ?? json.error ?? `token exchange failed (${res.status})`);
  }
  if (!json.refresh_token) {
    // No refresh token means we can't book later — usually a re-consent without
    // prompt=consent, or (Google) a prior grant. Surface it clearly.
    throw new Error("no refresh token returned — revoke the app's access and reconnect");
  }
  const accountEmail = await spec.accountEmail(json.access_token).catch(() => null);
  return { refreshToken: json.refresh_token, accessToken: json.access_token, accountEmail };
}

/** Trade a stored refresh token for a fresh access token. */
export async function refreshAccessToken(
  provider: CalendarOAuthProvider,
  refreshToken: string,
): Promise<string> {
  const spec = PROVIDERS[provider];
  const res = await fetch(spec.tokenUrl(), {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: spec.clientId(),
      client_secret: spec.clientSecret(),
      grant_type: "refresh_token",
      ...(provider === "m365" ? { scope: spec.scope } : {}),
    }),
  });
  const json = (await res.json()) as { access_token?: string; error_description?: string };
  if (!res.ok || !json.access_token) {
    throw new Error(json.error_description ?? `token refresh failed (${res.status})`);
  }
  return json.access_token;
}
