-- 0024: indexes behind the paginated lists.
-- Pages are keyset over (sort column, id), newest first (packages/db/src/paginate.ts):
-- conversations and meetings per org, the audit log across orgs.

create index if not exists conversations_org_created_idx
  on public.conversations (org_id, created_at desc, id desc);

-- Meetings sort by start time, falling back to creation for ones not yet scheduled.
create index if not exists meetings_org_start_idx
  on public.meetings (org_id, (coalesce(start_at, created_at)) desc, id desc);

create index if not exists audit_log_created_id_idx
  on public.audit_log (created_at desc, id desc);
-- Covered by the composite above (same leading column).
drop index if exists public.audit_log_created_at_idx;
