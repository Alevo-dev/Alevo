# Admin provisioning + onboarding checklist — design

Date: 2026-11-02. Replaces the deferred "Sprint 6 — Onboarding wizard" in `plan.md`.

## Why

The first clients are set up by hand. Today that means the client creates the Clerk
organization themselves and a platform admin cannot see or touch the workspace unless
the client invites them. We want: a platform admin creates the workspace from the
console, invites the owner, configures the workspace in the product app as a flagged
support member, and both sides see one checklist of what is still missing. No
step-by-step wizard, no second copy of the settings forms in the console.

## Decisions already made

- **Option A**: configure in the app's existing Workspace pages, not in a console
  settings panel. OAuth connects and "Test connection" / "Send test" only work from the
  app, and the forms already exist once.
- **Support membership**: the admin's membership in a client org is flagged `support`.
  It stays after setup by default; the console offers "Leave workspace".
- **Checklist on both sides**: one readiness function feeds a Setup card in the console
  and a "Getting started" card on the client dashboard.
- **Calendar stays one per org.** Team round-robin is Cal.com's job (plan rule: no
  rebuilding scheduling).
- **Not in this build**: buying Twilio numbers from the app, sending domains / DNS,
  prospecting setup, a modal wizard.

## 1. Creating a workspace from the console

**UI.** Admin → Organizations gets a "New organization" button (top right of the page
header) opening a Dialog: Name, Owner email, Plan (Select, default Starter, listing
`plans.is_active`). One Create button; custom in-UI errors (`noValidate`, per-field).

**Server action** (`apps/admin/app/(admin)/organizations/actions.ts`, `requirePlatformAdmin`):

1. `createOrganizationForAdmin({ name, createdBy: adminClerkUserId })` in
   `packages/auth/src/org-admin.ts` → Clerk `organizations.createOrganization`. Clerk
   makes the creator an `org:admin` member automatically.
2. `inviteToOrg({ clerkOrgId, email, role: "owner", inviterUserId })` — a new
   explicit-org variant alongside `inviteToActiveOrg` (same body, org id passed in
   instead of read from the session). `publicMetadata.alevoRole = "owner"`,
   `redirectUrl = NEXT_PUBLIC_APP_URL/sign-up`.
3. Wait for the mirror: poll `organizations.clerk_id` for up to ~5 s (the webhook is
   usually sub-second). If the row exists, set the chosen plan directly on
   `org_subscriptions` (replacing the Starter trial seeded by `org/provisioned`, or
   inserting if provisioning has not run yet; `org/provisioned` must become an upsert
   that does not overwrite an existing subscription). If the row does not appear in
   time, return success with "Mirroring… refresh in a moment" and leave the plan on
   Starter; the admin can change the plan from the org page later.
4. Nothing to do for the support flag: `mirrorMembership` sets it from the user row
   (section 2) when the membership webhook lands.
5. `recordAudit({ orgId, actorUserId: admin, action: "org.created_by_admin", metadata: { ownerEmail, plan } })`
   and `"invitation.created"` for the owner invite.
6. `revalidatePath("/organizations")`, redirect to `/organizations/<id>`.

**Errors.** Clerk rejects a duplicate slug or a bad email → shown under the field.
Creation succeeded but the invite failed → the org exists; the dialog shows the invite
error and the org page's Members card has "Resend invite".

**Clerk limits to verify before building.** Backend org creation and members per org
on the current Clerk plan. The admin is one member in every client org, so the per-org
member allowance must cover client seats plus support members.

## 2. The support membership

**Schema** (migration 0030): `memberships.support boolean not null default false`,
index not needed. `users.is_platform_admin` is already there.

**Who sets the flag.** One rule: **any platform admin's membership in any org is
support.** `mirrorMembership` sets `support = true` when the member's user row has
`is_platform_admin = true`. Platform admins do not run client workspaces, so there is
no exception. The console's "Join as support" button (section 4) creates the membership via
`addMemberToOrg({ clerkOrgId, clerkUserId, role: "org:admin" })` in `org-admin.ts`; the
mirror flags it the same way.

