# Sentry Setup

How to create the Sentry projects this app expects, and how to wire them in.

**Organisation:** `soloenterpreneurer` — copy the slug exactly from Sentry →
**Settings → Organization Settings → General → Organization Slug**. It is used
verbatim in the source-map upload, so a typo fails the build rather than being
corrected. (See the note on the spelling below.)

`@sentry/nextjs` v8 is the client used by `apps/web` (`apps/web/package.json`),
and it instruments both the browser and the Node server, so **one project
covers the whole app** — `apps/jobs` runs through the `/api/cron/*` route
handlers inside that same server, so it reports to the same project.

---

## 1. Create the project

Sentry → **Projects → Create Project**:

| Setting      | Value            | Why                                                                  |
| ------------ | ---------------- | -------------------------------------------------------------------- |
| Platform     | **Next.js**      | Matches `@sentry/nextjs`; the SDK reads the framework automatically. |
| Project slug | `thinkabell-web` | Lowercase letters, digits and hyphens. This is `SENTRY_PROJECT`.     |
| Name         | ThinkaBell Web   | Display name.                                                        |

Set the **alert rules** to `Alert me on every new issue` while outreach is
manual — volume is low enough that manual triage beats filtering.

---

## 2. Copy the DSN

Project → **Settings → Client Keys (DSN)**:

```
https://<publicKey>@o<org-number>.ingest.sentry.io/<projectId>
```

Projects created from Sentry's newer flow also show a **publishable/secret key
pair**. The DSN and the publishable key are _not_ the same value: the DSN is what
this app reads, so copy the DSN. Do not substitute `sb_publishable_…` — it is not
a DSN and will be rejected by validation.

---

## 3. Set the environment variables

### Hostinger → Node.js → Environment

| Variable                                | Value               | Notes                                             |
| --------------------------------------- | ------------------- | ------------------------------------------------- |
| `SENTRY_DSN`                            | the DSN from step 2 | Server-side. Empty = Sentry never initialises.    |
| `NEXT_PUBLIC_SENTRY_DSN`                | the same DSN        | **Build time** — inlined into the browser bundle. |
| `SENTRY_TRACES_SAMPLE_RATE`             | _(leave unset)_     | Optional; defaults to `0.1`.                      |
| `NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE` | _(leave unset)_     | Optional; defaults to `0.1`.                      |

Both DSNs are shape-validated, so a placeholder is rejected by name rather than
being sent to Sentry — which is what previously produced `Invalid Sentry Dsn` on
every boot.

### Build-time (only needed for source maps)

These three enable **source-map upload**, which turns minified stack frames into
original file and line numbers. Without them errors are reported with minified
frames only — functional, but much harder to diagnose.

| Variable            | Value                | Where                                                                                                                          |
| ------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `SENTRY_AUTH_TOKEN` | a Sentry auth token  | **Not on the host.** Build-time only — keep it in your build environment (CI secrets, or the local `.env` for a manual build). |
| `SENTRY_ORG`        | `soloenterpreneurer` | Sentry → Settings → Organization Settings → General.                                                                           |
| `SENTRY_PROJECT`    | `thinkabell-web`     | The project slug from step 1.                                                                                                  |

Create the token at **Settings → Auth Tokens → Create New Token** with scopes
`project:releases`, `project:write`, and `org:read`. **Never** put it in
`SENTRY_DSN` or commit it — and note it is _not_ needed at runtime, so Hostinger
does not need it.

`apps/web/next.config.js:59-63` reads all three through `withSentryConfig`, and
skips the upload silently when the token is absent — so a build without a token
still succeeds, it just ships minified frames.

---

## 4. What the "run code" is

Sentry's onboarding shows a short run code alongside the install command, e.g.

```
npx @sentry/wizard@latest -i nextjs <RUN_CODE>
```

It is a **one-time onboarding handoff** that pre-fills the org and project so the
wizard writes the config files. It is:

- **not** a credential to put in `.env` or in the app,
- **not** reusable — it expires after it is consumed or after a short window,
- **not** needed for this repository, because the config files are already
  committed (`instrumentation.ts`, `sentry.client.config.ts`, `next.config.js`).

Run it only if you want Sentry's wizard to regenerate those files locally, and
confirm the diff keeps the existing fail-closed behaviour. Afterwards the DSN and
token from this document are what actually matter.

---

## 5. Verify

### Server side

Trigger a real error and confirm it appears in the project:

```bash
# From apps/web, after setting SENTRY_DSN
pnpm --filter @thinkabell/web dev
# then visit a route that throws, or POST /api/contact with a bad payload
```

### Runtime log

The startup log reports the client connecting to a project — `[Database] Supabase
anon client connected to project "…"` is the database equivalent; for Sentry a
successful initialisation is silent by design, and an invalid DSN is the only
thing it reports.

### Health endpoint

`GET /api/health` reports Sentry's configuration in the `config` check:

- `config: "ok"` — both DSNs are valid or unset.
- `config: "rejected: SENTRY_DSN (invalid value: not a valid Sentry DSN …)"` — a
  placeholder or malformed DSN; correct it.

```bash
curl -s https://thinkabell.click/api/health
```

### Source maps

After a build with `SENTRY_AUTH_TOKEN`, `SENTRY_ORG` and `SENTRY_PROJECT` set,
confirm the upload in Sentry → **Project Settings → Source Maps** — the release
should list uploaded artifacts. If it is empty, the upload did not run: check
that `SENTRY_AUTH_TOKEN` is non-empty and that the build output includes
`.map` files for the chunks you care about.

---

## 6. Two gotchas

**`SENTRY_JWKS_URL` on the host is unrelated.** Supabase also lists a
`SUPABASE_JWKS_URL`, and it is a _different_ service. Sentry's own equivalent is
not needed here: `@sentry/nextjs` verifies its own transport, so no extra
variable is required.

**Traces sampling.** The defaults are `0.1`, i.e. 10% of transactions for
performance monitoring. Raising it multiplies event volume and can consume the
free quota quickly on a traffic spike; keep `0.1` until quota is understood, and
prefer filtering in the project's inbound filters over raising the rate.

---

## 7. Note on the organisation spelling

The slug provided is `soloenterpreneurer`, which reads like a typo for
"solopreneur". This does not affect the app — the slug is used verbatim in the
release name and both spellings work consistently — but it **is** worth
correcting at the source if you control the org, because it appears in every
release identifier and in the source-map URLs, and it cannot be changed later
without rotating the auth token and re-uploading maps.

Confirm the exact slug from Sentry → **Settings → Organization Settings →
General → Organization Slug** and use that value, whatever it is.
