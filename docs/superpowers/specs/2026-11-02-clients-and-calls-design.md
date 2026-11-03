# Clients, one contact per person, one conversation per call — design

**Date:** 2026-11-02 · **Status:** approved in conversation, spec for review · **Sprint:** 7.2

## Intent

What the user asked for, in their words:

- "The conversations need to be organized by client. If the clients share the same email or number they should go in one list."
- "If there is a new call for the same client it should be a different conversation, not continue an existing one."
- "Once a call [ends] it should also show a summary of the call."

Decisions taken in conversation (2026-11-02):

- **Identity:** one contact per client, merged at write time (option A). Not read-time grouping, not a separate clients table.
- **List:** `/conversations` becomes a clients list, one row per contact, with a client page beneath it (option 1).
- **Calls:** every call is its own conversation; the summary comes from Vapi with our prompt and falls back to our own; the thread shows a call card.
- **Trust the match:** when the agent hears an email or number on a call or in chat that already belongs to a contact, merge without asking a person. The agent heard it from the client directly.

Assumptions (correct me):

- "Client" means the person (the contact row), not their company. Two people at the same company stay separate.
- Phone numbers are matched after normalisation to E.164. A 10-digit number with no country code is North American (`+1`). The org's country becomes a setting later if needed.
- Emails are matched case-insensitively after trimming.
- A merge keeps the OLDER contact (its id stays in links, PSA records and audit rows) and moves everything from the newer one onto it.

## 1. One contact per client

### Today

| Entry point | Match by | Creates |
|---|---|---|
| Hosted / embedded form (`lib/leads/capture.ts`) | lower(email) | contact with email + phone + name |
| SMS webhook (`api/webhooks/twilio`) | phone | phone-only contact |
| Voice (`lib/voice/contact.ts`) | phone | phone-only contact |
| Chat (`lib/chat/service.ts`) | nothing | anonymous contact every visit |
| Agent tool `save_contact_details` (`lib/contact-details.ts`) | — | writes email/name/company onto the CURRENT contact |

Email-matched and phone-matched contacts never meet. A chat visitor or a caller who gives an email the org already has becomes a second contact.

### Change

One resolver in `@alevo/db`, `packages/db/src/crm/resolve-contact.ts`, used by every entry point:

```ts
export type ContactIdentity = { email?: string | null; phone?: string | null };
export type ContactFields = { firstName?: string | null; lastName?: string | null; company?: string | null; timezone?: string | null; source?: string };

/** Find the org's contact for this identity, merging duplicates, or create one. Service path. */
export async function resolveContact(orgId: string, identity: ContactIdentity, fields?: ContactFields): Promise<{ id: string; merged: boolean }>;

/** Attach a learned identity to an existing contact; if another contact already owns it, merge the two. */
export async function claimIdentity(orgId: string, contactId: string, identity: ContactIdentity): Promise<{ id: string; merged: boolean }>;
```

Behaviour (one transaction):

1. Normalise: `normalizeEmail` (trim, lower) and `normalizePhone` (keep `+` and digits; 10 digits → `+1…`; 11 digits starting with 1 → `+…`; anything else unchanged). Both pure, in `packages/db/src/crm/identity.ts`, tested.
2. Look up by email and by phone separately within the org.
3. Zero matches → insert. One match → update missing fields only (never overwrite a known name with null; a form submission may overwrite a name it supplies, as today). Two different matches → **merge**: keep the older, move every FK (`conversations`, `consents`, `meetings`, `calls` — the four tables with `contact_id`), copy missing fields onto the keeper, delete the loser, write an audit row `contact.merged` with both ids.
4. `claimIdentity` is step 3 with the current contact as one of the candidates. Used by `save_contact_details` (voice + chat + Qualifier) when the agent learns an email or a number.

Entry-point changes: form, SMS, voice and chat call `resolveContact`; chat passes no identity and so always creates (as today) until the agent learns something and `claimIdentity` folds it in. The voice tool context carries `contactId` for one webhook request only; the next request resolves by phone again and lands on the merged contact. Chat sessions point at the conversation, which now points at the keeper.

Enforcement in the database (migration `0037_contact_identity.sql`; 0033–0036 are taken by the brand/chat work):

- Backfill: normalise existing emails and phones in place; merge existing duplicates with the same rule (older keeps), in SQL.
- Partial unique indexes: `contacts (org_id, lower(email)) where email is not null` and `contacts (org_id, phone) where phone is not null`.
- A race between two webhooks inserting the same identity hits the index; `resolveContact` retries the lookup once on unique violation.

Not built: several emails or phones per person, a manual merge or un-merge screen, company-level grouping.

## 2. Clients list and client page

### List: `/conversations`

Nav label stays "Conversations" (sidebar and mobile menu). The page shows one row per contact in the org, sorted by most recent activity:

| Column | Source |
|---|---|
| Client | `displayName` (name, else email, else phone, else "Website visitor" style anonymous label) + company beneath |
| Channels | one small icon per distinct channel the client has used |
| Latest | status pill of the most recently active conversation |
| Fit | highest fit score across their conversations |
| Open | count of conversations not in a terminal status, muted when 0 |
| Last activity | relative time |

Header: "N clients across your channels. Most recent first, 25 per page." Pagination stays keyset over `(contacts.last_activity_at desc, contacts.id desc)` with the existing `Pager`.

`contacts.last_activity_at timestamptz` (migration `0038_client_activity.sql`) is kept current by one trigger: after insert on `messages`, `conversations` and `calls`, set the contact's `last_activity_at = greatest(current, new.created_at)`. Backfilled from existing rows. No app code touches it. Index `contacts (org_id, last_activity_at desc, id desc)`.

