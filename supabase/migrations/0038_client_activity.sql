-- 0038 client activity: contacts.last_activity_at, kept current by the database so the
-- Conversations page can list clients by their most recent touch with a keyset cursor.
-- Bumped after insert on messages (via the conversation), conversations and calls.

-- Not null: a contact with no touch yet counts its creation as the activity, so the
-- keyset cursor never meets a null.
alter table public.contacts add column last_activity_at timestamptz not null default now();

create index contacts_org_activity_idx on public.contacts (org_id, last_activity_at desc, id desc);

create or replace function app.touch_contact_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_contact uuid;
  v_at timestamptz;
begin
  if tg_table_name = 'messages' then
    select contact_id into v_contact from public.conversations where id = new.conversation_id;
  else
    v_contact := new.contact_id;
  end if;
  if v_contact is null then
    return new;
  end if;
  v_at := coalesce(new.created_at, now());
  update public.contacts
  set last_activity_at = greatest(last_activity_at, v_at)
  where id = v_contact;
  return new;
end;
$$;

create trigger messages_touch_contact after insert on public.messages
  for each row execute function app.touch_contact_activity();
create trigger conversations_touch_contact after insert on public.conversations
  for each row execute function app.touch_contact_activity();
create trigger calls_touch_contact after insert on public.calls
  for each row execute function app.touch_contact_activity();

-- Backfill from what already happened.
update public.contacts c
set last_activity_at = greatest(
  (select max(created_at) from public.conversations x where x.contact_id = c.id),
  (select max(m.created_at) from public.messages m join public.conversations x on x.id = m.conversation_id where x.contact_id = c.id),
  (select max(created_at) from public.calls k where k.contact_id = c.id),
  c.created_at
);
