import "server-only";
import postgres from "postgres";

/**
 * Plain-Postgres data client for nozero — replaces the Supabase data plane.
 *
 * Points at the Railway-hosted `nozero` database (migrated 2026-07-18 from the
 * gily Supabase `nozero` schema, Supabase-isms stripped: no RLS, no auth.users
 * FKs). Part of the "sunset Supabase → all storage in Railway" architecture.
 *
 * Server-only: browser components must reach data via API route handlers, not this
 * module (the old `createBrowserClient` PostgREST access has no direct-PG equivalent
 * in the browser).
 *
 * Env: DATABASE_URL = postgres://postgres:<pw>@postgres.railway.internal:5432/nozero
 * The tables live in the `nozero` schema, so search_path is pinned below.
 */
// Must NOT throw at module-load time: `next build` evaluates modules to collect page
// data, and DATABASE_URL is a runtime var (absent during the Docker build). postgres.js
// connects lazily on first query, so a placeholder is safe until runtime.
const connectionString =
  process.env.DATABASE_URL || "postgres://placeholder:placeholder@127.0.0.1:5432/nozero";

declare global {
  // Reuse the pool across HMR / serverless invocations.
  // eslint-disable-next-line no-var
  var __nozeroSql: ReturnType<typeof postgres> | undefined;
}

export const sql =
  global.__nozeroSql ??
  postgres(connectionString, {
    max: 10,
    idle_timeout: 20,
    connection: { search_path: "nozero,public" },
  });

if (process.env.NODE_ENV !== "production") {
  global.__nozeroSql = sql;
}

export default sql;
