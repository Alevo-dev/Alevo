-- 0037 contact identity: one contact per person and org.
--  (a) normalise stored emails (lower/trim) and phones (+ and digits; bare 10 digits → +1…,
--      11 digits starting with 1 → +…) to match packages/db/src/crm/identity.ts;
--  (b) merge contacts that now share a phone within an org (the oldest row keeps its id;
--      conversations, consents, meetings and calls move; empty fields fill from the losers);
--  (c) enforce it: unique (org_id, phone) where phone is not null.
--  (org_id, lower(email)) has been unique since 0007.

-- (a) normalise ---------------------------------------------------------------
update public.contacts
set email = nullif(lower(trim(email)), '')
where email is not null and email <> nullif(lower(trim(email)), '');

with cleaned as (
  select id,
         regexp_replace(phone, '[^0-9+]', '', 'g') as c,
         regexp_replace(phone, '[^0-9]', '', 'g')  as d
  from public.contacts
  where phone is not null
)
update public.contacts p
set phone = case
  when c.d = '' then null
  when left(c.c, 1) = '+' then '+' || c.d
  when length(c.d) = 10 then '+1' || c.d
  when length(c.d) = 11 and left(c.d, 1) = '1' then '+' || c.d
  else c.d
end
from cleaned c
where c.id = p.id;

-- (b) merge duplicates by phone ----------------------------------------------
create temp table contact_merge on commit drop as
select loser.id as loser_id, keeper.id as keeper_id
from public.contacts loser
join lateral (
  select k.id
  from public.contacts k
  where k.org_id = loser.org_id and k.phone = loser.phone
  order by k.created_at, k.id
  limit 1
) keeper on keeper.id <> loser.id
where loser.phone is not null;

update public.conversations x set contact_id = m.keeper_id from contact_merge m where x.contact_id = m.loser_id;
update public.consents      x set contact_id = m.keeper_id from contact_merge m where x.contact_id = m.loser_id;
update public.meetings      x set contact_id = m.keeper_id from contact_merge m where x.contact_id = m.loser_id;
update public.calls         x set contact_id = m.keeper_id from contact_merge m where x.contact_id = m.loser_id;

-- Fill the keeper's empty fields from its losers (newest loser wins per field).
-- A loser's email is dropped when the keeper already has one (unique per org).
update public.contacts k
set email      = coalesce(k.email, (select l.email from public.contacts l join contact_merge m on m.loser_id = l.id
                                    where m.keeper_id = k.id and l.email is not null
                                      and not exists (select 1 from public.contacts o where o.org_id = k.org_id and o.id <> k.id
                                                      and lower(o.email) = lower(l.email) and o.id not in (select loser_id from contact_merge))
                                    order by l.created_at desc limit 1)),
    first_name = coalesce(k.first_name, (select l.first_name from public.contacts l join contact_merge m on m.loser_id = l.id
                                         where m.keeper_id = k.id and l.first_name is not null order by l.created_at desc limit 1)),
    last_name  = coalesce(k.last_name,  (select l.last_name  from public.contacts l join contact_merge m on m.loser_id = l.id
                                         where m.keeper_id = k.id and l.last_name  is not null order by l.created_at desc limit 1)),
    company    = coalesce(k.company,    (select l.company    from public.contacts l join contact_merge m on m.loser_id = l.id
                                         where m.keeper_id = k.id and l.company    is not null order by l.created_at desc limit 1)),
    timezone   = coalesce(k.timezone,   (select l.timezone   from public.contacts l join contact_merge m on m.loser_id = l.id
                                         where m.keeper_id = k.id and l.timezone   is not null order by l.created_at desc limit 1)),
    updated_at = now()
where k.id in (select keeper_id from contact_merge);

-- The loser's own fields ride along so a wrong merge can be undone by hand.
insert into public.audit_log (org_id, actor_user_id, action, target, metadata)
select l.org_id, null, 'contact.merged', m.loser_id::text,
       jsonb_build_object('into', m.keeper_id, 'by', 'migration 0037',
         'loser', jsonb_build_object('email', l.email, 'phone', l.phone, 'firstName', l.first_name, 'lastName', l.last_name,
                                     'company', l.company, 'source', l.source, 'createdAt', l.created_at))
from contact_merge m join public.contacts l on l.id = m.loser_id;

delete from public.contacts where id in (select loser_id from contact_merge);

-- (c) enforce -------------------------------------------------------------------
create unique index contacts_org_phone_unique on public.contacts (org_id, phone) where phone is not null;
