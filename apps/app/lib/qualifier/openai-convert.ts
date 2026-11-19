import type Anthropic from "@anthropic-ai/sdk";

/**
 * The agent keeps its conversation in Anthropic's message format (the loop, the tools and the Claude fallback all
 * speak it). These pure converters translate that to and from OpenAI's Responses API for the ChatGPT path, so
 * switching a turn between the two models needs no second copy of the history.
 */

export type ResponsesItem = Record<string, unknown>;
export type ResponsesTool = { type: "function"; name: string; description: string; parameters: unknown };
export type ResponsesOutputItem = {
  type: string;
  call_id?: string;
  name?: string;
  arguments?: string;
  content?: { type: string; text?: string }[];
};
export type ResponsesUsage = {
  input_tokens?: number;
  output_tokens?: number;
  input_tokens_details?: { cached_tokens?: number };
};

export function toResponsesTools(tools: Anthropic.Tool[]): ResponsesTool[] {
  return tools.map((t) => ({ type: "function", name: t.name, description: t.description ?? "", parameters: t.input_schema }));
}

const asText = (content: string | Anthropic.ToolResultBlockParam["content"]): string =>
  typeof content === "string" ? content : (content ?? []).map((b) => (b.type === "text" ? b.text : "")).join("\n");

/**
 * Anthropic-format history to Responses `input` items. `reasoning` holds the encrypted reasoning items a previous
 * ChatGPT turn returned, keyed by that turn's first tool-call id: with `store: false` they must be sent back in front
 * of the calls they led to. Claude's own thinking blocks are dropped.
 */
export function toResponsesInput(messages: Anthropic.MessageParam[], reasoning: Map<string, ResponsesItem[]> = new Map()): ResponsesItem[] {
  const out: ResponsesItem[] = [];
  for (const m of messages) {
    if (typeof m.content === "string") {
      out.push({ role: m.role, content: m.content });
      continue;
    }
    if (m.role === "user") {
      for (const b of m.content) {
        if (b.type === "tool_result") out.push({ type: "function_call_output", call_id: b.tool_use_id, output: asText(b.content) });
        else if (b.type === "text") out.push({ role: "user", content: b.text });
      }
      continue;
    }
    // An assistant turn: text, then the calls it made (with the reasoning that led to them, ahead of the first call).
    const calls = m.content.filter((b): b is Anthropic.ToolUseBlockParam => b.type === "tool_use");
    const text = m.content.flatMap((b) => (b.type === "text" && b.text.trim() ? [b.text] : [])).join("\n");
    if (calls[0]) out.push(...(reasoning.get(calls[0].id) ?? []));
    if (text) out.push({ role: "assistant", content: text });
    for (const c of calls) out.push({ type: "function_call", call_id: c.id, name: c.name, arguments: JSON.stringify(c.input ?? {}) });
  }
  return out;
}

/**
 * A Responses result as the Anthropic message the loop expects. Throws when a call's arguments are not valid JSON:
 * the caller treats that like any other ChatGPT failure and answers the turn with Claude.
 */
export function fromResponsesOutput(
  output: ResponsesOutputItem[],
  usage: ResponsesUsage | undefined,
  model: string,
): { message: Anthropic.Message; reasoning: ResponsesItem[] } {
  const content: Anthropic.ContentBlock[] = [];
  const reasoning = output.filter((o) => o.type === "reasoning") as ResponsesItem[];
  for (const item of output) {
    if (item.type === "message") {
      const text = (item.content ?? []).flatMap((c) => (c.type === "output_text" && c.text ? [c.text] : [])).join("");
      if (text) content.push({ type: "text", text, citations: null });
    } else if (item.type === "function_call") {
      let input: unknown;
      try {
        input = JSON.parse(item.arguments || "{}");
      } catch {
        throw new Error(`ChatGPT returned unreadable arguments for ${item.name}`);
      }
      if (!item.call_id || !item.name || typeof input !== "object" || input === null) throw new Error("ChatGPT returned a malformed tool call");
      content.push({ type: "tool_use", id: item.call_id, name: item.name, input } as Anthropic.ToolUseBlock);
    }
  }
  const message = {
    id: "openai",
    type: "message",
    role: "assistant",
    model,
    content,
    stop_reason: content.some((b) => b.type === "tool_use") ? "tool_use" : "end_turn",
    stop_sequence: null,
    usage: { input_tokens: usage?.input_tokens ?? 0, output_tokens: usage?.output_tokens ?? 0 },
  } as unknown as Anthropic.Message;
  return { message, reasoning };
}
