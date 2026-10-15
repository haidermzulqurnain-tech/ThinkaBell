-- Scheduled job triggers for the cron endpoints in app/api/cron.
--
-- Hostinger does not run Vercel's crons array, so on this deployment
-- Poll over HTTP instead, from inside Supabase:
-- pg_cron fires on a schedule and pg_net makes the request, which keeps
-- the app server stateless and means the schedule survives a redeploy.
--
-- Nothing is hardcoded here. Both the site URL and the Bearer secret come
-- from public.cron_settings, which the operator fills in once. The schedule
-- is 5-field crontab, every 6 hours.
--
-- Requires the pg_cron and pg_net extensions (Supabase: Database →
-- Extensions). Enable them before applying this migration.

create extension if not exists pg_cron;
create extension if not exists pg_net;

create table if not exists public.cron_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

comment on table public.cron_settings is
  'Operator-supplied values consumed by the cron jobs: site_url, cron_secret.';

-- Reads a setting, or NULL when unset. SECURITY DEFINER so the jobs can read
-- it without granting table access to the scheduler role; the cron secret is
-- therefore never selectable by the anon or authenticated roles.
create or replace function public.cron_setting(p_key text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select value from public.cron_settings where key = p_key
$$;

revoke all on function public.cron_setting(text) from public;
revoke all on function public.cron_setting(text) from anon, authenticated;
grant execute on function public.cron_setting(text) to postgres;

alter table public.cron_settings enable row level security;

-- Drop any policy with our name before recreating, so this file is re-runnable.
-- Matches the schema.sql convention: TO service_role with USING (true) rather
-- than a predicate on auth.role().
drop policy if exists "Service role full access to cron settings" on public.cron_settings;
create policy "Service role full access to cron settings"
  on public.cron_settings
  for all
  to service_role
  using (true)
  with check (true);

-- The three endpoints, in the order they should run: discovery feeds the
-- catalogue, fetch-prices updates it, send-alerts notifies subscribers.
create or replace function public.schedule_thinkabell_crons()
returns void
language plpgsql
as $$
declare
  v_site_url text := public.cron_setting('site_url');
  v_secret text := public.cron_setting('cron_secret');
begin
  if v_site_url is null or v_secret is null then
    raise notice
      'cron_settings is missing "%" and/or "%" — insert both rows, then re-run this function.',
      'site_url', 'cron_secret';
    return;
  end if;

  -- Unschedule first: cron.schedule raises on a duplicate name, and this
  -- function is also how the schedule or secret gets refreshed.
  perform cron.unschedule(jobname)
  from cron.job
  where jobname in (
    'thinkabell-product-discovery',
    'thinkabell-fetch-prices',
    'thinkabell-send-alerts'
  );

  perform cron.schedule(
    'thinkabell-product-discovery',
    '0 */6 * * *',
    format(
      'select net.http_post(url := %L, headers := jsonb_build_object(''Content-Type'', ''application/json'', ''Authorization'', %L), body := ''{}''::jsonb)',
      rtrim(v_site_url, '/') || '/api/cron/product-discovery',
      'Bearer ' || v_secret
    )
  );

  perform cron.schedule(
    'thinkabell-fetch-prices',
    '0 */6 * * *',
    format(
      'select net.http_post(url := %L, headers := jsonb_build_object(''Content-Type'', ''application/json'', ''Authorization'', %L), body := ''{}''::jsonb)',
      rtrim(v_site_url, '/') || '/api/cron/fetch-prices',
      'Bearer ' || v_secret
    )
  );

  perform cron.schedule(
    'thinkabell-send-alerts',
    '0 */6 * * *',
    format(
      'select net.http_post(url := %L, headers := jsonb_build_object(''Content-Type'', ''application/json'', ''Authorization'', %L), body := ''{}''::jsonb)',
      rtrim(v_site_url, '/') || '/api/cron/send-alerts',
      'Bearer ' || v_secret
    )
  );

  raise notice 'Scheduled thinkabell-product-discovery, thinkabell-fetch-prices, thinkabell-send-alerts for %', v_site_url;
end $$;

revoke all on function public.schedule_thinkabell_crons() from public;
