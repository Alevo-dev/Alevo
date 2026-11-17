import "server-only";
import * as Sentry from "@sentry/nextjs";
import { recordSpend, type SpendEnv } from "@alevo/db";

/**
 * What our vendor calls cost, per environment, for the admin console's Spend page (table `vendor_spend`).
 * Rates are ESTIMATES from each vendor's public price list (update when prices change); the one real figure is Vapi's
 * own per-call cost. Recording is fire-and-forget: it never slows or fails the call it measures.
 */

/** Where this process runs. Dev and staging share one database, so every row says which one wrote it. */
export function currentEnv(): SpendEnv {
  if (process.env.NEXT_PUBLIC_APP_ENV === "staging") return "staging";
  return process.env.NODE_ENV === "production" ? "production" : "development";
}

/** USD per million tokens (input, output). Matched by model-name prefix; anything unknown uses the Sonnet rate. */
const CLAUDE_RATES: [prefix: string, input: number, output: number][] = [
  ["claude-haiku", 1, 5],
  ["claude-sonnet", 3, 15],
  ["claude-opus", 15, 75],
];
const VOYAGE_USD_PER_MTOK = 0.02;
const SMS_USD_PER_SEGMENT = 0.0083; // Twilio US/Canada long code, either direction
const EMAIL_USD = 0.0004; // Resend Pro, per email

function track(e: Parameters<typeof recordSpend>[0]) {
  recordSpend(e).catch((err) => Sentry.captureException(err));
}

type ClaudeUsage = { input_tokens: number; output_tokens: number; cache_read_input_tokens?: number | null; cache_creation_input_tokens?: number | null };

/** One Claude call. Cached input is billed at about a tenth of a normal input token, so it counts at that rate. */
export function trackClaude(model: string, usage: ClaudeUsage, kind: string, orgId?: string | null) {
  const [, inRate, outRate] = CLAUDE_RATES.find(([p]) => model.startsWith(p)) ?? CLAUDE_RATES[1]!;
  const input = usage.input_tokens + (usage.cache_creation_input_tokens ?? 0) * 1.25 + (usage.cache_read_input_tokens ?? 0) * 0.1;
  track({
    env: currentEnv(),
    provider: "anthropic",
    kind,
    orgId,
    units: usage.input_tokens + usage.output_tokens,
    costUsd: (input * inRate + usage.output_tokens * outRate) / 1e6,
    detail: model,
  });
}

export function trackEmbedding(model: string, tokens: number, orgId?: string | null) {
  track({ env: currentEnv(), provider: "voyage", kind: "embedding", orgId, units: tokens, costUsd: (tokens * VOYAGE_USD_PER_MTOK) / 1e6, detail: model });
}

export function trackSms(direction: "in" | "out", segments: number, orgId: string) {
  const n = Math.max(1, segments);
  track({ env: currentEnv(), provider: "twilio", kind: `sms_${direction}`, orgId, units: n, costUsd: n * SMS_USD_PER_SEGMENT });
}

export function trackEmail(orgId?: string | null) {
  track({ env: currentEnv(), provider: "resend", kind: "email_out", orgId, units: 1, costUsd: EMAIL_USD });
}

/** A finished phone call: Vapi's own cost (the call's total: its telephony, voice and model) and the minutes. */
export function trackCall(orgId: string, minutes: number, costUsd: number, callRef: string) {
  track({ env: currentEnv(), provider: "vapi", kind: "call", orgId, units: minutes, costUsd, estimated: false, detail: callRef });
}
