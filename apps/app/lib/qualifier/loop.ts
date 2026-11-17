import type Anthropic from "@anthropic-ai/sdk";

/** Guard against a runaway tool loop; a normal turn is 1–2 iterations, a nudge or a catch-up adds a few more. */
export const MAX_TURNS = 8;
/** How many times a run that ended without answering is told to answer. */
export const MAX_NUDGES = 2;
/** How many times a run is handed messages that arrived while it was working. */
const MAX_CATCH_UPS = 2;

/** Saving a name or scoring the lead is bookkeeping; the contact still needs an answer. */
export const REPLY_NUDGE =
  "You have not replied to the contact yet and their message is still waiting. Reply now with the reply_to_contact tool: one message, following everything above. Saving details, scoring or setting a status does not count as a reply.";

/** What a run did, returned with its result so the Inngest run page shows it. */
export type RunTrace = { turns: number; tools: string[]; nudges: number; catchUps: number };

type Deps = {
  create: (messages: Anthropic.MessageParam[]) => Promise<Anthropic.Message>;
  dispatch: (name: string, input: Record<string, unknown>) => Promise<string>;
  /** Contact messages that arrived after the ones this run started from (each call returns only new ones). */
  fresh: () => Promise<string[]>;
};

/**
 * The model/tool loop. The contact is only ever answered through `reply_to_contact`, so a run that stops without
 * calling it (the model saved a name and called it a day) is told to answer, and messages that arrive mid-run are
 * handed over in the same run instead of being skipped. `effects.replied` stays true once any reply went out.
 */
export async function driveAgent(
  messages: Anthropic.MessageParam[],
  deps: Deps,
  opts: { mustReply: boolean },
  effects: { replied: boolean },
): Promise<RunTrace> {
  const trace: RunTrace = { turns: 0, tools: [], nudges: 0, catchUps: 0 };
  let repliedEarlier = false;

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const response = await deps.create(messages);
    trace.turns++;
    const toolUses = response.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");

    if (toolUses.length > 0) {
      // Preserve the full assistant turn (incl. thinking blocks) before replying.
      messages.push({ role: "assistant", content: response.content });
      const results: Anthropic.ToolResultBlockParam[] = [];
      for (const call of toolUses) {
        trace.tools.push(call.name);
        const content = await deps.dispatch(call.name, (call.input ?? {}) as Record<string, unknown>);
        results.push({ type: "tool_result", tool_use_id: call.id, content });
      }
      messages.push({ role: "user", content: results });
      continue;
    }

    // The model stopped: answer is owed, or new messages are waiting.
    let next: string | null = null;
    if (opts.mustReply && !effects.replied && trace.nudges < MAX_NUDGES) {
      trace.nudges++;
      next = REPLY_NUDGE;
    } else if (opts.mustReply && trace.catchUps < MAX_CATCH_UPS) {
      const fresh = await deps.fresh();
      if (fresh.length > 0) {
        trace.catchUps++;
        repliedEarlier ||= effects.replied;
        effects.replied = false;
        next = fresh.join("\n\n");
      }
    }
    if (next === null) break;
    if (response.content.length > 0) messages.push({ role: "assistant", content: response.content });
    messages.push({ role: "user", content: next });
  }

  effects.replied ||= repliedEarlier;
  return trace;
}
