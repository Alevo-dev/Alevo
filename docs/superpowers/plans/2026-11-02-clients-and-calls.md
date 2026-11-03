# Clients, one contact per person, one conversation per call — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One contact per client (merged by email or phone), one conversation per phone call with a summary card, and a Conversations page organised as a clients list with a client page beneath it.

**Architecture:** A single `resolveContact` / `claimIdentity` pair in `@alevo/db` owns contact identity and merges duplicates in one transaction; every channel entry point and the agent's save-details tool route through it, and two partial unique indexes enforce it. Voice gets `callThread(callRef)`, which keys a conversation and a `calls` stub on Vapi's call id so each call is its own thread; the end-of-call report fills the stub and the thread renders a call card. The list reads `contacts` ordered by a trigger-maintained `last_activity_at`.

**Tech Stack:** Next.js 16 App Router, Drizzle + postgres-js (`withService` / `withOrg`), Supabase SQL migrations, Inngest, Vapi, Anthropic SDK (only in `lib/qualifier/`), Vitest (DB tests need `DATABASE_URL`, skipped without).

**Spec:** `docs/superpowers/specs/2026-11-02-clients-and-calls-design.md`

## Global Constraints

- Service-path writes are scoped to `orgId` in code; current-org reads filter explicitly by org (platform admins bypass RLS).
- Migrations in `supabase/migrations/` are the schema's source of truth; `packages/db/src/schema/*` mirrors them. Next numbers: `0037_contact_identity.sql`, `0038_client_activity.sql`. Apply with `pnpm db:push:dev` (the user runs it; the CLI prompts).
- A merge keeps the OLDER contact (smaller `created_at`, then `id`); the loser's rows move, the loser is deleted, an audit row `contact.merged` is written with `target = <loser id>` and `meta = { into: <keeper id> }`.
- `normalizeEmail`: trim + lower. `normalizePhone`: keep leading `+` and digits only; exactly 10 digits → `+1` + digits; 11 digits starting with `1` → `+` + digits; otherwise return the cleaned value unchanged (a `+44…` number stays as typed minus spaces); empty → null.
- Anthropic code only in `lib/qualifier/`. Model `claude-sonnet-5`.
- UI: design-system tokens only, `@alevo/ui` primitives, no native controls, every destructive action via `ConfirmDialog`/`ConfirmSubmit` (none needed here), loading buttons use `loading={pending}`.
- Nav label stays "Conversations". Thread URLs `/conversations/[id]` do not change.
- Never run `prettier --write`; match 120–160 column style by hand. No commits unless the user asks.
- Vitest: `server-only` is aliased to a stub (`vitest.config.ts`); app modules that import `@/…` cannot be imported from tests — keep testable logic in modules that import only relative paths or `@alevo/*`.

## Review Focus

1. A non-North-American number (`+44 20 7946 0958`) must not be rewritten into a `+1` number — Task 1 test.
2. Two contacts each hold an email (different) and one touch carries the keeper's phone with the loser's email: the keeper's email stays, the loser's email is dropped (the unique index forbids two), the loser's conversations move — Task 3 test.
3. A Vapi `tool-calls` batch with `save_contact_details` (email that merges) followed by `book_meeting` in the same request: the meeting must land on the surviving contact, not the deleted one — Task 4 (voice dispatch updates `ctx.contactId` from the returned id; DB test on `saveContactDetails` returning the survivor).
4. A caller who hangs up during the greeting (zero tool calls) still gets a call row and a conversation at end-of-call, and a repeated end-of-call report changes nothing — Task 5 test.
5. A contact with no conversations yet (freshly created by a merge edge or a form that failed after the contact insert) must appear on the list with "No conversations" rather than crash the aggregate — Task 9 test.

---

## Slice 1 — identity

### Task 1: Identity normalisers

**Files:**
- Create: `packages/db/src/crm/identity.ts`
- Modify: `packages/db/src/index.ts` (export)
- Test: `apps/app/tests/identity.test.ts`

**Interfaces:**
- Produces: `normalizeEmail(v: string | null | undefined): string | null`, `normalizePhone(v: string | null | undefined): string | null`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { normalizeEmail, normalizePhone } from "@alevo/db";

