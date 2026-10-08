# Alevo — Build Plan

**Last updated:** 2026-10-05
**Status:** Active
**Related:** [`decisions/backend-and-workflows.md`](decisions/backend-and-workflows.md)

Alevo is a multi-tenant AI SDR platform for MSPs. Tagline: *More conversations. More leads.*
Starting from zero: nothing in the owner's partner deck or master plan is treated as built.

---

## 1. Product scope

Three layers, built in this order, after a shared multi-tenant platform:

| Layer | What it does | When |
|---|---|---|
| **0. Platform** | Tenancy, auth, roles, super admin, secrets, webhooks, storage, usage metering | First |
| **1. Inbound + email prospecting** | Capture → qualify → book → write back. Forms, chat widget, SMS, email, inbound voice, plus cold email prospecting (Apollo-sourced or CSV lists) that hands replies to the Qualifier. Enrichment later | MVP |
| **2. Outbound voice** | Consent-gated AI phone outreach to a US ICP, reusing the Layer 1 Qualifier to qualify and book | After inbound has a real consent pool |
| **3. Coaching** | AI call analysis for sales reps, with an analyzer persona | Last |

The **SDR engine is the project**. Coaching is explicitly not the core.

### Where Alevo wins

Priced at $1,500–5,000/mo, Alevo competes with **hiring a human SDR** (typically $5–8k/mo fully loaded), not with $199/mo AI receptionists. It wins on:
- **PSA-native write-back** (ConnectWise first, then HaloPSA)
- **MSP-specific qualification** (ICP, verticals, seat counts, existing-client vs new-business routing)
- **Speed-to-lead** that is measured and visible to the customer

---

## 2. Stack

| Concern | Choice | Notes |
|---|---|---|
| Web app | Next.js on Vercel | One codebase, one deploy |
| Database | Supabase (Postgres) + RLS + pgvector | Staging and prod projects; Supavisor transaction pooling from day one |
| Durable workflows | Inngest (in the Next.js deployment) | Cadences, waits, retries, `waitForEvent` |
| Auth | Clerk (free tier) | Orgs, invites, sessions, bot protection; default admin/member roles only |
| File storage | Cloudflare R2 | Presigned uploads; object keys in Postgres |
| SMS / numbers | Twilio | A2P 10DLC required for US SMS |
| Email (conversational) | Resend | Replies to people who contacted the MSP; never cold email |
| Lead sourcing | Apollo API | Search by the tenant's ICP, import verified contacts for prospecting; enrichment post-MVP |
| Email (cold prospecting) | Instantly or Smartlead via API (decision pending) | Per-tenant sending domains + mailboxes, warmup, sequences; replies webhooked into the Qualifier |
| Voice agent | Vapi (ElevenLabs voices via Vapi) | Inbound first; outbound later. Qualifier runs in Alevo as a custom LLM endpoint; Vapi sits behind the voice adapter. Own pipeline (Pipecat/LiveKit) only at scale, when vendor discounts run out |
| Booking | Cal.com API (default; MSPs without a tool are set up on it), Google/M365 basic direct, Calendly link mode | Direct adapters book during live calls. Alevo never rebuilds scheduling features; advanced needs → Cal.com |
| PSA | ConnectWise Manage first | Design partner's PSA. Adapter interface; HaloPSA/HubSpot as second implementations |
| LLM | Claude | Powers the Qualifier; smaller model for routing/classification steps |
| Notifications | Slack webhook per org | |
| Billing | Manual invoicing → Stripe | Stripe when self-serve signup or tier changes need it |

Rationale for Supabase/Inngest/Clerk over Convex, Trigger.dev, and Better Auth lives in the decision record.

---

## 3. Architecture rules (non-negotiable)

These go into `CLAUDE.md` in Sprint 1 so every coding session starts from the architecture.

