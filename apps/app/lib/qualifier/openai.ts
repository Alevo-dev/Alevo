import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import { vendorFetch } from "@/lib/http/vendor-fetch";
import { trackOpenAI } from "@/lib/usage/spend";
import { fromResponsesOutput, toResponsesInput, toResponsesTools, type ResponsesItem, type ResponsesOutputItem, type ResponsesUsage } from "./openai-convert";

/** The ChatGPT model that can answer web chats (Admin console → Settings → Web chat model). One place to rename it. */
export const OPENAI_MODEL = "gpt-6-luna";
/**
 * How hard the model thinks before answering. Medium is OpenAI's guidance for this model (low raises tool-argument
 * errors) and the comparison should also try low: it is the trade of speed against accuracy.
 */
const REASONING_EFFORT = "medium";
const TIMEOUT_MS = 30_000;
const MAX_OUTPUT_TOKENS = 4096;

type ResponsesResult = { output?: ResponsesOutputItem[]; usage?: ResponsesUsage; error?: { message?: string } | null; status?: string };

/**
 * One run's model calls through OpenAI's Responses API, returned in the Anthropic shape the agent loop expects.
 * Stateless (`store: false`): nothing is kept on OpenAI's side; the encrypted reasoning items a turn returns are held
 * here for the rest of the run and sent back with the next turn. Throws on any failure, and the caller answers that
 * turn with Claude instead.
 */
export function openaiRun(args: { system: string; tools: Anthropic.Tool[]; orgId: string; conversationId: string }) {
  const reasoning = new Map<string, ResponsesItem[]>();
  const tools = toResponsesTools(args.tools);

  return async function create(messages: Anthropic.MessageParam[]): Promise<Anthropic.Message> {
    const key = process.env.OPENAI_API_KEY;
    if (!key) throw new Error("OPENAI_API_KEY is not set");
    const res = await vendorFetch(
      "https://api.openai.com/v1/responses",
      {
        method: "POST",
        headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
        body: JSON.stringify({
          model: OPENAI_MODEL,
          instructions: args.system,
          input: toResponsesInput(messages, reasoning),
          tools,
          tool_choice: "auto",
          parallel_tool_calls: true,
          reasoning: { effort: REASONING_EFFORT },
          include: ["reasoning.encrypted_content"],
          store: false,
          max_output_tokens: MAX_OUTPUT_TOKENS,
        }),
      },
      // Generating is not a side effect: nothing reaches the contact until a tool runs, so a replay is only a cost.
      { idempotent: true, retries: 1, timeoutMs: TIMEOUT_MS },
    );
    if (!res.ok) throw new Error(`OpenAI responses failed (${res.status}): ${(await res.text()).slice(0, 300)}`);
    const json = (await res.json()) as ResponsesResult;
    if (json.error || json.status === "failed") throw new Error(`OpenAI responses failed: ${json.error?.message ?? json.status}`);

    const { message, reasoning: items } = fromResponsesOutput(json.output ?? [], json.usage, OPENAI_MODEL);
    const firstCall = message.content.find((b) => b.type === "tool_use");
    if (firstCall && items.length > 0) reasoning.set(firstCall.id, items);
    trackOpenAI(OPENAI_MODEL, json.usage, "agent_turn", args.orgId, args.conversationId);
    return message;
  };
}