describe("normalizeEmail", () => {
  it("trims and lowercases", () => expect(normalizeEmail("  Laith@Example.COM ")).toBe("laith@example.com"));
  it("is null for blanks", () => { expect(normalizeEmail("")).toBeNull(); expect(normalizeEmail(null)).toBeNull(); });
});

describe("normalizePhone", () => {
  it("adds +1 to a bare 10-digit number", () => expect(normalizePhone("613-884-1155")).toBe("+16138841155"));
  it("adds + to an 11-digit number starting with 1", () => expect(normalizePhone("1 (613) 884 1155")).toBe("+16138841155"));
  it("keeps E.164 as is", () => expect(normalizePhone("+16138841155")).toBe("+16138841155"));
  it("leaves other international numbers alone apart from spacing", () => expect(normalizePhone("+44 20 7946 0958")).toBe("+442079460958"));
  it("is null for blanks and letter-only input", () => { expect(normalizePhone("")).toBeNull(); expect(normalizePhone("n/a")).toBeNull(); });
});
```

- [ ] **Step 2: Run it** — `cd apps/app && npx vitest run tests/identity.test.ts` — Expected: FAIL, `normalizeEmail` is not exported.
- [ ] **Step 3: Implement both functions in `packages/db/src/crm/identity.ts`; add `export { normalizeEmail, normalizePhone } from "./crm/identity";` to `packages/db/src/index.ts`.**
- [ ] **Step 4: Run it** — Expected: PASS (7 tests).

### Task 2: Migration 0037 — normalise, dedupe, unique phone

**Files:**
- Create: `supabase/migrations/0037_contact_identity.sql`
- Modify: `packages/db/src/schema/conversations.ts` (contacts indexes mirror)

**Interfaces:**
- Produces: unique partial index `contacts_org_phone_unique on contacts (org_id, phone) where phone is not null`. (`contacts_org_email_unique (org_id, lower(email))` already exists from 0007.)

- [ ] **Step 1: Write the migration.** In order: (a) `update contacts set phone = <normalised>` using SQL mirroring `normalizePhone` (`regexp_replace(phone, '[^0-9+]', '', 'g')`, then the 10/11-digit rules with `case`), and `email = lower(trim(email))`; (b) dedupe by phone per org: for each group keep `min(created_at, id)`, re-point `conversations`, `consents`, `meetings`, `calls` `contact_id` to the keeper, fill the keeper's null `email`/`first_name`/`last_name`/`company`/`timezone` from the losers, delete losers; (c) create the unique index. Wrap in one transaction (migrations run in one by default).
- [ ] **Step 2: Mirror the index in Drizzle** (`uniqueIndex("contacts_org_phone_unique").on(t.orgId, t.phone).where(sql\`phone is not null\`)` and the existing email one if it is missing from the mirror).
- [ ] **Step 3: Dry-run** — `pnpm db:push:dev:dry` — Expected: "Would push these migrations: 0037_contact_identity.sql". Ask the user to run `pnpm db:push:dev`. Record in the ledger when applied; Task 3's DB tests need it.

### Task 3: `resolveContact` and `claimIdentity`

**Files:**
- Create: `packages/db/src/crm/resolve-contact.ts`
- Modify: `packages/db/src/index.ts`
- Test: `apps/app/tests/resolve-contact-db.test.ts`

