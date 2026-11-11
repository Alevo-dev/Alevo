"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { deleteOrgSecret, orgProfiles, recordAudit, setSetupDecline, safeErrorMessage } from "@alevo/db";
import { getCurrentOrg, getCurrentUser, requireRole, withOrg } from "@alevo/auth";
import { isSecretKey } from "@/lib/secrets-registry";
import { readSecretFields, storeSecrets, validateSecrets, type SecretErrors } from "@/lib/secrets/save";
import { notifySlack, resetSlackHealth } from "@/lib/notifications/slack";
import { normalizeSite } from "@/lib/psa/connectwise-map";
import { loadConnectWise } from "@/lib/psa/connectwise";
import { makeGoogleAdapter } from "@/lib/booking/google";
import { makeM365Adapter } from "@/lib/booking/m365";
import { calendarTestDetail, calendarTestHint } from "@/lib/booking/calendar-test";
import { BOOKING_TOOL_LABEL } from "@/lib/booking/connected";
import { connectedToolsNow, enableBookingOnConnect } from "@/lib/booking/auto-enable";
import { MAX_AGENT_NAME_CHARS, MAX_GREETING_CHARS } from "@/lib/chat/rules";
import { normaliseHex } from "@/lib/colour";

export type ActionState = {
  ok?: boolean;
  error?: string; // form-level (non-field) error
};

async function adminContext() {
  await requireRole("admin");
  const [org, me] = await Promise.all([getCurrentOrg(), getCurrentUser()]);
  if (!org) throw new Error("No active organization");
  return { org, actorId: me?.id ?? null };
}

function fail(error: unknown): { error: string } {
  return { error: safeErrorMessage(error, "Something went wrong") };
}

function revalidateBoth() {
  revalidatePath("/workspace/integrations");
  revalidatePath("/workspace/agent");
}

/** Upsert the org's profile row with these booking-related fields. */
async function upsertProfile(orgId: string, set: Partial<typeof orgProfiles.$inferInsert>) {
  await withOrg((tx) =>
    tx
      .insert(orgProfiles)
      .values({ orgId, ...set })
      .onConflictDoUpdate({ target: orgProfiles.orgId, set: { ...set, updatedAt: new Date() } }),
  );
}

/** A tool that just lost what it needs stops being the chosen booking tool. */
async function unchooseBookingTool(orgId: string, tool: "calcom" | "google" | "m365" | "calendly") {
  await withOrg((tx) =>
    tx
      .update(orgProfiles)
      .set({ bookingTool: null, updatedAt: new Date() })
      .where(and(eq(orgProfiles.orgId, orgId), eq(orgProfiles.bookingTool, tool))),
  );
}

export type SaveSecretsState = {
  ok?: boolean;
  error?: string;
  /** Per-field errors, keyed by secret. Nothing is saved while any exist. */
  errors?: SecretErrors;
};

