# Job & API Security Setup

Four bearer tokens guard this app's server-side endpoints. This is how to
generate them, where each one goes, and the one step that is easy to miss on
Hostinger.

---

## 1. Generate the tokens

```bash
openssl rand -hex 32   # -> CRON_SECRET
openssl rand -hex 32   # -> ALERTS_API_KEY
openssl rand -hex 32   # -> REVALIDATION_SECRET
openssl rand -hex 32   # -> RETAILER_LINKS_API_KEY
```

Four separate commands, four different values. They are deliberately _not_ one
shared secret: each guards a different surface, and the cron secret in particular
ends up stored in a second place (step 3) that is easier to leak than the others.
Reusing one value means a single compromise unlocks all four.

All four endpoints **fail closed** — an unset token rejects every request, so
leaving a name empty means that route is disabled, not open. If you are not yet
using one, leaving it empty is the safe state.

---

## 2. Set them in Hostinger

hPanel → Node.js → **Environment**. All four are runtime-only, so they are read
at process start — **restart after changing any of them**.

| Variable                 | Guards                                                              | Consequence while unset                                                     |
| ------------------------ | ------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `CRON_SECRET`            | `POST /api/cron/product-discovery`, `/fetch-prices`, `/send-alerts` | Every scheduled run returns `401` — prices never refresh, alerts never send |
| `ALERTS_API_KEY`         | `POST /api/alerts`                                                  | Subscriber self-service lookups return `401`                                |
| `REVALIDATION_SECRET`    | `POST /api/revalidate`                                              | Cached pages never purge                                                    |
| `RETAILER_LINKS_API_KEY` | `POST /api/retailer-links`                                          | Admin retailer-link writes return `401`                                     |

Note that these are **two separate places for the cron token**, and the second
one is the one that actually matters on Hostinger:

- `CRON_SECRET` in the Environment section — what the **app** checks the request against.
- `cron_secret` in the database — what the **scheduler** sends.

The jobs are fired by Supabase `pg_cron`, which reads its credential from the
database, not from the host environment.

---

## 3. Store the cron secret in the database

The migration `packages/database/migrations/0001_cron_schedule.sql` reads its
settings from `public.cron_settings`. Apply the migration, then insert the two
rows:

```sql
insert into public.cron_settings (key, value) values
  ('site_url', 'https://thinkabell.click'),
  ('cron_secret', '<the value you chose for CRON_SECRET>')
on conflict (key) do update set value = excluded.value, updated_at = now();
```

**`cron_secret` must equal `CRON_SECRET`.** The route authorises the incoming
request against `CRON_SECRET`; if the two differ, every scheduled run returns
`401` and nothing discovers or sends. This mismatch is the most likely way for
the schedule to silently do nothing, and it is invisible until you check.

Then run the scheduler:

```sql
select public.schedule_thinkabell_crons();
```

Expect a `NOTICE` naming the three jobs. If a settings row is missing the
function raises a `NOTICE` and schedules **nothing** — a half-configured
deployment stays inert rather than calling the endpoints unauthenticated.

RLS restricts `cron_settings` to the service role, so the anon key cannot read
the secret from the browser.

---

## 4. Verify

```bash
# 1. The endpoint rejects a missing or wrong token (401, not 500)
curl -i -X POST https://thinkabell.click/api/cron/fetch-prices

# 2. And accepts the right one
curl -i -X POST https://thinkabell.click/api/cron/fetch-prices \
  -H "Authorization: Bearer <CRON_SECRET>"

# 3. Confirm the row matches what the app expects — redacted, so no secret is
#    printed. Both must show the same length and last 4 characters.
curl -s https://thinkabell.click/api/health
```

A `200` from step 2 means the app, the database row, and the schedule all agree.
`401` after that means `cron_secret` and `CRON_SECRET` have drifted apart.

The `/api/cron/*` routes are also per-IP rate limited (10 requests / 60s), so
hammering them during testing will start returning `429`.

---

## Rotating any of the four

Because the cron token lives in two places, rotating it is a two-step change and
doing only one half breaks the schedule:

1. Update `CRON_SECRET` in Hostinger → Environment, then **restart**.
2. Update the database row:
   ```sql
   update public.cron_settings set value = '<new value>', updated_at = now()
   where key = 'cron_secret';
   ```
3. Re-run `select public.schedule_thinkabell_crons();` — it unschedules and
   recreates the jobs, so they pick up the new value.

The other three tokens are single-place: update the variable and restart.

---

## If you deploy to Vercel instead

**`vercel.json` has been removed, deliberately.** It declared the three cron jobs
against routes that only handle `POST`, while Vercel Cron invokes them with `GET`
— so on Vercel all three would have returned `405` while appearing scheduled,
which is the same "configured but inert" failure this guide exists to prevent.
Adding a `GET` handler is not the fix: accepting state-changing work through a
`GET` invites browser preload and accidental triggering.

The schedule lives in `packages/database/migrations/0001_cron_schedule.sql`,
where the sender controls the method. If you do deploy to Vercel, either add a
`GET` handler that verifies Vercel's own cron caller rather than a bearer token,
or move the schedule to `pg_cron` as on Hostinger — not both.

---

## Checklist

- [ ] Four values generated, all different (`openssl rand -hex 32` × 4)
- [ ] All four set in Hostinger → Environment, app restarted
- [ ] `pnpm db:apply` run (creates `cron_settings`)
- [ ] `site_url` and `cron_secret` rows inserted, `cron_secret` == `CRON_SECRET`
- [ ] `select public.schedule_thinkabell_crons();` run, `NOTICE` confirmed
- [ ] `POST /api/cron/fetch-prices` returns `200` with the bearer token
- [ ] `/api/health` reports `credentials: "ok"`
