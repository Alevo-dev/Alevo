import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import * as Sentry from "@sentry/nextjs";
import { CALL_SUMMARY_PROMPT } from "@/lib/voice/summary-prompt";

const MODEL = "claude-sonnet-5";

/**
 * The fallback when Vapi's end-of-call report has no summary but we have the
 * transcript: the same prompt the assistant's analysis plan uses, run here.
 * Best-effort — any failure returns null and the call keeps "No summary".
 */
export async function summarizeCall(transcript: string): Promise<string | null> {
  const text = transcript.trim();
  if (!text) return null;
  try {
    const client = new Anthropic({ timeout: 30_000, maxRetries: 1 });
    const res = await client.messages.create({
      model: MODEL,
      max_tokens: 400,
      system: CALL_SUMMARY_PROMPT,
      messages: [{ role: "user", content: `Transcript of the call:\n\n${text.slice(0, 20_000)}` }],
    });
    const out = res.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();
    return out || null;
  } catch (err) {
    Sentry.captureException(err);
    return null;
  }
}
