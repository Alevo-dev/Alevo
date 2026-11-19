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

/**
 * USD per million tokens (input, output), per model. A new model: add its exact id here first (an exact id wins),
 * or it is priced by its family prefix, and anything else at the Sonnet rate. The Spend page lists each model separately.
 */
const CLAUDE_RATES: [model: string, input: number, output: number][] = [
  ["claude-haiku-5-5", 1, 5],
  ["claude-sonnet-5", 2, 10],
  ["claude-opus-5-5", 15, 75],
  // Family fallbacks for a model id not listed above.
  ["claude-haiku", 1, 5],
  ["claude-sonnet", 2, 10],
  ["claude-opus", 15, 75],
];
/**
 * ChatGPT models, USD per million tokens: input, output, and what cached input counts as (a share of the input rate).
 * gpt-6-luna: $0.10 input, $0.50 output per million (confirmed by the owner). The cached-input share is an assumption: confirm it on OpenAI's pricing page.
 */
const OPENAI_RATES: [model: string, input: number, output: number, cachedShare: number][] = [["gpt-6-luna", 0.1, 0.5, 0.1]];
const VOYAGE_USD_PER_MTOK = 0.02;
const SMS_USD_PER_SEGMENT = 0.0083; // Twilio US/Canada long code, either direction
const EMAIL_USD = 0.0004; // Resend Pro, per email

function track(e: Parameters<typeof recordSpend>[0]) {
  recordSpend(e).catch((err) => Sentry.captureException(err));
}

type ClaudeUsage = { input_tokens: number; output_tokens: number; cache_read_input_tokens?: number | null; cache_creation_input_tokens?: number | null };

/**
 * What one Claude call costs at that model's rate, split into the prompt side and the reply side. Cached input is
 * billed differently from a normal input token (a write 1.25x, a read about a tenth), so it counts at that rate and
 * the input token count is every token sent, cached or not.
 */
export function claudeSplit(model: string, usage: ClaudeUsage) {
  const [, inRate, outRate] = CLAUDE_RATES.find(([m]) => model === m) ?? CLAUDE_RATES.find(([m]) => model.startsWith(m)) ?? CLAUDE_RATES[1]!;
  const cacheWrite = usage.cache_creation_input_tokens ?? 0;
  const cacheRead = usage.cache_read_input_tokens ?? 0;
  const weighted = usage.input_tokens + cacheWrite * 1.25 + cacheRead * 0.1;
  return {
    inputTokens: usage.input_tokens + cacheWrite + cacheRead,
    outputTokens: usage.output_tokens,
    inputCostUsd: (weighted * inRate) / 1e6,
    outputCostUsd: (usage.output_tokens * outRate) / 1e6,
  };
}

export function claudeCost(model: string, usage: ClaudeUsage): number {
  const s = claudeSplit(model, usage);
  return s.inputCostUsd + s.outputCostUsd;
}

export function trackClaude(model: string, usage: ClaudeUsage, kind: string, orgId?: string | null, conversationId?: string | null) {
  const split = claudeSplit(model, usage);
  track({
    env: currentEnv(),
    provider: "anthropic",
    kind,
    orgId,
    conversationId,
    units: split.inputTokens + split.outputTokens,
    costUsd: split.inputCostUsd + split.outputCostUsd,
    detail: model,
    split,
  });
}

type OpenAIUsage = { input_tokens?: number; output_tokens?: number; input_tokens_details?: { cached_tokens?: number } };

/** One ChatGPT call. `input_tokens` already includes the cached ones; reasoning tokens are part of `output_tokens` and billed as output. */
export function openaiSplit(model: string, usage: OpenAIUsage | undefined) {
  const [, inRate, outRate, cachedShare] = OPENAI_RATES.find(([m]) => model === m) ?? OPENAI_RATES[0]!;
  const input = usage?.input_tokens ?? 0;
  const cached = Math.min(usage?.input_tokens_details?.cached_tokens ?? 0, input);
  const output = usage?.output_tokens ?? 0;
  return {
    inputTokens: input,
    outputTokens: output,
    inputCostUsd: ((input - cached + cached * cachedShare) * inRate) / 1e6,
    outputCostUsd: (output * outRate) / 1e6,
  };
}

export function trackOpenAI(model: string, usage: OpenAIUsage | undefined, kind: string, orgId?: string | null, conversationId?: string | null) {
  const split = openaiSplit(model, usage);
  track({ env: currentEnv(), provider: "openai", kind, orgId, conversationId, units: split.inputTokens + split.outputTokens, costUsd: split.inputCostUsd + split.outputCostUsd, detail: model, split });
}

export function trackEmbedding(model: string, tokens: number, orgId?: string | null) {
  const costUsd = (tokens * VOYAGE_USD_PER_MTOK) / 1e6;
  // An embedding is all input: nothing comes back to be billed.
  track({ env: currentEnv(), provider: "voyage", kind: "embedding", orgId, units: tokens, costUsd, detail: model, split: { inputTokens: tokens, outputTokens: 0, inputCostUsd: costUsd, outputCostUsd: 0 } });
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