/** Saves every filled-in key in one submit. Blank fields keep their stored value. */
export async function saveSecrets(_prev: SaveSecretsState, formData: FormData): Promise<SaveSecretsState> {
  try {
    const { org, actorId } = await adminContext();
    const entries = readSecretFields(formData);
    if (entries.length === 0) return { error: "Enter a value to save." };
    const errors = validateSecrets(entries);
    if (Object.keys(errors).length > 0) return { errors };
    await storeSecrets(org.id, actorId, entries);
    if (entries.some((e) => e.key === "slack_webhook_url")) {
      await resetSlackHealth(org.id); // new URL → Untested until Send test
      await setSetupDecline(org.id, "slack", false); // a webhook clears "Not using Slack"
    }
    revalidatePath("/workspace/integrations");
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function sendTestSlack(_prev: ActionState, _formData: FormData): Promise<ActionState> {
  try {
    const { org } = await adminContext();
    const result = await notifySlack(org.id, `:wave: Test notification from Alevo — ${org.name}.`);
    revalidatePath("/workspace/integrations"); // the card follows the result: Connected or Needs attention (Untested before any send)
    if (!result.ok) return { error: result.error ?? "Failed to send" };
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function clearSecret(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const { org, actorId } = await adminContext();
    const key = String(formData.get("key") ?? "");
    if (!isSecretKey(key)) return { error: "Unknown secret" };
    await deleteOrgSecret(org.id, key);
    // Without its API key Cal.com can't book, so it can't stay the booking tool.
    if (key === "calcom_api_key") await unchooseBookingTool(org.id, "calcom");
    if (key === "slack_webhook_url") await resetSlackHealth(org.id);
    await recordAudit({ orgId: org.id, actorUserId: actorId, action: "secret.cleared", target: key });
    revalidateBoth();
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export type CalcomState = {
  ok?: boolean;
  error?: string;
  errors?: { calcomEventTypeId?: string } & SecretErrors;
  values?: { calcomEventTypeId: string };
};

/** Cal.com's event type (profile) + API key + webhook secret (secrets), one submit. */
export async function saveCalcom(_prev: CalcomState, formData: FormData): Promise<CalcomState> {
  const calcomEventTypeId = String(formData.get("calcomEventTypeId") ?? "").trim();
  const values = { calcomEventTypeId };
  try {
    const { org, actorId } = await adminContext();
    const entries = readSecretFields(formData, ["calcom_api_key", "calcom_webhook_secret"]);
    const errors: CalcomState["errors"] = validateSecrets(entries);
    if (calcomEventTypeId && !/^\d+$/.test(calcomEventTypeId)) errors.calcomEventTypeId = "Enter the numeric Cal.com event type ID.";
    if (Object.keys(errors).length > 0) return { errors, values };

    const before = await connectedToolsNow(org.id);
    await storeSecrets(org.id, actorId, entries);
    const id = calcomEventTypeId ? Number.parseInt(calcomEventTypeId, 10) : null;
    await upsertProfile(org.id, { calcomEventTypeId: id });
    if (id === null) await unchooseBookingTool(org.id, "calcom");
    else await enableBookingOnConnect(org.id, before, actorId);
    await recordAudit({ orgId: org.id, actorUserId: actorId, action: "calcom.settings_saved", target: id === null ? "no event type" : `event type ${id}` });
    revalidateBoth();
    return { ok: true, values };
  } catch (error) {
    return { ...fail(error), values };
  }
}

export type CalendlyState = {
  ok?: boolean;
  error?: string;
  errors?: { calendlyUrl?: string } & SecretErrors;
  values?: { calendlyUrl: string };
};

function isHttpsUrl(v: string): boolean {
  try {
    return new URL(v).protocol === "https:";
  } catch {
    return false;
  }
}

/** Calendly's scheduling link (profile) + webhook signing key (secret), one submit. */
export async function saveCalendly(_prev: CalendlyState, formData: FormData): Promise<CalendlyState> {
  const calendlyUrl = String(formData.get("calendlyUrl") ?? "").trim();
  const values = { calendlyUrl };
  try {
    const { org, actorId } = await adminContext();
    const entries = readSecretFields(formData, ["calendly_webhook_secret"]);
    const errors: CalendlyState["errors"] = validateSecrets(entries);
    if (calendlyUrl && !isHttpsUrl(calendlyUrl)) errors.calendlyUrl = "Enter a valid https Calendly link.";
    if (Object.keys(errors).length > 0) return { errors, values };

    const before = await connectedToolsNow(org.id);
    await storeSecrets(org.id, actorId, entries);
    await upsertProfile(org.id, { calendlyUrl: calendlyUrl || null });
    if (!calendlyUrl) await unchooseBookingTool(org.id, "calendly");
    else await enableBookingOnConnect(org.id, before, actorId);
    await recordAudit({ orgId: org.id, actorUserId: actorId, action: "calendly.settings_saved", target: calendlyUrl ? "link" : "no link" });
    revalidateBoth();
    return { ok: true, values };
  } catch (error) {
    return { ...fail(error), values };
  }
}

/**
 * Disconnect the connected booking calendar (Google / M365): drop the stored
 * refresh token, clear the profile's calendar fields, and un-choose it as the
 * booking tool so the agent hands off until another tool is chosen.
 */
export async function disconnectCalendar(_prev: ActionState, _formData: FormData): Promise<ActionState> {
  try {
    const { org, actorId } = await adminContext();
    const [profile] = await withOrg((tx) =>
      tx.select({ provider: orgProfiles.calendarProvider }).from(orgProfiles).where(eq(orgProfiles.orgId, org.id)).limit(1),
    );
    const provider = profile?.provider === "google" || profile?.provider === "m365" ? profile.provider : null;
    if (provider) await deleteOrgSecret(org.id, `${provider}_calendar_refresh_token`);

    await withOrg((tx) =>
      tx
        .update(orgProfiles)
        .set({ calendarProvider: null, calendarId: null, calendarAccountEmail: null, updatedAt: new Date() })
        .where(eq(orgProfiles.orgId, org.id)),
    );
    if (provider) await unchooseBookingTool(org.id, provider);

    await recordAudit({ orgId: org.id, actorUserId: actorId, action: "qualifier.calendar_disconnected", target: provider ?? "none" });
    revalidateBoth();
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export type CalendarTestState = { ok?: boolean; error?: string; detail?: string };

/**
 * Round-trip to the connected calendar: refresh the token, read free/busy for
 * the next 72 hours, count the open slots. The same calls the agent makes when
 * a lead asks for a time — so a disabled API or a revoked grant shows up here,
 * not in a lead's thread.
 */
export async function testCalendar(_prev: CalendarTestState, _formData: FormData): Promise<CalendarTestState> {
  try {
    const { org } = await adminContext();
    const [profile] = await withOrg((tx) => tx.select().from(orgProfiles).where(eq(orgProfiles.orgId, org.id)).limit(1));
    const provider = profile?.calendarProvider === "google" || profile?.calendarProvider === "m365" ? profile.calendarProvider : null;
    if (!profile || !provider) return { error: "No calendar is connected." };
    const label = BOOKING_TOOL_LABEL[provider];
    const cfg = {
      calendarId: profile.calendarId ?? "",
      lengthMin: profile.bookingLengthMin,
      hoursStart: profile.bookingHoursStart,
      hoursEnd: profile.bookingHoursEnd,
      timeZone: profile.timezone ?? "UTC",
    };
    const adapter = provider === "google" ? await makeGoogleAdapter(org.id, cfg) : await makeM365Adapter(org.id, cfg);
    if (!adapter) return { error: `The ${label} connection is incomplete. Disconnect, then connect it again.` };
    const now = Date.now();
    const slots = await adapter.availableSlots(
      new Date(now + 2 * 3_600_000).toISOString(),
      new Date(now + 72 * 3_600_000).toISOString(),
      cfg.timeZone,
    );
    return { ok: true, detail: calendarTestDetail(label, profile.calendarAccountEmail, slots.length, cfg.lengthMin) };
  } catch (error) {
    const message = safeErrorMessage(error, "Something went wrong");
    const hint = calendarTestHint(message);
    return { error: hint ? `${message} ${hint}` : message };
  }
}

export type ConnectWiseState = {
  ok?: boolean;
  error?: string;
  errors?: { connectwiseSite?: string; connectwiseCompanyId?: string; connectwiseMember?: string } & SecretErrors;
  values?: { connectwiseSite: string; connectwiseCompanyId: string; connectwiseMember: string };
};

/**
 * ConnectWise Manage: the API site, login company id and API member (profile)
 * plus the public / private keys (secrets), one submit. Clearing every field
 * disconnects: nothing is written back until it is complete again.
 */
export async function saveConnectWise(_prev: ConnectWiseState, formData: FormData): Promise<ConnectWiseState> {
  const connectwiseSite = String(formData.get("connectwiseSite") ?? "").trim();
  const connectwiseCompanyId = String(formData.get("connectwiseCompanyId") ?? "").trim();
  const connectwiseMember = String(formData.get("connectwiseMember") ?? "").trim();
  const values = { connectwiseSite, connectwiseCompanyId, connectwiseMember };
  try {
    const { org, actorId } = await adminContext();
    const entries = readSecretFields(formData, ["connectwise_public_key", "connectwise_private_key"]);
    const errors: ConnectWiseState["errors"] = validateSecrets(entries);
    const site = connectwiseSite ? normalizeSite(connectwiseSite) : null;
    if (connectwiseSite && !site) errors.connectwiseSite = "Enter the API host, like api-na.myconnectwise.net.";
    if (connectwiseCompanyId && !/^[\w.-]{1,50}$/.test(connectwiseCompanyId)) {
      errors.connectwiseCompanyId = "Company IDs are letters, digits, dots, dashes or underscores.";
    }
    if (connectwiseMember && !/^[\w.@-]{1,50}$/.test(connectwiseMember)) {
      errors.connectwiseMember = "Enter the member's identifier as shown in System → Members.";
    }
    if (Object.keys(errors).length > 0) return { errors, values };

    await storeSecrets(org.id, actorId, entries);
    await upsertProfile(org.id, {
      connectwiseSite: site,
      connectwiseCompanyId: connectwiseCompanyId || null,
      connectwiseMember: connectwiseMember || null,
    });
    await recordAudit({ orgId: org.id, actorUserId: actorId, action: "connectwise.settings_saved", target: site ?? "no site" });
    revalidatePath("/workspace/integrations");
    return { ok: true, values: { ...values, connectwiseSite: site ?? "" } };
  } catch (error) {
    return { ...fail(error), values };
  }
}

export type ConnectWiseTestState = { ok?: boolean; error?: string; detail?: string };

/** Round-trip to the org's Manage instance: version, and whether the member exists. */
export async function testConnectWise(_prev: ConnectWiseTestState, _formData: FormData): Promise<ConnectWiseTestState> {
  try {
    const { org } = await adminContext();
    const loaded = await loadConnectWise(org.id);
    if (!loaded.ok) return { error: loaded.reason };
    const { client, member, site } = loaded.conn;
    const version = await client.ping();
    const memberFound = await client.memberExists(member);
    if (!memberFound) return { error: `Connected to ${site} (Manage ${version}), but no member with the identifier "${member}" was found.` };
    return { ok: true, detail: `Connected to ${site} (Manage ${version}). Member ${member} found.` };
  } catch (error) {
    return fail(error);
  }
}

export type BrandColourState = {
  ok?: boolean;
  error?: string;
  errors?: { accent?: string; textColor?: string };
  values?: { accent: string; textColor: string };
};

/** The workspace's default brand colour and the font colour on it (website form + chat bubble). Blank = the defaults. */
export async function saveBrandColour(_prev: BrandColourState, formData: FormData): Promise<BrandColourState> {
  const rawAccent = String(formData.get("accent") ?? "").trim();
  const rawText = String(formData.get("textColor") ?? "").trim();
  const accent = rawAccent ? normaliseHex(rawAccent) : "";
  const textColor = rawText ? normaliseHex(rawText) : "";
  if (accent === null || textColor === null) {
    return {
      errors: {
        ...(accent === null ? { accent: "Enter a hex colour like #ff6a00." } : {}),
        ...(textColor === null ? { textColor: "Enter a hex colour like #ffffff." } : {}),
      },
      values: { accent: accent ?? rawAccent.toLowerCase(), textColor: textColor ?? rawText.toLowerCase() },
    };
  }
  const values = { accent, textColor };
  try {
    const { org, actorId } = await adminContext();
    await upsertProfile(org.id, { brandColor: accent || null, brandTextColor: textColor || null });
    await recordAudit({ orgId: org.id, actorUserId: actorId, action: "workspace.brand_colour_saved", target: [accent || "default", textColor || "auto"].join(" / ") });
    revalidatePath("/workspace/integrations");
    return { ok: true, values };
  } catch (error) {
    return { ...fail(error), values };
  }
}

export type ChatWidgetState = {
  ok?: boolean;
  error?: string;
  errors?: { greeting?: string; agentName?: string };
  values?: { enabled: boolean; greeting: string; agentName: string };
};

/** The website chat widget: on/off and greeting, on the org profile (its colour is the workspace brand colour). */
export async function saveChatWidget(_prev: ChatWidgetState, formData: FormData): Promise<ChatWidgetState> {
  const enabled = formData.get("enabled") === "on";
  const greeting = String(formData.get("greeting") ?? "").trim();
  const agentName = String(formData.get("agentName") ?? "").trim();
  const values = { enabled, greeting, agentName };
  try {
    const { org, actorId } = await adminContext();
    const errors: ChatWidgetState["errors"] = {};
    if (greeting.length > MAX_GREETING_CHARS) errors.greeting = `Keep the greeting under ${MAX_GREETING_CHARS} characters.`;
    if (agentName.length > MAX_AGENT_NAME_CHARS) errors.agentName = `Keep the name under ${MAX_AGENT_NAME_CHARS} characters.`;
    if (Object.keys(errors).length > 0) return { errors, values };

    await upsertProfile(org.id, { chatEnabled: enabled, chatGreeting: greeting || null, chatAgentName: agentName || null });
    await recordAudit({ orgId: org.id, actorUserId: actorId, action: "chat.settings_saved", target: enabled ? "enabled" : "disabled" });
    revalidatePath("/workspace/integrations");
    return { ok: true, values };
  } catch (error) {
    return { ...fail(error), values };
  }
}