The per-row aggregates (channels, latest status, max fit, open count) come from one query with lateral subqueries over the page's 25 contacts, not from stored columns.

### Client page: `/conversations/client/[contactId]`

- **Contact card**: name, company, email, phone, source, consent channels on file, suppression notice if unsubscribed, "Client since" date.
- **Conversations**: newest first. Each row: channel, status pill, fit, started, last entry preview, link to the thread. Calls show duration and outcome. No pagination (a person rarely has more than a dozen); capped at 100 with a "showing the newest 100" note.
- Platform admins: the query filters by `app.current_org_id()` explicitly, as every current-org read does.

### Thread page: `/conversations/[id]`

Unchanged URL and layout. Two additions: the contact name links to the client page, and the sidebar card shows "N other conversations" linking there.

Deferred: search and filters on the list, company grouping, assigning clients.

## 3. Calls

### One conversation per call

Today `ensureVoiceContact(orgId, phone)` finds the caller's open voice conversation and reuses it, so a second call appends to the first call's thread (the 6:01pm and 6:02pm calls on 2026-11-02 shared one).

Change: `lib/voice/contact.ts` becomes `callThread(orgId, callRef, phone)`:

1. `select` from `calls` by `(org_id, provider_ref = callRef)`. Found → return its `contactId` and `conversationId`.
2. Not found → `resolveContact(orgId, { phone }, { source: "voice" })`, insert a `conversations` row (`voice`, `new`), insert a `calls` **stub** (`provider_ref`, `contact_id`, `conversation_id`, `from_number`, `started_at = now()`), `on conflict (org_id, provider_ref) do nothing`, then re-select (a parallel tool call may have won).

Every webhook message for the call (`tool-calls`, `end-of-call-report`) resolves through it, so one call is one thread and the next call is a new one regardless of status. `recordCall` (`lib/voice/process-call.ts`) updates the stub with the end fields instead of inserting; `ended_at is not null` already set means a duplicate report and nothing is metered or alerted again. A call with zero tool calls (caller hung up on the greeting) is created at end-of-call by the same function.

`ensureVoiceContact` and its test (`tests/voice-contact-db.test.ts`) are replaced by `callThread` and its test; the SMS webhook keeps its own "latest open thread" rule (a text reply belongs in the thread a person may be working).

### Summary

Vapi produced a summary for the per-call assistant on 2026-11-02 (the saved assistant did not). Make it deliberate: `buildAssistantBody` sets `analysisPlan.summaryPlan` with our prompt — who called and from where, what they need, fit and why, outcome (booked / message / hand-off / not a fit), next step for the team. Three to five sentences, plain, no headings.

Fallback: in `process-voice-call`, when `summary` is empty and a transcript exists, generate one with Claude (`lib/qualifier/summarize-call.ts`, the only place Anthropic code lives) as its own Inngest step. Model `claude-sonnet-5`, same prompt. If that also fails, the card reads "No summary".

### Call card in the thread

The thread renders `messages` and `calls` interleaved by time. A call is a card, not a message:

- Header: phone icon, "Phone call", duration ("2 min 41 s"), outcome pill (Booked / Message taken / Handed off / Not a fit / No outcome), start time.
- Body: the summary.
- Footer: "Play recording" (presigned R2 GET from a server action, 10-minute URL, admin and owner only) and a "Transcript" disclosure with the raw transcript.

`recordCall` stops inserting the `call:<id>:summary` message; the `take_message` message stays (it is what the caller asked for). Existing summary messages are left as they are.

### Also in this slice

- The two "keep calls going" rules already shipped on 2026-11-02 stay: Save re-detaches the assistant from the Vapi number; a hand-off is terminal for the (now removed) reuse rule.

## Data flow summary

```
form / sms / voice / chat ──▶ resolveContact ──▶ contacts (unique email, unique phone)
agent learns email/phone  ──▶ claimIdentity  ──▶ merge if another contact owns it
messages / conversations / calls insert ──▶ trigger ──▶ contacts.last_activity_at
Vapi tool-calls / end-of-call ──▶ callThread(callRef) ──▶ one conversation + one calls row per call
end-of-call ──▶ recordCall (update stub) ──▶ summary (Vapi, else Claude) ──▶ call card
```

## Errors

- Merge failures roll back the transaction; the entry point then retries the lookup once and otherwise fails as it does today (the webhook returns 500 and the provider retries; the form shows the generic error).
- A unique violation on insert (race) is caught and resolved by re-reading.
- Summary generation is best-effort; a failure never loses the call row.
- Recording playback with a missing object shows "Recording unavailable" in place of the button.

## Testing

- Pure: `normalizeEmail`, `normalizePhone`, merge-direction rule (older keeps), summary prompt builder.
- DB (real Postgres, skipped without `DATABASE_URL`): `resolveContact` creates once and reuses; a phone-only contact and an email-only contact merge when one touch carries both, moving conversations, consents, meetings and calls; `claimIdentity` folds an anonymous chat contact into an existing one; the unique indexes reject a duplicate; `callThread` is idempotent per `callRef` and new per call; the trigger bumps `last_activity_at` on message, conversation and call inserts.
- Manual QA (added to `docs/manual-qa.md`): form then call from the same person → one client row, two conversations; chat visitor gives a known email → folded in; two calls → two threads with call cards and summaries; list ordering by last activity; client page; recording playback.

## Out of scope

Several identities per client, manual merge/un-merge, company grouping, list search and filters, SMS per-message threading changes, migrating old call-summary messages into cards.

## Rollout

Three slices, each shippable: (1) identity — migration 0037, resolver, entry points, tests; (2) calls — `callThread`, stub + update, summary plan + fallback, call card; (3) clients list + client page + thread links, with `last_activity_at` and its trigger (migration 0038). Slice order is chosen so the list is built on clean data.