1. **Tenancy at the database.** Every tenant table has `org_id` and an RLS policy. Every server query goes through a `withOrg()` helper. A test proves org A cannot read org B.
2. **Own the identity tables.** `users`, `organizations`, `memberships` are mirrored from Clerk via webhooks. All FKs, RLS, and reporting reference our IDs, never Clerk IDs. RLS resolves Clerk JWT claims to our IDs through `app.current_org_id()`, `app.current_user_id()`, `app.current_role()`, `app.is_platform_admin()`. Wrap calls as `(select app.fn())` so they run once per query.
3. **One auth module.** `getCurrentUser()`, `getCurrentOrg()`, `requireRole()`, `requirePlatformAdmin()`. Nothing else imports Clerk.
4. **App roles live in our database, not Clerk.** See Roles below.
5. **Never build a scheduler.** All timing (send → wait → nudge → timeout) is Inngest steps, sleeps, and `waitForEvent`. No hand-rolled cron state machines.
6. **Adapters for every vendor.** PSA, calendar, voice, SMS, email sit behind interfaces. A second PSA is a new implementation, not a rewrite.
7. **Verify every webhook.** Signature verification for Clerk, Twilio, Vapi, Resend, Stripe. Handlers are idempotent on the provider's event ID.
8. **Consent is data, not a checkbox.** Every touch records basis, channel, entity, verbatim text, timestamp, and revocation. Outbound dispatch checks it before any send or dial.
9. **Heavy AI work runs as Inngest steps in Next.js functions**, not Supabase Edge Functions (2s CPU cap).
10. **Concurrency discipline.**
    - Never wait inside a step: start the slow thing, then `waitForEvent` on its webhook.
    - Inbound reply functions get high `priority`; outbound, coaching, and KB ingestion each get a global concurrency cap.
    - Every function has a per-tenant concurrency key (`event.data.orgId`).
    - Debounce inbound messages per conversation.
    - `throttle` every vendor-calling function to that vendor's rate limit.
    - Only make a step a step if it calls a vendor or needs independent retry; group pure DB writes.
11. **Usage is metered before it is spent.** Every billable action (conversation, voice minute, outbound dial) increments `usage_counters`; outbound checks remaining allowance before dispatch.
12. **Per-org secrets are encrypted** and never returned to the client.

### Roles (Option B: app roles in our DB)

Clerk stays on its two free default roles, used only for "can manage org membership." The real role lives in `memberships.role`.

| App role | Clerk role | Can |
|---|---|---|
| Super admin | — (not an org member) | Whole app; view and assist every org. `users.is_platform_admin` |
| Owner | `org:admin` | Everything, plus billing, delete org, transfer ownership |
| Admin | `org:admin` | Settings, integrations, ICP, KB, invite users |
| Rep | `org:member` | Work leads, conversations, meetings |
| Viewer | `org:member` | Read-only dashboard and conversations |

- Enum `app_role ('viewer','rep','admin','owner')`; `requireRole()` checks the hierarchy.
- Invites carry the intended role in Clerk invitation `publicMetadata`; the `organizationMembership.created` webhook writes it to `memberships.role`. Our table is canonical; reconcile on every membership webhook.
- MVP: reps see the same data as admins, restricted only on configuration. Per-rep lead visibility (`assigned_to` + RLS) when a tenant asks.
- Why: avoids Clerk's B2B add-on (~$100/mo) until there's a reason to pay, keeps roles portable if Clerk is replaced, and lets RLS read roles from Postgres directly.
- **Upgrade trigger:** Clerk free tier allows 20 members per org. Seats are not capped commercially; the first org over 20 is the point to buy the Clerk B2B add-on. Track member count per org in the super-admin view.

### Core data model (MVP)

`organizations`, `users`, `memberships`, `plans`, `org_subscriptions`, `usage_counters`, `org_secrets`, `contacts`, `conversations`, `messages`, `consents`, `meetings`, `calls`, `kb_documents`, `kb_chunks` (pgvector), `files` (R2 keys), `audit_log`.

---

## 4. MVP (232–286 hours)

Goal: one real MSP using it and paying, so the rest of the build is shaped by real usage. Everything the first tenant touches: **capture, prospect, respond, qualify, book, log, notify.**

Hours are keyboard time with Claude Code writing ~100% of the code. Roughly 15% directing, 25% reviewing, 40% running and debugging against live vendors, 20% accounts/env/deploys.

### Sprint 0 — Vendor setup and calendar-gated actions (3–5h, week 1)

No code. Every item starts a clock that the build later waits on, so all of it happens in week 1, alongside Sprint 1.

