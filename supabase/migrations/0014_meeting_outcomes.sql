-- ─────────────────────────────────────────────────────────────────────────
-- 0014 — Meeting outcomes.
--
-- `status` tracks the booking lifecycle (scheduled/rescheduled/cancelled);
-- `outcome` + `converted` are the post-meeting result a rep marks, feeding the
-- meeting-show-rate / opportunities KPIs (plan.md §11). Additive, tenant-scoped.
-- ─────────────────────────────────────────────────────────────────────────

create type public.meeting_outcome as enum ('pending', 'showed', 'no_show');

alter table public.meetings add column outcome public.meeting_outcome not null default 'pending';
alter table public.meetings add column converted boolean not null default false;
