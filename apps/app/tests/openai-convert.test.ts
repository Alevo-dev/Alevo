import { describe, expect, it } from "vitest";
import type Anthropic from "@anthropic-ai/sdk";
import { fromResponsesOutput, toResponsesInput, toResponsesTools } from "../lib/qualifier/openai-convert";
import { openaiSplit } from "../lib/usage/spend";

describe("toResponsesInput", () => {
  const history: Anthropic.MessageParam[] = [
    { role: "user", content: "Hi, what do you do?" },
    {
      role: "assistant",
      content: [
        { type: "thinking", thinking: "claude only", signature: "x" },
        { type: "text", text: "Let me check." },
        { type: "tool_use", id: "call_1", name: "reply_to_contact", input: { message: "We build websites." } },
      ],
    },
    { role: "user", content: [{ type: "tool_result", tool_use_id: "call_1", content: "sent" }] },
    { role: "user", content: "How much?" },
  ];
  it("maps text, calls and results, dropping Claude's thinking", () => {
    expect(toResponsesInput(history)).toEqual([
      { role: "user", content: "Hi, what do you do?" },
      { role: "assistant", content: "Let me check." },
      { type: "function_call", call_id: "call_1", name: "reply_to_contact", arguments: '{"message":"We build websites."}' },
      { type: "function_call_output", call_id: "call_1", output: "sent" },
      { role: "user", content: "How much?" },
    ]);
  });
  it("puts a turn's saved reasoning ahead of its first call", () => {
    const reasoning = new Map([["call_1", [{ type: "reasoning", id: "r1", encrypted_content: "abc" }]]]);
    const input = toResponsesInput(history, reasoning);
    expect(input[1]).toEqual({ type: "reasoning", id: "r1", encrypted_content: "abc" });
    expect(input[2]).toEqual({ role: "assistant", content: "Let me check." });
  });
});

describe("toResponsesTools", () => {
  it("turns Anthropic tool definitions into function tools", () => {
    const tool: Anthropic.Tool = { name: "set_status", description: "Set it", input_schema: { type: "object", properties: {} } };
    expect(toResponsesTools([tool])).toEqual([{ type: "function", name: "set_status", description: "Set it", parameters: { type: "object", properties: {} } }]);
  });
});

describe("fromResponsesOutput", () => {
  it("reads text and tool calls into an Anthropic message, and keeps the reasoning items", () => {
    const { message, reasoning } = fromResponsesOutput(
      [
        { type: "reasoning" },
        { type: "function_call", call_id: "c9", name: "reply_to_contact", arguments: '{"message":"Hello"}' },
        { type: "message", content: [{ type: "output_text", text: "done" }] },
      ],
      { input_tokens: 10, output_tokens: 5 },
      "gpt-6-luna",
    );
    expect(message.stop_reason).toBe("tool_use");
    expect(message.content).toEqual([
      { type: "tool_use", id: "c9", name: "reply_to_contact", input: { message: "Hello" } },
      { type: "text", text: "done", citations: null },
    ]);
    expect(message.usage).toMatchObject({ input_tokens: 10, output_tokens: 5 });
    expect(reasoning).toHaveLength(1);
  });
  it("throws on unreadable tool arguments, so the turn falls back to Claude", () => {
    expect(() => fromResponsesOutput([{ type: "function_call", call_id: "c", name: "x", arguments: "{oops" }], undefined, "m")).toThrow();
  });
  it("a text-only answer ends the turn", () => {
    expect(fromResponsesOutput([{ type: "message", content: [{ type: "output_text", text: "hi" }] }], undefined, "m").message.stop_reason).toBe("end_turn");
  });
});

describe("openaiSplit", () => {
  it("prices input, cached input and output (reasoning counts as output)", () => {
    const s = openaiSplit("gpt-6-luna", { input_tokens: 1_000_000, output_tokens: 1_000_000, input_tokens_details: { cached_tokens: 500_000 } });
    expect(s.inputTokens).toBe(1_000_000);
    expect(s.inputCostUsd).toBeCloseTo(0.5 * 0.1 + 0.5 * 0.1 * 0.1);
    expect(s.outputCostUsd).toBeCloseTo(0.5);
  });
});
