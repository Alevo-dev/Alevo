-- ─────────────────────────────────────────────────────────────────────────
-- Dev-only: fake leads, replies, meetings and calls so the Dashboard and the
-- admin console have shape to check against. Paste into the DEV project's SQL
-- editor (or `psql "$DIRECT_URL" -f supabase/seed-dev-dashboard.sql`). Never run
-- on prod. Needs migration 0018 (calls).
--
-- For ONE workspace (set its id below): the last 90 days of inbound leads,
-- a few per day with more recently, every lead answered with a first reply
-- whose delay drifts — fast most days, slow on a few — so Speed to lead has a
-- line and the daily speed watch finds something. About a third are booked or
-- handed off, with a meeting per booking, plus a handful of answered calls.
-- Re-running adds another batch; the clean-up at the bottom removes the batch
-- (seeded contacts carry the source 'seed:dashboard').
-- ─────────────────────────────────────────────────────────────────────────

do $$
declare
  org   uuid := '00000000-0000-0000-0000-000000000000';  -- ← the workspace id (the lead-form link ends in it)
  d     int;
  k     int;
  per   int;
  c_id  uuid;
  cv_id uuid;
  recv  timestamptz;
  reply_s numeric;
  st    conversation_status;
  ch    channel;
begin
  if not exists (select 1 from public.organizations where id = org) then
    raise exception 'Set the workspace id at the top of this file first.';
  end if;

  for d in reverse 89..0 loop
    -- 1–2 leads/day three months ago rising to 3–6 this week.
    per := 1 + floor(random() * 2) + floor((89 - d) / 30.0);
    for k in 1..per loop
      recv := (now() - make_interval(days => d)) - (random() * interval '10 hours') - interval '4 hours';
      ch := (array['form','email','sms','voice','chat'])[1 + floor(random() * 5)]::channel;
      -- Median around 20s; roughly every 9th day the agent was slow (minutes).
      reply_s := case when d % 9 = 4 then 90 + random() * 400 else 6 + random() * 40 end;
      st := case
              when random() < 0.22 then 'booked'
              when random() < 0.15 then 'handed_off'
              when random() < 0.20 then 'disqualified'
              else 'active' end;

      insert into public.contacts (org_id, email, first_name, last_name, company, source, created_at, updated_at)
      values (org,
              'lead' || d || '-' || k || '@example-msp.test',
              (array['Ada','Grace','Linus','Maya','Noor','Omar','Priya','Sam'])[1 + floor(random() * 8)],
              (array['Lovelace','Hopper','Park','Okafor','Haddad','Nguyen','Singh','Reyes'])[1 + floor(random() * 8)],
              (array['Northwind Dental','Acme Logistics','Harbor Law','Blue Ridge Clinics','Summit CPA','Lakeside Realty'])[1 + floor(random() * 6)],
              'seed:dashboard', recv, recv)
      returning id into c_id;

      insert into public.conversations (org_id, contact_id, channel, status, fit_score, score_reasons,
                                        lead_received_at, first_reply_sent_at, created_at, updated_at)
      values (org, c_id, ch, st,
              case when st = 'disqualified' then 10 + floor(random() * 30) else 55 + floor(random() * 45) end,
              'Seeded for the dashboard check.',
              recv, recv + make_interval(secs => reply_s), recv, recv)
      returning id into cv_id;

      if st = 'booked' then
        insert into public.meetings (org_id, conversation_id, contact_id, provider, status, start_at, end_at, created_at, updated_at)
        values (org, cv_id, c_id, 'manual',
                case when random() < 0.1 then 'cancelled' else 'scheduled' end,
                recv + interval '2 days', recv + interval '2 days 30 minutes', recv + interval '5 minutes', recv + interval '5 minutes');
      end if;

      if ch = 'voice' then
        insert into public.calls (org_id, contact_id, conversation_id, provider_ref, from_number, duration_sec, outcome, started_at, ended_at, created_at)
        values (org, c_id, cv_id, 'seed-' || cv_id, '+15550100', 90 + floor(random() * 300),
                case when st = 'booked' then 'booked' when st = 'handed_off' then 'handed_off' else 'none' end,
                recv, recv + interval '3 minutes', recv);
      end if;
    end loop;
  end loop;
end $$;

-- What the dashboard should show for the last 7 days (compare by eye):
select
  count(*)                                                                   as leads,
  count(*) filter (where status in ('booked','handed_off'))                  as qualified,
  round(percentile_cont(0.5) within group
        (order by extract(epoch from first_reply_sent_at - lead_received_at))) as median_reply_s,
  round(percentile_cont(0.95) within group
        (order by extract(epoch from first_reply_sent_at - lead_received_at))) as p95_reply_s
from public.conversations
where created_at > now() - interval '7 days'
  and contact_id in (select id from public.contacts where source = 'seed:dashboard');

-- Clean up when done (cascades to conversations, meetings and calls):
-- delete from public.contacts where source = 'seed:dashboard';
