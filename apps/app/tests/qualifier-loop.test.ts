import { describe, expect, it } from "vitest";
import type Anthropic from "@anthropic-ai/sdk";
import { driveAgent, MAX_NUDGES, REPLY_NUDGE } from "../lib/qualifier/loop";

const text = (t: string) => ({ content: [{ type: "text", text: t }] }) as unknown as Anthropic.Message;
const tools = (...names: string[]) =>
  ({ content: names.map((name, i) => ({ type: "tool_use", id: `t${i}`, name, input: {} })) }) as unknown as Anthropic.Message;

/** Replays scripted model turns; a `reply_to_contact` call marks the reply as sent, like the real tool does. */
function setup(script: Anthropic.Message[], fresh: string[][] = []) {
  const effects = { replied: false };
  const sent: Anthropic.MessageParam[][] = [];
  let turn = 0;
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: "hi" }];
  const deps = {
    create: async (m: Anthropic.MessageParam[]) => {
      sent.push(structuredClone(m));
      return script[turn++] ?? text("done");
    },
    dispatch: async (name: string) => {
      if (name === "reply_to_contact") effects.replied = true;
      return "ok";
    },
    fresh: async () => fresh.shift() ?? [],
  };
  return { effects, messages, sent, deps, turns: () => turn };
}

describe("driveAgent: the contact always gets a reply", () => {
  it("nudges once when the model saves details and stops without replying", async () => {
    const s = setup([tools("save_contact_details"), text("saved"), tools("reply_to_contact"), text("done")]);
    const trace = await driveAgent(s.messages, s.deps, { mustReply: true }, s.effects);
    expect(s.effects.replied).toBe(true);
    expect(trace.nudges).toBe(1);
    expect(JSON.stringify(s.sent[2])).toContain(REPLY_NUDGE);
  });

  it("does not nudge when the model already replied", async () => {
    const s = setup([tools("reply_to_contact"), text("done")]);
    const trace = await driveAgent(s.messages, s.deps, { mustReply: true }, s.effects);
    expect(trace.nudges).toBe(0);
    expect(s.turns()).toBe(2);
  });

  it("never nudges a cadence nudge or other directive run", async () => {
    const s = setup([text("nothing to say")]);
    const trace = await driveAgent(s.messages, s.deps, { mustReply: false }, s.effects);
    expect(trace.nudges).toBe(0);
    expect(s.effects.replied).toBe(false);
  });

  it("stops nudging after the limit", async () => {
    const s = setup([text("a"), text("b"), text("c"), text("d")]);
    const trace = await driveAgent(s.messages, s.deps, { mustReply: true }, s.effects);
    expect(trace.nudges).toBe(MAX_NUDGES);
    expect(s.effects.replied).toBe(false);
  });

  it("records every tool the run called", async () => {
    const s = setup([tools("save_contact_details", "record_fit_score"), tools("reply_to_contact"), text("done")]);
    const trace = await driveAgent(s.messages, s.deps, { mustReply: true }, s.effects);
    expect(trace.tools).toEqual(["save_contact_details", "record_fit_score", "reply_to_contact"]);
  });
});

describe("driveAgent: a message that arrives while the agent works", () => {
  it("is answered in the same run, and the first reply still counts", async () => {
    const s = setup([tools("reply_to_contact"), text("done"), tools("reply_to_contact"), text("done")], [["one more thing"], []]);
    const trace = await driveAgent(s.messages, s.deps, { mustReply: true }, s.effects);
    expect(trace.catchUps).toBe(1);
    expect(JSON.stringify(s.sent[2])).toContain("one more thing");
    expect(s.effects.replied).toBe(true);
  });

  it("nudges for the new message when the model skips it", async () => {
    const s = setup([tools("reply_to_contact"), text("done"), text("skipped"), tools("reply_to_contact"), text("done")], [["wait"], []]);
    const trace = await driveAgent(s.messages, s.deps, { mustReply: true }, s.effects);
    expect(trace.nudges).toBe(1);
    expect(s.effects.replied).toBe(true);
  });
});