**Interfaces:**
- Consumes: Task 1 normalisers; `recordAudit` from `../audit`; `withService`; schema tables `contacts`, `conversations`, `consents`, `meetings`, `calls`.
- Produces:
  ```ts
  export type ContactIdentity = { email?: string | null; phone?: string | null };
  export type ContactFields = { firstName?: string | null; lastName?: string | null; company?: string | null; timezone?: string | null; source?: string };
  export type Resolved = { id: string; merged: boolean };
  export async function resolveContact(orgId: string, identity: ContactIdentity, fields?: ContactFields): Promise<Resolved>;
  export async function claimIdentity(orgId: string, contactId: string, identity: ContactIdentity): Promise<Resolved>;
  /** exported for tests: the merge decision */
  export function keeperOf(a: { id: string; createdAt: Date }, b: { id: string; createdAt: Date }): "a" | "b";
  ```
  `resolveContact` with no email and no phone always inserts (chat visitors). Fields fill only nulls on an existing contact, except a `source: "form"` touch may overwrite `firstName`/`lastName`/`company` (today's form behaviour).

- [ ] **Step 1: Write the failing tests** (real DB; `describe.skipIf(!HAS_DB)`; fixture org inserted in `beforeAll`, deleted in `afterAll` — follow `tests/setup-declines-db.test.ts`):
  - `creates once and reuses by email, case-insensitively` — two calls with `Laith@X.com` / `laith@x.com` → same id, `merged: false`.
  - `reuses by normalised phone` — `613-884-1155` then `+16138841155` → same id.
  - `merges an email-only and a phone-only contact when one touch carries both` — insert A (email, older) and B (phone); give each a conversation and B a consent, a meeting and a call; `resolveContact(org, { email, phone })` → `{ id: A.id, merged: true }`; B is gone; all four of B's rows now carry `contact_id = A.id`; A has the phone; an `audit_log` row `contact.merged` with `target = B.id` exists.
  - `keeps the keeper's email when both have one` (Review Focus 2) — A (email `a@…`, older) and B (email `b@…`, phone `p`); `claimIdentity(org, B.id, { email: "a@…" })` → `{ id: A.id, merged: true }`; A.email stays `a@…`, A.phone becomes `p`, B is deleted and its conversation now points at A.
  - `claimIdentity on a fresh identity just sets it` — `claimIdentity(org, C.id, { phone })` → `{ id: C.id, merged: false }`.
  - `keeperOf prefers the older row` — pure.
- [ ] **Step 2: Run** — `npx vitest run tests/resolve-contact-db.test.ts` — Expected: FAIL, module not found.
- [ ] **Step 3: Implement.** One `withService` transaction: normalise; `select` candidates by `lower(email)` and by `phone` within the org (two rows at most); zero → insert; one → update nulls (and return); two distinct → `merge(tx, keeper, loser)`: four `update … set contact_id = keeper where contact_id = loser and org_id = orgId`, copy nulls, `update keeper set email/phone` (keeper keeps its own email when both have one), `delete loser`, `recordAudit({ orgId, action: "contact.merged", target: loser.id, meta: { into: keeper.id } })`. `claimIdentity` is the same with the current contact forced into the candidate set. On a `23505` from the insert race, re-run the select once.
- [ ] **Step 4: Run** — Expected: PASS. Then `npx vitest run` — Expected: all green.

### Task 4: Route every entry point through the resolver

**Files:**
- Modify: `apps/app/lib/leads/capture.ts:74-110`, `apps/app/app/api/webhooks/twilio/route.ts:77-91`, `apps/app/lib/voice/contact.ts` (contact part only; the thread part is Task 5), `apps/app/lib/contact-details.ts`, `apps/app/lib/voice/tools.ts` (save case + `VoiceToolContext.contactId` update), `apps/app/app/api/webhooks/vapi/route.ts` (dispatch loop writes back `ctx.contactId`), `apps/app/lib/qualifier/tools.ts:337-345` (same for `target.contactId`), `apps/app/lib/chat/service.ts` (no change: anonymous insert stays, via `resolveContact(orgId, {}, { source: "chat" })` for symmetry).
- Test: `apps/app/tests/contact-details-db.test.ts` (rewrite), `apps/app/tests/lead-form.test.ts` (unchanged, still green).

**Interfaces:**
- Consumes: Task 3.
- Produces: `saveContactDetails(orgId, contactId, details): Promise<{ saved: string[]; contactId: string }>` — `contactId` is the survivor after any merge; callers replace their context id with it.

- [ ] **Step 1: Rewrite `tests/contact-details-db.test.ts`**: the duplicate-email case now expects `{ saved: ["firstName","lastName","email"], contactId: <the form contact's id> }`, the caller row deleted, and the form contact carrying the caller's phone + name. Keep the "fresh email saves" case with the new return shape.
- [ ] **Step 2: Run** — Expected: FAIL (return shape / contact still present).
- [ ] **Step 3: Implement** `saveContactDetails` on top of `claimIdentity` (email → claim; then update name/company on the survivor). Voice: in `dispatchVoiceTool`'s save case return the text as before but also `ctx.contactId = result.contactId` (mutate the shared ctx object the route passes into the loop). Qualifier: `target.contactId = result.contactId`. Form, SMS, voice contact lookups → `resolveContact`. Delete the duplicate-skip branch added on 2026-11-02.
- [ ] **Step 4: Run** `npx vitest run` — Expected: green. `npx tsc --noEmit -p .` and `npx eslint lib app` — Expected: clean.
- [ ] **Step 5: Manual check** (user): submit the form with your email, then call from your phone and give the same email → one contact row (`select count(*) from contacts where email = …` = 1), both conversations on it.

## Slice 2 — calls

### Task 5: One conversation per call — `callThread`

**Files:**
- Modify: `apps/app/lib/voice/contact.ts` (replace `ensureVoiceContact`), `apps/app/app/api/webhooks/vapi/route.ts` (both call sites), `apps/app/lib/voice/process-call.ts` (`recordCall` updates the stub)
- Delete: `apps/app/tests/voice-contact-db.test.ts`
- Test: `apps/app/tests/call-thread-db.test.ts`

**Interfaces:**
- Consumes: Task 3 `resolveContact`.
- Produces: `callThread(orgId: string, callRef: string, phone: string | null): Promise<{ contactId: string | null; conversationId: string; callId: string }>`; `recordCall(data, recordingKey)` keeps its signature, returns `{ ok: true, duplicate: boolean, outcome?, recordingKey? }`.

- [ ] **Step 1: Write the failing tests** (DB): `callThread` twice with the same `callRef` → same conversation and call ids; a second `callRef` from the same phone → new conversation, same contact; `recordCall` for a stubbed call sets `ended_at`, `duration_sec`, `summary`, `outcome` on the SAME row (no second `calls` row) and returns `duplicate: false`; a second `recordCall` with the same data returns `duplicate: true`; `recordCall` for a `callRef` with no stub (Review Focus 4) creates contact + conversation + row.
- [ ] **Step 2: Run** — Expected: FAIL, `callThread` not exported.
- [ ] **Step 3: Implement.** `callThread`: select `calls` by `(orgId, providerRef)`; miss → `resolveContact(orgId, { phone }, { source: "voice" })` (null phone → no contact), insert conversation (`voice`, `new`), insert stub `calls` row `onConflictDoNothing`, re-select. `recordCall`: `callThread` first, then `update calls set … where id = callId and ended_at is null returning id` → empty = duplicate. Outcome logic unchanged. Keep the `take_message` message; stop inserting the `call:<id>:summary` message (Task 7 renders the call instead).
- [ ] **Step 4: Run** — Expected: PASS; whole suite green; typecheck clean.

### Task 6: Call summary — Vapi plan plus Claude fallback

**Files:**
- Modify: `apps/app/lib/voice/assistant.ts` (`analysisPlan`), `apps/app/lib/inngest/functions.ts:221-236` (summary step), `apps/app/lib/voice/process-call.ts` (accept a summary override)
- Create: `apps/app/lib/voice/summary-prompt.ts` (pure), `apps/app/lib/qualifier/summarize-call.ts`
- Test: `apps/app/tests/call-summary.test.ts`

**Interfaces:**
- Produces: `CALL_SUMMARY_PROMPT: string` (who called and from where; what they need; fit and why; outcome: booked / message taken / handed off / not a fit; next step for the team; 3–5 plain sentences, no headings) in `summary-prompt.ts`; `buildAssistantBody(...)` gains `analysisPlan: { summaryPlan: { enabled: true, messages: [{ role: "system", content: CALL_SUMMARY_PROMPT }] } }`; `summarizeCall(transcript: string): Promise<string | null>` in `lib/qualifier/summarize-call.ts` (model `claude-sonnet-5`, `max_tokens: 400`, returns null on any error); `processVoiceCall` adds `step.run("summarize", …)` only when `data.summary` is empty and `data.transcript` is present, and passes the result into `recordCall(data, recordingKey, summary)`.

- [ ] **Step 1: Write the failing test** (pure; import `buildAssistantBody` only if it has no `@/` imports — it does (`@/lib/contact-details`), so test `CALL_SUMMARY_PROMPT` content and a pure `summaryPlanFor()` helper exported from `summary-prompt.ts` that returns the `analysisPlan` object; assert `enabled: true` and that the system message is the prompt).
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement.** **Step 4: Run** — PASS; suite green.
- [ ] **Step 5: Manual** (user): re-save Phone calls, call, hang up → `calls.summary` filled within a minute.

### Task 7: Call card in the thread + recording playback

**Files:**
- Create: `apps/app/components/conversations/call-card.tsx`, `apps/app/app/(app)/conversations/[id]/recording-actions.ts`
- Modify: `apps/app/app/(app)/conversations/[id]/page.tsx` (load `calls` for the conversation; interleave by time), `apps/app/lib/ui/status.ts` (`CALL_OUTCOME: Record<CallOutcome, StatusView>`)

**Interfaces:**
- Produces: `CallCard({ call: { id, startedAt, durationSec, outcome, summary, transcript, hasRecording }, tz })`; server action `recordingUrl(callId: string): Promise<{ url: string } | { error: string }>` — `requireRole("admin")`, explicit org filter, `presignGetUrl(key, 600)`.
- Outcome labels: booked → "Booked" (success), handed_off → "Handed off" (warning), disqualified → "Not a fit" (muted), escalated → "Escalated" (warning), voicemail → "Voicemail" (muted), none → "No outcome" (muted). The card also says "Message taken" when a `call:<ref>:message` row exists for the call — read from the thread rows, not the card.

- [ ] **Step 1: Build the card** (no unit test — rendering; covered by manual QA): header row with `Phone` icon (lucide, 1.75), "Phone call", duration `"2 min 41 s"` via a small `fmtDuration(sec)` added to `lib/format.ts` (pure, add two assertions to an existing format test or a new `tests/format.test.ts`), outcome `Pill`, `fmtTime(startedAt)`; body summary (or "No summary"); footer: `Play recording` button (`useTransition`, calls `recordingUrl`, swaps for an `<audio controls>`; "Recording unavailable" on error) and a `<details>` "Transcript".
- [ ] **Step 2: Thread page**: add a `calls` query (explicit org filter), map messages and calls into one list sorted by `createdAt`/`startedAt`, render `CallCard` for call entries.
- [ ] **Step 3: Typecheck + eslint** — clean. **Step 4: Manual**: thread shows the card with summary; Play works for an admin; rep sees no Play button.

## Slice 3 — clients list

### Task 8: Migration 0038 — `last_activity_at` + trigger

**Files:**
- Create: `supabase/migrations/0038_client_activity.sql`
- Modify: `packages/db/src/schema/conversations.ts` (column + index mirror)
- Test: `apps/app/tests/client-activity-db.test.ts`

**Interfaces:**
- Produces: `contacts.last_activity_at timestamptz`, index `contacts_org_activity_idx (org_id, last_activity_at desc nulls last, id desc)`, function `app.touch_contact_activity()` + `after insert` triggers on `messages`, `conversations`, `calls` setting `last_activity_at = greatest(coalesce(last_activity_at, 'epoch'), new.created_at)` for the row's contact (messages via its conversation). Backfill from existing rows.

- [ ] **Step 1: Write the failing test** (DB): insert contact + conversation → `last_activity_at` equals the conversation's `created_at`; insert a message → bumps to the message's `created_at`; insert a `calls` row → bumps again.
- [ ] **Step 2: Dry-run + apply** (user runs `pnpm db:push:dev`). **Step 3: Run test** — PASS after apply.

### Task 9: Clients list query + page

**Files:**
- Create: `apps/app/lib/clients/queries.ts`
- Modify: `apps/app/app/(app)/conversations/page.tsx` (becomes the clients list)
- Test: `apps/app/tests/clients-query-db.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type ClientRow = { id: string; firstName: string | null; lastName: string | null; email: string | null; phone: string | null; company: string | null;
    channels: Channel[]; latestStatus: ConversationStatus | null; maxFit: number | null; openCount: number; lastActivityAt: Date | null; firstChannel: Channel | null };
  export async function clientsPage(tx: Tx, orgId: string, cursor: Cursor | null): Promise<ClientRow[]>; // PAGE_SIZE + 1 rows, keyset on (last_activity_at desc nulls last, id desc)
  export async function clientCount(tx: Tx, orgId: string): Promise<number>;
  ```
  Aggregates via lateral subqueries per contact (`array_agg(distinct channel)`, latest status by `updated_at desc`, `max(fit_score)`, `count(*) filter (where status in ('new','active'))`). `keysetWhere` works on `(at, id)`; `last_activity_at` is nullable, so order `nulls last` and treat a null cursor anchor as "after all non-null" (Review Focus 5 — a contact with no conversations lists last with `latestStatus: null`, `channels: []`).

- [ ] **Step 1: Write the failing test** (DB, `withService`, explicit `orgId`): three contacts — A with a form conversation (booked, fit 80) and an sms conversation (active, fit 40); B with one voice conversation (handed_off); C with none. Assert: order A, B, C (A's latest activity newest by inserting in that order), A has `channels` `["form","sms"]`, `latestStatus: "active"`, `maxFit: 80`, `openCount: 1`; C has `openCount: 0`, `latestStatus: null`; `clientCount` = 3.
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement** the queries; rewrite `page.tsx`: `getCurrentOrg()` → `withOrg((tx) => clientsPage(tx, org.id, cursor))`; columns Client (name + company), Channels (one `lucide` icon per channel with `aria-label` = `CHANNEL_LABEL`), Latest (`Pill`), Fit, Open (muted when 0), Last activity (`fmtShort`); header "N clients across your channels. Most recent first, 25 per page."; rows link to `/conversations/client/<id>`; empty copy "No clients yet. Submit your lead form to create one."; `Pager` as today.
- [ ] **Step 4: Run tests, typecheck, eslint** — clean.

### Task 10: Client page + thread links

**Files:**
- Create: `apps/app/app/(app)/conversations/client/[contactId]/page.tsx`, `apps/app/lib/clients/detail.ts`
- Modify: `apps/app/app/(app)/conversations/[id]/page.tsx` (name links to the client page; aside shows "N other conversations" → link)

**Interfaces:**
- Produces: `clientDetail(tx: Tx, orgId: string, contactId: string): Promise<{ contact: …; consents: Channel[]; suppressed: string | null; conversations: { id, channel, status, fitScore, createdAt, lastEntryAt, lastPreview: string | null, callDurationSec: number | null, callOutcome: string | null }[] } | null>` (conversations newest first, limit 100).

- [ ] **Step 1: Implement `clientDetail`** (DB test in `tests/clients-query-db.test.ts`: the fixture's A returns two conversations newest first with previews; unknown id → null).
- [ ] **Step 2: Page**: UUID guard → `notFound()`; `PageHeader` with the name; contact `Card` (`dl` like the thread aside + "Client since" + consent channels + suppression `Notice`); conversations `Table` (Channel, Status, Fit, Started, Last entry) linking to threads; "Showing the newest 100" footer when capped.
- [ ] **Step 3: Thread page**: `h1` becomes a `Link` to `/conversations/client/<contactId>` (`nav-back` transition); aside adds "N other conversations" (count query, explicit org filter) linking there. Back link at the top still says "Conversations".
- [ ] **Step 4: Typecheck, eslint, suite** — clean.

### Task 11: Docs

**Files:**
- Modify: `docs/manual-qa.md` (new section "Clients, identity, calls (Sprint 7.2)"), `apps/app/CLAUDE.md` (schema lines 0037–0038; "Contacts and clients" paragraph; voice section: `callThread`, summary plan, call card; replace the `ensureVoiceContact` mention), `plan.md` (Sprint 7.2 entry, Last updated date).

- [ ] **Step 1: QA checklist**: form + call same email → one client row, two conversations; chat visitor gives a known email → folded in, chat keeps working; two calls → two threads with call cards + summaries; Play recording (admin) / no button (rep); list order by last activity; client page; `0037`/`0038` applied; orphan Google events reminder.
- [ ] **Step 2: Update CLAUDE.md and plan.md.**

---

## Self-review notes

- Spec §1 → Tasks 1–4; §2 → Tasks 8–10; §3 → Tasks 5–7; errors/testing → in each task; rollout order kept (identity before list).
- Names used across tasks: `resolveContact`, `claimIdentity`, `Resolved`, `callThread`, `recordCall(data, recordingKey, summary?)`, `clientsPage`, `clientCount`, `clientDetail`, `CALL_OUTCOME`, `fmtDuration`.
- Review Focus 1–5 each has a named test in Tasks 1, 3, 4, 5, 9.
