# nozero — Supabase → Railway (plain Postgres) migration

Directive (2026-07-18): **sunset Supabase, move ALL data storage into Railway.**
No self-hosted Supabase — plain vanilla Postgres.

## Status

### ✅ Data plane — DONE & verified
- gily Supabase `nozero` schema (PG17) dumped via `postgres:17` Docker `pg_dump`.
- Supabase-isms stripped: RLS disabled, all `CREATE POLICY` dropped, `auth.users`
  FKs removed, `auth.uid()`/`auth.jwt()` defaults rewritten out.
- Restored into Railway project `jupiter` → new **`nozero` database** on the existing
  Postgres service. Row parity verified:
  `events 2680 · email_threads 367 · email_messages 120 · profiles 1` (+ empty
  account_codes/calendar_tokens/categories/invitations). 0 policies, 0 FKs.
- Connection (internal): `postgres://postgres:<pw>@postgres.railway.internal:5432/nozero`

### ✅ Code rewire — DONE (builds green: `bun run build` → 0 errors, 2026-07-18)
Approach changed from per-site rewrite to a **compatibility shim**, so the ~70
`.from()`/`.rpc()` call sites stayed unchanged:

1. **Data access → plain PG.** `lib/db.ts` (postgres.js, lazy connect, `search_path=nozero,public`)
   + `lib/pg-compat.ts` — a server-only supabase-js-compatible query builder
   (`select/insert/update/upsert/delete`, filters, `order/limit/range`, `single/maybeSingle`,
   `or`, `rpc`; identifiers from code literals, values parameterized). `lib/supabase/{server,admin}.ts`
   now return this PG client. `lib/supabase/browser.ts` is an **auth-only** shim (no browser data;
   `getUser/signOut/signInWithOAuth` go via `/api/auth/*` routes).
2. **Auth → direct Google OAuth.** `lib/auth-session.ts` — OAuth2 auth-code flow + signed
   cookie (JWT via `jose`, 30d, `NOZERO_SESSION_SECRET`). `/auth/callback` exchanges the code,
   **resolves the profile by email** (preserves the old Supabase user_id → existing data stays
   linked), upserts tokens, sets the `nozero_session` cookie. Routes: `app/api/auth/{login,me,signout}`,
   `app/api/auth/google/{connect,callback}`.
3. **Supabase removed** — no `@supabase/*` packages in `package.json`; 0 `SUPABASE_` refs in code.

**Google OAuth client (resolved):** `nopilot-zero` web client `819284474850-p1cuf6s3…`. Redirect
URIs already include `https://zero.nopilot.co/auth/callback` — the external blocker is **cleared**.
`cospace.npt` `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` were a mismatched pair (secret belonged to a
different client `692…`); fixed 2026-07-18 so both point at `819…`.

**Secrets:** `.env.tpl` repointed from the retired `nopilot.nozero`/`aqua.npt` vaults to
`cospace.npt` (agnostic bare titles); `op inject` resolves all 30 vars green. Supabase auth vars
dropped; `DATABASE_URL` documented (Railway service-reference in prod, public proxy URL for local dev).

### ✅ Deploy — LIVE (2026-07-18)
- Railway project `jupiter` → service **`nozero`** ● Online. `DATABASE_URL` →
  `postgres.railway.internal:5432/nozero` (internal). Dockerfile, port 3000.
- Custom domain **`https://zero.nopilot.co`** attached (valid cert); Cloudflare DNS
  `CNAME zero → 32z80ety.up.railway.app` (DNS-only) + `TXT _railway-verify.zero`.
- All env set from `cospace.npt` via `op inject` (48 vars: core auth + db + AI + SOMA +
  MXroute + Krisp + Tower/Flightdeck + CTX + Madrigal). `NEXT_PUBLIC_SITE_URL`/`SITE_URL`
  = `https://zero.nopilot.co`. `GOOGLE_CLIENT_SECRET` corrected to the `819…` client.
- OAuth authorize verified in-browser: `/api/auth/login` → Google consent accepted
  (client_id `819…`, redirect `https://zero.nopilot.co/auth/callback`, offline, calendar+gmail
  scopes). Token exchange (uses the secret) reachable only by a human completing Google login;
  secret is byte-correct vs the client's own JSON.

### ⬜ Follow-ups
- **Human smoke test:** complete a real Google login at `https://zero.nopilot.co` and confirm
  session + calendar/email load.
- **Commit** the rewire (still entirely in the working tree; no branch/commit yet).

## Why not a blind one-shot rewrite
Auth reimplementation is security-sensitive, credential-gated (Google OAuth client +
redirect-URI registration), and only verifiable in a browser. It should be done as a
focused, tested slice — not generated blind.
