-- ─────────────────────────────────────────────────────────────────────────
-- 0016 — Direct calendar booking (Google Calendar + Microsoft 365).
--
-- An MSP connects ONE booking calendar over OAuth (tokens live encrypted in
-- org_secrets, not here). This records which provider is connected, which
-- calendar to book on, the account that authorized it, and simple booking
-- rules (meeting length + a daily working-hours window) the slot generator
-- uses — we deliberately don't rebuild round-robin / buffers / notice rules
-- (those come from Cal.com). Additive; the booking_provider enum already has
-- 'google' / 'm365' (migration 0013).
-- ─────────────────────────────────────────────────────────────────────────

alter table public.org_profiles
  add column calendar_provider      public.booking_provider,          -- 'google' | 'm365' when connected, else null
  add column calendar_id            text,                             -- the calendar to read free/busy + book on
  add column calendar_account_email text,                            -- the authorized account (display only)
  add column booking_length_min     integer not null default 30,      -- meeting length in minutes
  add column booking_hours_start    integer not null default 9,       -- earliest local hour offered (inclusive)
  add column booking_hours_end      integer not null default 17;      -- latest local hour offered (exclusive)
