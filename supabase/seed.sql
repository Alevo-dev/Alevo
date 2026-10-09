-- Local/staging seed. Runs after migrations on `supabase db reset`.
--
-- Platform-admin bootstrap (plan.md fix): there is no UI that grants super-admin,
-- so promote the builder's mirrored user row here. The row only exists AFTER you
-- have signed in once (the Clerk webhook mirrors it), so this is written as an
-- idempotent UPDATE keyed by email — safe to re-run, a no-op until the row lands.
--
-- Replace the email below, or run the same statement by hand against staging/prod.

update public.users
set is_platform_admin = true
where email = 'laithalwani@gmail.com';
