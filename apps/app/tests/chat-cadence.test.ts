import { describe, expect, it } from "vitest";

// `lib/chat/cadence.ts` imports server-only code; the schedule itself is plain data, so read it through a mock.
import { vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@alevo/db", () => ({}));

describe("chat cadence", () => {
  it("nudges at 3m then 2m, and the third line (1m) closes the chat", async () => {
    const { CHAT_NUDGES } = await import("../lib/chat/cadence");
    expect(CHAT_NUDGES.map((n) => n.after)).toEqual(["3m", "2m", "1m"]);
    expect(CHAT_NUDGES.map((n) => Boolean(n.closes))).toEqual([false, false, true]);
    expect(CHAT_NUDGES.every((n) => n.body.length > 0)).toBe(true);
  });
});