**Accounts**
- [x] Vercel, GitHub, Vapi, Inngest, Cloudflare, Twilio, Clerk, Supabase
- [x] Anthropic API (Claude)
- [x] Resend
- [x] Booking approach decided: connect the MSP's own booking system via API (no Cal.com account needed)
- [x] Instantly account opened
- [x] Instantly — confirmed the API supports a workspace/campaign per tenant, mailbox management, and reply webhooks (if not, Smartlead)
- [x] Apollo account opened
- [x] Apollo — confirmed the plan includes API access (people search + export) and the credit cost per exported contact
- [x] Every account is owned by the client's business entity and billing, with the builder as admin; shared credentials in a password-manager vault the owner controls
- [x] Spend alerts / caps on every usage-billed vendor (Twilio, Vapi, Anthropic, Inngest, Vercel)

**Calendar-gated (start the clock now)**
- [ ] Twilio A2P 10DLC: register Alevo's brand + a test campaign (2–6 weeks; gates SMS in Sprint 2)
- [x] Tenant SMS model: one Twilio subaccount per MSP, each with its own A2P brand + campaign via Twilio's ISV flow (each tenant's SMS goes live weeks after signup)
- [x] HaloPSA sandbox/developer access requested (post-MVP second PSA)
- [x] ConnectWise client ID obtained
- [x] ConnectWise: get API member keys on a Manage instance (sandbox, or the design partner's) — the client ID alone doesn't give API access; **gates Sprint 5**
- [ ] Google Cloud project + OAuth consent screen with Calendar scopes; submit for verification early (gates external tenants connecting Google)
- [ ] Microsoft Entra app registration (multi-tenant) with Calendars.ReadWrite; publisher verification
- [ ] Buy Alevo's own test sending domains + mailboxes, set SPF/DKIM/DMARC, start warmup (3–4 weeks; gates Sprint 7 testing)
- [x] Design-partner MSP lined up
- [x] Design partner's PSA: ConnectWise (built first)

**Project setup (no code)**
- [x] GitHub repo connected to Vercel
- [ ] Inngest Vercel integration
- [ ] Supabase: create staging + prod projects; choose region (data residency for Canadian MSPs)
- [ ] Clerk: create the application, enable Organizations
- [ ] Cloudflare: R2 bucket per environment + scoped API token
- [ ] App domain + DNS (e.g. `app.` subdomain on Alevo's domain)
- [ ] Internal Slack channel for alerts

### Sprint 1 — Platform foundation (22–27h)
- [ ] Next.js app, Supabase ×2 (staging, prod) with pooled connections, Vercel, Inngest
- [ ] Clerk: sign-up, sign-in, org creation, invites with role in `publicMetadata`
- [ ] Clerk webhooks → mirror `users`, `organizations`, `memberships` (incl. app role reconciliation)
- [ ] Auth module (`getCurrentUser`, `getCurrentOrg`, `requireRole`, `requirePlatformAdmin`)
- [ ] RLS helper functions + RLS on every table, `withOrg()`, cross-tenant isolation test
- [ ] Members screen: invite, change role, remove
- [ ] `is_platform_admin` + super-admin org switcher / assist view
- [ ] `plans`, `org_subscriptions`, `usage_counters` tables + seed the three tiers
- [ ] Encrypted per-org secrets store
- [ ] Webhook signature verification middleware
- [ ] R2 bucket + presigned upload route + `files` table
- [ ] Slack webhook per org
- [ ] `CLAUDE.md` with schema, rules 1–12, adapter interfaces

### Sprint 2 — Capture, conversation, Qualifier (35–45h)
- [ ] Tables: `contacts`, `conversations`, `messages`, `consents`, `kb_documents`, `kb_chunks`
- [ ] Hosted form per org + embeddable snippet → creates contact + conversation
- [ ] SMS (Twilio) and email (Resend): send, inbound webhook, STOP/unsubscribe, idempotent on `providerRef`
- [ ] KB ingestion: PDF/text/URL → R2 → chunk → embed
- [ ] **The Qualifier**: Claude agent with org ICP + KB context. Tools: `ask_question`, `check_availability`, `book_meeting`, `write_to_psa`, `escalate_to_human`, `record_consent`. Outputs 0–100 fit score + reasons. Ends in booked / disqualified / handed off
- [ ] Inngest flow per conversation: send → wait for reply or timeout → next action; cancelled on reply; contact-timezone send windows; priority + debounce per rule 10
- [ ] Conversation counted in `usage_counters`
- [ ] Conversation view (thread, score, status)

### Sprint 3 — Booking + consent (21–29h)

Rule: Alevo doesn't rebuild scheduling features. MSPs with no booking system are set up on Cal.com; Google/M365 users get basic booking, and if they later want round-robin or self-serve rescheduling, they move to Cal.com.

**Shared (6–8h)**
- [ ] Booking adapter interface (`slots`, `book`, `cancel`, `reschedule`, `handleWebhook`) + `meetings` table
- [ ] Qualifier `check_availability` / `book_meeting` tools call the org's adapter; booking confirmed back to the lead on the same channel
- [ ] Consent capture on every inbound touch (full record + revocation)
- [ ] Meeting outcome: showed / no-show / converted

**Cal.com adapter — direct booking via API v2 (6–8h)** — the default for MSPs without a booking system
- [ ] Connect: MSP pastes a Cal.com API key (encrypted per org) and picks the event type to book
- [ ] MSPs with no booking tool: onboarding walks them through creating a Cal.com account (their own, connected to their Google/M365 calendar), then connects it here
- [ ] `GET /v2/slots` for open times (Cal.com applies the MSP's own hours, buffers, notice, round-robin)
- [ ] `POST /v2/bookings` with attendee + `alevoConversationId` metadata; Cal.com sends invites, video link, confirmations
- [ ] Reschedule / cancel via the bookings endpoints
- [ ] Webhooks (`BOOKING_CREATED`, `BOOKING_RESCHEDULED`, `BOOKING_CANCELLED`) → update `meetings`, incl. bookings made outside Alevo

**Google Calendar + Microsoft 365 adapters — basic, single rep (7–10h)**
- [ ] OAuth for one booking calendar per org (Google Calendar API; Microsoft Graph `Calendars.ReadWrite`), tokens encrypted, refresh handled
- [ ] Free/busy (Google `freeBusy`, Graph `getSchedule`) → slots from simple rules: working hours, meeting length, timezone
- [ ] Create event with the lead as attendee + Meet/Teams link; the calendar invite is the confirmation
- [ ] Double-booking guard: re-check free/busy before inserting
- [ ] Changes: the lead replies on the conversation or to the invite; the Qualifier or a human handles it. No Alevo reschedule page
- [ ] Not built: round-robin, buffers/notice rules, self-serve reschedule pages — those come from Cal.com

**Calendly — link mode only (2–3h)**
- [ ] Qualifier sends the MSP's Calendly link; on voice, the agent says it will text the link and sends it after the call
- [ ] Meeting counted only when detected (Calendly `invitee.created` webhook on paid Calendly plans, or a connected Google/M365 calendar); otherwise marked "link sent"

### Sprint 4 — Inbound voice (25–35h)
- [ ] Per-org Twilio number provisioning
- [ ] Vapi assistant from org profile + KB, same Qualifier logic
- [ ] Recording-consent disclosure at call start
- [ ] Flow: greet → new business vs existing client → qualify → book on call or warm-transfer → voicemail fallback
- [ ] Post-call webhook: recording to R2, transcript stored, records updated, voice minutes metered, Slack alert
- [ ] Per-org after-hours behaviour

### Sprint 5 — PSA write-back, dashboard, notifications (20–25h)
- [ ] ConnectWise Manage adapter: upsert company + contact, log activity, create opportunity on booking
- [ ] Dashboard: leads in, qualified, meetings booked, missed calls recovered (weekly)
- [ ] Speed-to-lead: p50/p95 `first_reply_sent_at − lead_received_at`, shown to the tenant and alerted internally above ~60s
- [ ] Usage meter: conversations, voice minutes, outbound dials vs plan allowance
- [ ] Super-admin view: same numbers across all orgs
- [ ] Slack: qualified lead, meeting booked, escalation requested

### Sprint 6 — Onboarding wizard (15–20h)
- [ ] Company profile + brand basics
- [ ] ICP builder (verticals, size, geography, must-haves, disqualifiers)
- [ ] KB upload
- [ ] Number provisioning + call-forwarding instructions
- [ ] Booking connect: existing Cal.com (API key + event type), Google or Microsoft calendar (OAuth), or Calendly link; no booking tool → guided Cal.com setup, then connect; ConnectWise connect (company ID, site, public/private API keys)
- [ ] Chat widget: colours, greeting, install snippet
- [ ] Prospecting setup: buy/connect sending domains, DNS (SPF/DKIM/DMARC) instructions, start warmup at signup
- [ ] "Test it": test SMS and test call to the owner before go-live

### Sprint 7 — Chat widget, lead sourcing, email prospecting (55–70h)

**Chat widget (~10h)**
- [ ] Embeddable JS widget per org, served from the app; loads org branding
- [ ] Web chat as a channel in `conversations`/`messages`, driven by the same Qualifier and Inngest flow
- [ ] Captures name/email/phone mid-chat → contact + consent record; can hand off to SMS/email
- [ ] Counts as an inbound conversation for usage

**Email prospecting (~35–45h)**
- [ ] Sending-provider adapter (Instantly or Smartlead): create workspace/campaign per tenant, add leads, pause/resume
- [ ] Per-tenant sending domains + mailboxes; warmup status shown in the dashboard; sends blocked until warmup completes
- [ ] Prospect lists: CSV upload with column mapping, dedupe against existing contacts and suppression list

**Apollo lead sourcing (~10–15h)**
- [ ] Apollo adapter: people search mapped from the tenant's ICP (industry, company size, location, job titles)
- [ ] Search preview with result count before importing; owner picks how many to import
- [ ] Import verified-email contacts only, as prospects tagged with source `apollo`; dedupe against contacts, customers, and suppression list
- [ ] Canadian contacts excluded at import unless a CASL basis exists
- [ ] Sourced leads metered in `usage_counters`; import blocked past the tier allowance
- [ ] Sequences: 3–4 steps, Claude-personalised per prospect from org ICP + KB, with owner approval of templates
- [ ] Reply webhook → classify (interested / not now / unsubscribe / out-of-office / bounce) → interested replies open a conversation the Qualifier takes over
- [ ] Compliance: unsubscribe link + physical address in every email, global suppression list, one-click opt-out; CAN-SPAM for US recipients; **Canadian recipients blocked unless a CASL basis is recorded**
- [ ] Daily send caps per mailbox; prospecting emails metered in `usage_counters`
- [ ] Dashboard: sent, replies, interested, meetings booked from prospecting

### Hardening + first tenant (30–35h)
- [ ] Usage caps per §6: alert at 80%; inbound continues as overage, outbound stops at 100%
- [ ] Retries and error handling on every vendor call
- [ ] Staging → prod deploy pipeline
- [ ] Two weeks living with the first MSP, fixing what real calls break

### Explicitly out of MVP
Apollo/LinkedIn enrichment, outbound voice, HaloPSA, HubSpot, Stripe, white-label, A/B testing, analytics beyond the dashboard numbers, mobile app, multi-language, coaching.

Outbound voice is in every tier commercially but ships in Layer 2. Until then, early tenants get inbound + email prospecting, with outbound voice as part of the roadmap they're buying into.

---

## 5. Post-MVP (~245h; ~470–520h total)

| Item | Est. | Notes |
|---|---|---|
| Enrichment (Apollo / LinkedIn) | ~10h | Company data, tech stack, intent signals into Qualifier context for inbound leads and existing contacts (lead sourcing is already in the MVP) |
| Second PSA/CRM (HaloPSA or HubSpot) | ~35h | Second adapter implementation |
| Outbound AI voice | ~70h | Consent-gated dispatcher; dial only on valid consent; spoken "stop" revokes across channels; checks dial allowance before every call |
| Stripe billing | ~15h | Tiers, overage line items from `usage_counters` |
| Admin reporting expansion | TBD | Postgres views/materialized views; read-only role (future text-to-SQL) |
| Coaching (call analysis + analyzer persona) | ~60h | Reuses recordings/transcripts from Layers 1–2; low priority, capped concurrency, off-peak |
| Ongoing hardening | ~50h | As tenants grow |

---

## 6. Pricing & unit economics

**Draft — tier limits and overage rates are proposals to confirm with the owner.** Inbound and outbound are included in every tier; tiers differ by usage limits.

### Tiers

| | **Starter** | **Growth** | **Scale** |
|---|---|---|---|
| Price | $1,500/mo | $3,000/mo | $5,000/mo |
| Inbound conversations (SMS/email/form/chat) | 500 | 1,200 | 2,500 |
| Voice minutes (inbound + outbound, pooled) | 1,000 | 2,500 | 5,000 |
| Outbound dials | 1,000 | 3,000 | 7,500 |
| Sourced leads (Apollo) | 600 | 1,800 | 4,500 |
| Prospecting emails | 2,000 | 6,000 | 15,000 |
| Sending domains / mailboxes | 2 / 4 | 4 / 10 | 8 / 20 |
| Phone numbers | 1 | 3 | 5 |
| Seats | Unlimited | Unlimited | Unlimited |
| PSA integrations | 1 | 1 | 2 |
| Coaching (when shipped) | — | — | Included |

- A **conversation** is one lead thread, however many messages it takes.
- A **dial** is an attempt, answered or not; talk time draws from voice minutes.
- A **prospecting email** is one sequence step sent; replies that turn into Qualifier threads don't count as inbound conversations.
- Seats are not capped. Clerk's free tier allows 20 members per org; the first tenant to exceed that triggers Clerk's B2B add-on (~$100/mo), absorbed as a platform cost.

### What happens at the limit

| Usage | At 80% | At 100% |
|---|---|---|
| Inbound conversations | Alert owner + Slack | **Keep answering**; bill overage. Never drop an inbound lead |
| Voice minutes (inbound) | Alert | Keep answering; bill overage |
| Voice minutes (outbound) / outbound dials | Alert | **Pause outbound**; owner can approve overage or upgrade |
| Prospecting emails | Alert | **Pause sequences**; capacity is bound by mailboxes, so the fix is an upgrade, not overage |

Proposed overage: $1.50 per conversation, $0.40 per voice minute, $0.25 per dial.

### Cost per tenant (estimates; verify current vendor pricing)

Unit cost assumptions: voice ~$0.15/min all-in (Vapi + Twilio + model), ~$0.25 Claude per conversation, ~$0.02 per unanswered dial, ~$5–7/mo per mailbox + domains, ~$0.01 Claude per personalised email, Apollo credits per sourced lead (verify pricing; margins below exclude it), plus the sending platform's subscription (shared across tenants).

| Tier | Typical usage cost | At 100% of allowance | Gross margin at 100% |
|---|---|---|---|
| Starter | ~$130–180 | ~$345 | ~77% |
| Growth | ~$300–450 | ~$860 | ~71% |
| Scale | ~$600–900 | ~$1,830 | ~63% |

Platform costs (Inngest, Supabase, Clerk, R2, Vercel) are under ~$10/tenant at expected scale; the cold-email platform subscription (~$100–400/mo, verify) is shared. Outbound voice minutes are the cost that can move margins; overage pricing at ~2.5× unit cost keeps it safe.

### Platform cost runway

| Tenants | MRR | Inngest | Notes |
|---|---|---|---|
| 1–8 | $1.5k–40k | Free tier (50k exec) | Move to Pro at first live tenant for concurrency (Hobby = 5 slots) |
| ~10–150 | $15k–750k | Pro ~$99/mo | ~30–50 executions per lead |
| 1,000+ | $1.5M+ | Enterprise | DB connections and voice-vendor limits bind before Inngest |

---

## 7. Timeline (from a start of 2026-10-05)

Consistency matters more than the number: twelve steady hours beats fifteen erratic ones.

### At 10–15 h/week (current plan)

| Milestone | 10 h/wk | 12 h/wk | 15 h/wk |
|---|---|---|---|
| MVP built | 24–29 wks | 20–24 wks | 16–20 wks |
| First MSP live (incl. ~2 wks holidays) | Apr 2027 | Mar 2027 | Feb 2027 |
| Full product | ~Oct 2027 | ~Jul–Aug 2027 | ~Jun 2027 |

### At 40–50 h/week

MVP ~6 weeks, first tenant ~8 weeks, full build ~11 weeks. At this pace vendors become the bottleneck.

### Calendar-bound items that don't compress
- **A2P 10DLC**: 2–6 weeks from filing. Sprint 2 SMS depends on it.
- **ConnectWise API member keys** on a Manage instance: gates Sprint 5.
- **Google OAuth app verification**: calendar scopes are sensitive; Google's verification review can take weeks before external users can connect without warnings. Submit early.
- **HaloPSA sandbox**: post-MVP.
- **Email domain warmup**: 3–4 weeks before the first cold email, **per tenant**. Alevo's own test domains are bought in week 1; each tenant's domains start warming at onboarding, so their first cold email goes out 3–4 weeks after signup.
- **Design-partner MSP**: needs real inbound calls, plus two weeks of live use.
- **Outbound voice**: can be built early, cannot lawfully run until inbound has built a consent pool.

---

## 8. Risks

1. **TCPA on outbound AI voice.** $500–$1,500 per call, uncapped. AI voice needs prior express consent; FCC revocation rule (Jan 2027) makes a spoken "stop" binding across channels. *Mitigation:* consent-gated dispatcher built in from day one.
2. **Outbound promised, not yet shipped.** Every tier includes outbound, but it lands in Layer 2. *Mitigation:* early contracts state the outbound ship window; price early tenants accordingly or as design partners.
3. **Tenant inbound volume.** No leads, nothing to qualify. Qualify prospects on volume during sales.
4. **Scope.** One builder, three layers. Every addition trades directly against the first-tenant date.
5. **Recording consent.** One- vs two-party varies by state/province. Disclose at call start; MSP accepts responsibility for jurisdiction.
6. **Integration debugging doesn't compress.** Sprints 2 and 4 will run long.
7. **Cold-email deliverability.** A burned domain can't be recovered, and one tenant's bad list can hurt shared sending infrastructure. *Mitigation:* per-tenant domains (never the MSP's main domain), mailbox send caps, bounce/complaint thresholds that auto-pause a tenant, list verification before import.
8. **CASL.** Cold email to Canadian recipients generally needs consent or an exemption, with stiff penalties. *Mitigation:* block Canadian recipients unless a basis is recorded; US-only by default.
9. **Silent latency under load.** Concurrency limits queue work rather than fail it, so slow replies go unnoticed. *Mitigation:* rule 10 + the speed-to-lead metric.
10. **Outbound voice cost.** The one variable that can erode margin. *Mitigation:* metered before dispatch, hard pause at limit.

---

## 9. Open decisions

- [ ] Owner approves MVP scope and build order
- [ ] Owner confirms tier limits, overage rates, and the Growth price point (§6)
- [ ] Customer vs channel: pricing points to selling directly to MSPs; confirm white-label is out of scope for now
- [ ] Cold-email sending platform: Instantly (account opened) unless its API fails the per-tenant check; Smartlead as fallback
- [ ] Who buys and owns tenant sending domains: Alevo (resold) or the MSP
- [ ] Apollo account model: one Alevo account (credits resold in the tiers) vs each MSP connecting its own Apollo key
- [ ] Design-partner terms: discount or free period while outbound isn't live
- [ ] Confirmed weekly hours (sets every date above)

### Decided
- [x] Backend, workflows, auth, storage — see decision record
- [x] Roles: Option B (app roles in our DB on Clerk's free default roles), 2026-10-05
- [x] Pricing range: $1,500 base to $5,000 top; inbound + outbound in all tiers, differentiated by usage
- [x] Chat widget and email prospecting moved into the MVP, 2026-10-05
- [x] Booking: Cal.com API as default (MSPs without a tool set up on it); Google/M365 basic single-rep direct booking; Calendly link mode only; advanced scheduling needs → move to Cal.com, never built in Alevo, 2026-10-08
- [x] First PSA: ConnectWise (design partner's); HaloPSA post-MVP, 2026-10-08
- [x] SMS: one Twilio subaccount per MSP, 2026-10-08
- [x] Apollo lead sourcing moved into the MVP (Sprint 7); enrichment stays post-MVP, 2026-10-06
- [x] Voice: Vapi over ElevenLabs Agents for telephony controls and flexibility, 2026-10-05

## 10. Brand (reference)

- Palette: blue and purple
- Logo: owner's Gemini-generated square logo (A with rising arrow and bar chart, "Alevo" wordmark), used as-is
- Tagline: *More conversations. More leads.*
