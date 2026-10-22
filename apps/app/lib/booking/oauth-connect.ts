import "server-only";
import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { orgProfiles, setOrgSecret, withService } from "@alevo/db";
import { getCurrentOrg, requireRole } from "@alevo/auth";
import {
  buildAuthUrl,
  exchangeCode,
  refreshTokenKey,
  verifyState,
  type CalendarOAuthProvider,
} from "./oauth";

/**
 * Shared connect/callback logic for the calendar OAuth routes. The thin route
 * files just call these with their provider. The connect leg requires an admin
 * session; the callback is stateless (the signed `state` carries the org).
 */

const SETTINGS = "/workspace/agent";

function base(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3001").replace(/\/$/, "");
}

/**
 * The origin the admin's browser is actually on (forwarded headers first, so
 * it is the ngrok host when tunnelled and `localhost:3001` when not). The
 * callback returns here so the admin lands where their session cookie lives.
 */
function requestOrigin(req: Request): string {
  const proto = req.headers.get("x-forwarded-proto") ?? new URL(req.url).protocol.replace(":", "");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? new URL(req.url).host;
  return `${proto}://${host}`;
}

function back(params: string, origin: string = base()): NextResponse {
  return NextResponse.redirect(`${origin}${SETTINGS}?${params}`);
}

/** Admin kicks off the OAuth consent flow for a provider. */
export async function handleStart(provider: CalendarOAuthProvider, req: Request): Promise<Response> {
  const origin = requestOrigin(req);
  try {
    await requireRole("admin");
  } catch {
    return back("calendar_error=forbidden", origin);
  }
  const org = await getCurrentOrg();
  if (!org) return back("calendar_error=no_org", origin);
  return NextResponse.redirect(buildAuthUrl(provider, org.id, origin));
}

/** Provider redirects back here with a code; exchange it and store the grant. */
export async function handleCallback(
  provider: CalendarOAuthProvider,
  request: Request,
): Promise<Response> {
  const url = new URL(request.url);
  const err = url.searchParams.get("error");
  if (err) return back(`calendar_error=${encodeURIComponent(err)}`);

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state) return back("calendar_error=missing_params");

  const parsed = verifyState(state);
  if (!parsed || parsed.provider !== provider) return back("calendar_error=bad_state");
  const origin = parsed.returnTo ?? base();

  try {
    const { refreshToken, accountEmail } = await exchangeCode(provider, code);
    // Google books on a named calendar (default to the primary one); M365 uses
    // the mailbox address for both getSchedule and /me/events.
    const calendarId = provider === "google" ? "primary" : accountEmail;
    if (!calendarId) return back("calendar_error=no_account_email", origin);

    await setOrgSecret(parsed.orgId, refreshTokenKey(provider), refreshToken);
    await withService((tx) =>
      tx
        .insert(orgProfiles)
        .values({
          orgId: parsed.orgId,
          calendarProvider: provider,
          calendarId,
          calendarAccountEmail: accountEmail,
        })
        .onConflictDoUpdate({
          target: orgProfiles.orgId,
          set: {
            calendarProvider: provider,
            calendarId,
            calendarAccountEmail: accountEmail,
            updatedAt: new Date(),
          },
        }),
    );
    return back(`calendar_connected=${provider}`, origin);
  } catch (e) {
    Sentry.captureException(e);
    const message = e instanceof Error ? e.message : "connect_failed";
    return back(`calendar_error=${encodeURIComponent(message)}`, origin);
  }
}
