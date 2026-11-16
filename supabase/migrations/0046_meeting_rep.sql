-- ─────────────────────────────────────────────────────────────────────────
-- 0046 — The rep who owns a meeting.
--
-- Meetings are booked by the agent, so a new row starts unassigned (null). An
-- admin / owner / rep assigns a member of the org on the Meetings page; the
-- "Booked by rep" donut counts per rep. If the user is deleted the meeting
-- goes back to Unassigned. The existing `meetings_tenant` policy is row-level
-- (org_id), so it already covers this column; no grant or policy change.
-- ─────────────────────────────────────────────────────────────────────────

alter table public.meetings
  add column rep_user_id uuid references public.users (id) on delete set null;

create index meetings_org_rep_idx on public.meetings (org_id, rep_user_id);
