-- GOLDEN ACCEPTANCE TEST — P0-02 (database safety invariants). Agents must not edit this file.
-- Installed by `pnpm acceptance:install P0-02`; runs with `supabase test db` for the whole life of the project,
-- so every future table and SECURITY DEFINER function is checked automatically.
begin;
create extension if not exists pgtap with schema extensions;
select plan(2);

select is(
  (select count(*)::int
     from pg_catalog.pg_class c
     join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r', 'p')
      and not c.relrowsecurity),
  0,
  'every table in schema public has row level security enabled'
);

select is(
  (select count(*)::int
     from pg_catalog.pg_proc p
     join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef
      and not exists (
        select 1
          from unnest(coalesce(p.proconfig, '{}'::text[])) as cfg
         where cfg like 'search_path=%'
      )),
  0,
  'every SECURITY DEFINER function in schema public pins search_path'
);

select * from finish();
rollback;