**Role.** Support members hold app role `admin` (not `owner`): full configuration
rights, cannot delete the org or transfer ownership through the client UI. `resolveRole`
in `clerk-mirror.ts` keeps mapping the *creator* to `owner`, so creation must pass
through the flag check first: a support creator is `admin`, and the invited owner is the
first `owner`. Owner bootstrap for self-serve orgs is unchanged.

**What support changes.**
- `ownerEmails(orgId)` adds `and not memberships.support` → alert emails never go to
  Alevo staff.
- Seat counts (`memberCount` in `apps/admin/lib/orgs.ts`, the plan seat check in
  members actions) exclude support rows.
- Members tab (`components/workspace/organization-dialog.tsx`): support rows render as
  "Alevo support" with a muted pill, no role select, no Remove button. Members actions
  reject `setRole` / `remove` on a support membership server-side
  (`ForbiddenError`).
- `leaveActiveOrg` remains available to the support member themselves (console "Leave
  workspace" calls the explicit-org variant `leaveOrg(clerkOrgId)`).
- RLS: unchanged. Platform admins already read every org; the membership only gives
  them an *active* org in Clerk so the Workspace pages act on the right tenant.

## 3. Readiness facts, one source

`packages/db/src/onboarding/readiness.ts` (pure) and `load-readiness.ts` (queries),
exported from `@alevo/db` so both apps import the same code. `ownerEmails` moves next
to them (`packages/db/src/onboarding/owner-emails.ts`); the app re-exports it from
`apps/app/lib/notifications/owner-emails.ts` so callers do not change.

```ts
export type ReadinessItem = {
  key: "owner" | "profile" | "knowledge" | "booking" | "phone" | "slack" | "alerts" | "agent" | "proven";
  label: string;        // "Business profile"
  done: boolean;
  detail: string;       // what is missing, or what is set
  href: string;         // app path that fixes it
};
export function readiness(facts: ReadinessFacts): ReadinessItem[];
export function isReady(items: ReadinessItem[]): boolean;
export async function loadReadinessFacts(orgId: string): Promise<ReadinessFacts>; // withService, explicit org filter
```

`ReadinessFacts` is plain data so the function is unit-testable (Vitest, relative
imports):

| key | done when | href |
|---|---|---|
| owner | an `org_invitations` row with role owner is `accepted`, or a non-support `owner` membership exists | `/workspace/profile` (Manage → Members) |
| profile | `company_name`, `offering`, `ideal_customer` all non-empty | `/workspace/profile` |
| knowledge | at least one `kb_documents` row with status ready | `/workspace/knowledge` |
| booking | `booking_tool` set and that tool configured (Cal.com key + event type / `calendar_provider` + `calendar_id` / `calendly_url`), **or** `booking_tool` null and `booking_declined` true | `/workspace/integrations` |
| phone | `sms_from_number` set, **or** `phone_declined` true | `/workspace/integrations` |
| slack | `slack_webhook_url` secret present and `slack_verified_at` set | `/workspace/integrations` |
| alerts | `email_alerts` true and `ownerEmails(orgId)` non-empty | `/workspace/agent` |
| agent | `org_profiles.enabled` | `/workspace/agent` |
| proven | at least one conversation with `first_reply_sent_at` not null | `/conversations` |

**Declines.** Migration 0030 also adds `org_profiles.booking_declined boolean default
false` and `phone_declined boolean default false`. The checklist line for booking /
phone has a "Not using this" link (both cards) that flips the flag through a server
action; connecting the tool later clears it. This is the only new client-facing control.

`loadReadinessFacts` runs its queries in one `Promise.all` over `withService`, every
query filtered on the given `orgId` (platform admins bypass RLS, so the filter is
explicit). "Knowledge" counts `kb_documents` rows with `status = 'ready'`.

## 4. Console org page

Route `apps/admin/app/(admin)/organizations/[id]/page.tsx` (rows in `OrgsTable` become
links). Reads via `withService`, gated by the `(admin)` layout.

Cards, top to bottom:
- **Header**: name, plan pill, subscription status, agent on/off dot, created date.
  Actions: "Open in app" (section 4, deep link), "Join as support" when the signed-in
  admin has no membership here, "Leave workspace" when they do (ConfirmSubmit).
- **Setup**: the readiness list. Each line: dot (done / missing), label, detail, and an
  "Open" link to the app page. Header shows "N of 9 done" and turns to "Ready" when
  complete. Below the list: "Resend owner invite" while the owner item is open.
- **Members**: name, email, role, support pill; pending invitations with status.
- **Plan**: current plan with a Select to change it (writes `org_subscriptions`,
  audit `"plan.changed_by_admin"`).

**Deep links.** `APP_URL/admin/open?org=<clerkOrgId>&to=/workspace/integrations`.
Switching the active organization is a client-side Clerk call, so this is a page, not a
route handler: `apps/app/app/admin/open/page.tsx` checks server-side that the caller is
a platform admin with a membership in that org, then renders a small client component
that runs `setActive({ organization })` and `router.replace(to)`. Without membership
it redirects back to the console org page with "Join as support first". `to` must match
an allowlist of app paths (`/dashboard`, `/conversations`, `/workspace/*`).

## 5. Client-facing "Getting started" card

`apps/app/app/(app)/dashboard/getting-started.tsx`, rendered at the top of the dashboard
when `requireRole("admin")` passes (owners and admins; reps never see it) and
`isReady(items)` is false. The dashboard already loads the org; it adds
`loadReadinessFacts(orgId)` to its `Promise.all`. Lines link to the fixing page; the
booking and phone lines carry the "Not using this" link. The card disappears on its own
once every item is done. No dismiss button: the declines are the escape hatch.

Copy is first-person-plural and short ("Connect a booking tool so the agent can book
meetings, or tell us you're not using one."). Tone per the brand memory: human,
editorial.

## 6. Visibility and privacy

- Every console action writes `audit_log` with the admin as actor. Workspace edits made
  by a support member already write audit entries through the existing actions.
- **The client app has no activity view today.** Attribution as "Alevo support" is
  carried by `users.is_platform_admin` on the actor and will label those rows when a
  client activity page exists. For this build the client sees support through the
  Members tab ("Alevo support" row) and nothing else.
- The console never shows lead data (contacts, messages, call transcripts). The org
  page shows configuration and counts only.
- Per-org secrets stay encrypted and are never returned to either client.

## Error handling

- Clerk failures surface as per-field or form errors in the dialog; nothing is written
  to our DB before Clerk succeeds, so a failure leaves no half-created org.
- Webhook lag: the action polls briefly, then degrades to "refresh in a moment". The
  org page renders whatever has been mirrored so far; missing membership shows "Join as
  support".
- `org/provisioned` becomes idempotent against an existing subscription, so the order
  of webhook vs. admin plan write does not matter.
- Deep link to an org the admin is not a member of → back to the console with a toast.

## Testing

- Vitest: `readiness()` table-driven over the nine items, declines, and `isReady`;
  `resolveRole` with a support creator; `ownerEmails` excludes support (DB test next to
  `pagination-db.test.ts`).
- Manual QA (`docs/manual-qa.md`, new section "Admin provisioning + Getting started"):
  create an org from the console with your own second email as owner; confirm the
  pending invite, the support membership, the 9-line Setup card; accept the invite on
  the other account; configure the workspace via deep links; watch both cards go green;
  owner's Members tab shows "Alevo support" without Remove; Leave workspace; Join as
  support again.

## Files

New: `apps/admin/app/(admin)/organizations/actions.ts`, `organizations/new-org-dialog.tsx`,
`organizations/[id]/page.tsx` + `setup-card.tsx`, `apps/admin/lib/org-detail.ts`,
`apps/app/app/admin/open/page.tsx` + `open-org.tsx`,
`apps/app/app/(app)/dashboard/getting-started.tsx`,
`packages/db/src/onboarding/{readiness,load-readiness,owner-emails}.ts`,
`supabase/migrations/0030_support_membership.sql`.

Changed: `packages/auth/src/org-admin.ts` (explicit-org variants), `packages/db/src/schema/identity.ts`,
`org-profiles.ts`, `apps/app/lib/webhooks/clerk-mirror.ts`, `apps/app/lib/inngest/functions.ts`
(`org/provisioned` upsert), `apps/app/lib/notifications/owner-emails.ts` (re-export),
`components/workspace/organization-dialog.tsx` + members actions, `apps/admin/lib/orgs.ts`
(seat count), `apps/admin/components/orgs-table.tsx` (row links), `plan.md`, `docs/manual-qa.md`,
`apps/app/CLAUDE.md`.
