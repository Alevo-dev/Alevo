import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { organizations, orgProfiles, withService } from "@alevo/db";
import { numberChanged, numberMatches } from "../lib/voice/number";
import { releaseVapiNumber } from "../lib/voice/release";

/**
 * A phone number belongs to one org. Calls reach an org by the Vapi record its
 * profile holds, so the record must follow the number: it is dropped when the
 * number changes, released from any other org when one takes it over, and a call
 * is only answered while the number dialled is still the org's saved one.
 */

describe("numberMatches (is this call for the org's saved number?)", () => {
  it("is false when the org has no saved number", () => {
    expect(numberMatches(null, "+18073025386")).toBe(false);
    expect(numberMatches(null, null)).toBe(false);
  });
  it("is true when the payload names no number (older message shapes)", () => {
    expect(numberMatches("+18073025386", null)).toBe(true);
  });
  it("compares numbers by their digits, not their formatting", () => {
    expect(numberMatches("+18073025386", "+1 (807) 302-5386")).toBe(true);
    expect(numberMatches("+18073025386", "8073025386")).toBe(true);
  });
  it("is false when the dialled number is a different one", () => {
    expect(numberMatches("+18073025386", "+16135550101")).toBe(false);
  });
});

describe("numberChanged", () => {
  it("is true for a changed or cleared number, false for the same one", () => {
    expect(numberChanged("+18073025386", "+16135550101")).toBe(true);
    expect(numberChanged("+18073025386", null)).toBe(true);
    expect(numberChanged(null, "+18073025386")).toBe(true);
    expect(numberChanged("+18073025386", "+1 807 302 5386")).toBe(false);
    expect(numberChanged(null, null)).toBe(false);
  });
});

const A = "org_test_voice_number_a";
const B = "org_test_voice_number_b";
let a: string;
let b: string;
const RECORD = "00000000-test-record";

async function cleanup() {
  await withService((tx) => tx.delete(organizations).where(sql`${organizations.clerkId} in (${A}, ${B})`)); // cascades
}

beforeAll(async () => {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL must point at Postgres");
  await cleanup();
  const orgs = await withService((tx) =>
    tx.insert(organizations).values([{ clerkId: A, name: "Voice A" }, { clerkId: B, name: "Voice B" }]).returning({ id: organizations.id, clerkId: organizations.clerkId }),
  );
  a = orgs.find((o) => o.clerkId === A)!.id;
  b = orgs.find((o) => o.clerkId === B)!.id;
  await withService((tx) =>
    tx.insert(orgProfiles).values([
      { orgId: a, vapiPhoneNumberId: RECORD, voiceEnabled: true },
      { orgId: b, vapiPhoneNumberId: RECORD, voiceEnabled: true },
    ]),
  );
});

afterAll(cleanup);

describe("releaseVapiNumber", () => {
  it("clears the record and switches calls off for every other org, and leaves the keeper alone", async () => {
    await releaseVapiNumber(b, RECORD);
    const rows = await withService((tx) =>
      tx.select({ orgId: orgProfiles.orgId, id: orgProfiles.vapiPhoneNumberId, on: orgProfiles.voiceEnabled }).from(orgProfiles).where(sql`${orgProfiles.orgId} in (${a}, ${b})`),
    );
    expect(rows.find((r) => r.orgId === a)).toMatchObject({ id: null, on: false });
    expect(rows.find((r) => r.orgId === b)).toMatchObject({ id: RECORD, on: true });
  });
});
