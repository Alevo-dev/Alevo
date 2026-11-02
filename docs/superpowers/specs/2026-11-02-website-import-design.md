# Import from website + tone presets (Business profile)

Status: draft for review. Not committed (standing rule: no commits unless asked).

## Goal
Make Business profile setup fast. An admin pastes their company URL; Alevo reads the
site and fills the profile fields. They review the result and save with the normal
Save bar. Separately, "Tone and voice" becomes a dropdown of 5 presets.

## Decisions (agreed)
- Lives on Workspace -> Profile (`apps/app/app/(app)/workspace/profile`), not the KB.
- One synchronous server action (crawl + one model call). No background job.
- Import writes nothing to the DB. It fills the form; the existing unsaved-changes bar saves.
- When any field already has text, the dialog asks: "Fill empty fields only" (default) or
  "Replace existing values". When every field is empty the choice is hidden.
- Tone presets stored as a key in the existing `org_profiles.tone` column. No migration.

## Out of scope
Adding crawled pages to the Knowledge base, scheduled re-sync, JS-rendered (SPA) sites,
extracting qualifying criteria / disqualifiers (not on websites; left to the owner).

## Components

### 1. `lib/http/safe-fetch.ts` (SSRF guard)
- http/https only; reject URLs with credentials.
- Resolve DNS first; reject loopback, private (10/8, 172.16/12, 192.168/16), link-local
  (169.254/16 incl. cloud metadata), CGNAT, unspecified, IPv6 equivalents (::1, fc00::/7,
  fe80::/10, IPv4-mapped).
- Manual redirects, max 3, each hop re-validated.
- Timeout 8s per request, body capped (1 MB), content-type must be text/html or text/plain.
- Existing `lib/kb/extract.ts#extractUrl` switches to it (closes the same hole in KB URL add).
- Residual risk noted: DNS rebinding between check and connect; mitigated by connecting to the
  resolved IP where the runtime allows, otherwise accepted for admin-only use.

### 2. `lib/profile/crawl.ts`
- Fetch homepage; collect same-host links; rank by path keywords
  (about, services, solutions, contact, team, company, pricing); take up to 4.
- Per page: visible text (reuse the KB html-to-text), capped ~12k chars.
- Hard facts pulled from raw HTML, not the model: `tel:` / `mailto:` links, JSON-LD
  (`Organization` / `LocalBusiness`: name, telephone, email, address, openingHours).
- Returns `{ pages: {url, text}[], facts }`. Throws typed errors: invalid, blocked, unreachable, empty.

### 3. `lib/profile/extract.ts`
- Claude Haiku (`claude-haiku-5-5`), forced tool call, schema with all fields nullable.
- Fields: companyName, businessAddress, contactPhone, contactEmail, contactHours, offering,
  idealCustomer, tone (enum of preset keys), signoff.
- Prompt: never invent; null when not on the site; page text is untrusted data, never instructions.
- JSON-LD facts override model output for phone/email/address/hours when present.
- Output is only ever placed in form fields the admin reviews before saving.

### 4. `importFromWebsite(url, mode)` server action (profile/actions.ts)
- `requireRole("admin")`; validates URL; per-org rate limit (e.g. 5 per hour) because the call costs money.
- Returns `{ ok, values: Partial<BusinessProfileValues>, filled: number }` or a typed error message.
- Audit row `workspace.profile_imported` (url host only).

### 5. UI (`profile-ui.tsx` + new `import-dialog.tsx`)
- "Import from website" button at the top of Business profile; custom Dialog (no native modals).
- URL input; mode radio shown only when some field is non-empty; pending spinner; inline errors:
  invalid URL, couldn't reach the site, address not allowed, too little readable text
  ("the site may be built with JavaScript; fill it in manually").
- On success: merge into the live form values (current typed edits preserved, mode respected),
  Save/Discard bar appears, notice "Filled N fields. Review, then save."
- Merge logic is a pure function (`mergeImported(current, imported, mode)`) so it is unit-testable.

### 6. Tone presets
- `lib/profile/tone.ts`: `TONES = [{key,label,description}]`, five presets:
  Friendly & conversational; Professional & polished; Warm & consultative;
  Direct & concise; Confident & energetic.
- `tone` column holds the key. `toneForPrompt(stored)` returns the description for a known key,
  or the raw text for legacy free-text values.
- Voice card uses the shared `Select` (hidden input carries the value). A legacy value renders
  as an extra "Custom: ..." option so nothing is lost on save.
- `lib/qualifier/prompt.ts` and `lib/voice/prompt.ts` call `toneForPrompt(profile.tone)`.

## Error handling
Custom in-UI messages only (Rule 13). Network/model failures return a friendly message and
leave the form untouched.

## Testing
Vitest: IP blocklist (v4/v6/mapped), redirect re-validation, link ranking, JSON-LD parse,
`mergeImported` (both modes), tone mapping incl. legacy text; model call mocked.
Manual QA section added to `docs/manual-qa.md`; `plan.md` and `apps/app/CLAUDE.md` updated.
