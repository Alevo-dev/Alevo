import { describe, expect, it } from "vitest";
import { isReady, readiness, type ReadinessFacts, type ReadinessKey } from "@alevo/db";

/** A workspace with everything done; each case below flips one fact. */
const BASE: ReadinessFacts = {
  ownerAccepted: true,
  companyName: "Northwind IT",
  offering: "Managed IT for clinics",
  idealCustomer: "10–100 seat clinics in Ontario",
  readyDocs: 2,
  bookingTool: "google",
  bookingConfigured: true,
  bookingDeclined: false,
  smsFromNumber: "+16135550100",
  phoneDeclined: false,
  slackSaved: true,
  slackVerified: true,
  slackDeclined: false,
  emailAlerts: true,
  ownerEmailCount: 1,
  agentOn: true,
  repliedConversations: 3,
};

const KEYS: ReadinessKey[] = ["owner", "profile", "knowledge", "booking", "phone", "slack", "alerts", "agent", "proven"];

function notDone(items: ReturnType<typeof readiness>) {
  return items.filter((i) => !i.done).map((i) => i.key);
}

describe("readiness", () => {
  it("lists the nine items in order, all done for a finished workspace", () => {
    const items = readiness(BASE);
    expect(items.map((i) => i.key)).toEqual(KEYS);
    expect(notDone(items)).toEqual([]);
    expect(isReady(items)).toBe(true);
  });

  it.each<[ReadinessKey, Partial<ReadinessFacts>]>([
    ["owner", { ownerAccepted: false }],
    ["profile", { idealCustomer: null }],
    ["knowledge", { readyDocs: 0 }],
    ["booking", { bookingTool: null, bookingDeclined: false }],
    ["booking", { bookingTool: "calcom", bookingConfigured: false }],
    ["phone", { smsFromNumber: null, phoneDeclined: false }],
    ["slack", { slackVerified: false }],
    ["alerts", { ownerEmailCount: 0 }],
    ["alerts", { emailAlerts: false }],
    ["agent", { agentOn: false }],
    ["proven", { repliedConversations: 0 }],
  ])("flips only %s", (key, change) => {
    const items = readiness({ ...BASE, ...change });
    expect(notDone(items)).toEqual([key]);
    expect(isReady(items)).toBe(false);
  });

  it("counts a declined booking or phone as done, and says so", () => {
    const booking = readiness({ ...BASE, bookingTool: null, bookingDeclined: true });
    expect(notDone(booking)).toEqual([]);
    expect(booking.find((i) => i.key === "booking")!.declined).toBe(true);
    expect(booking.find((i) => i.key === "phone")!.declined).toBe(false);
    expect(notDone(readiness({ ...BASE, smsFromNumber: null, phoneDeclined: true }))).toEqual([]);
    const slack = readiness({ ...BASE, slackSaved: false, slackVerified: false, slackDeclined: true });
    expect(notDone(slack)).toEqual([]);
    expect(slack.find((i) => i.key === "slack")!.declined).toBe(true);
    // A saved webhook trumps the decline: it has to be tested.
    expect(notDone(readiness({ ...BASE, slackVerified: false, slackDeclined: true }))).toEqual(["slack"]);
    // Connected trumps a stale decline flag.
    expect(readiness({ ...BASE, bookingDeclined: true }).find((i) => i.key === "booking")!.declined).toBe(false);
  });

  it("links each item to the page that fixes it and marks the two declinable ones", () => {
    const byKey = Object.fromEntries(readiness(BASE).map((i) => [i.key, i]));
    expect(byKey.owner!.href).toBe("/workspace/profile");
    expect(byKey.knowledge!.href).toBe("/workspace/knowledge");
    expect(byKey.booking!.href).toBe("/workspace/integrations");
    expect(byKey.agent!.href).toBe("/workspace/agent");
    expect(byKey.proven!.href).toBe("/conversations");
    expect(byKey.booking!.declinable).toBe("booking");
    expect(byKey.phone!.declinable).toBe("phone");
    expect(byKey.slack!.declinable).toBe("slack");
    expect(byKey.agent!.declinable).toBeUndefined();
  });
});
