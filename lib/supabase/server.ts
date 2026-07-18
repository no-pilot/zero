import "server-only";
import { cookies } from "next/headers";
import { createPgClient } from "@/lib/pg-compat";
import { SESSION_COOKIE, verifySessionToken, type SessionUser } from "@/lib/auth-session";

/**
 * Retired Supabase → plain Postgres (Railway) + signed cookie session. Preserves the
 * old call shape: `const supabase = await createClient(); supabase.from(...)` and
 * `supabase.auth.getUser()`.
 */
function toSupabaseUser(u: SessionUser) {
  return {
    id: u.id,
    email: u.email ?? "",
    user_metadata: { full_name: u.name, name: u.name, avatar_url: u.image, picture: u.image },
    app_metadata: { provider: "google" },
  };
}

export async function createClient(): Promise<any> {
  const pg = createPgClient();
  const cookieStore = await cookies();
  const auth = {
    async getUser() {
      const tok = cookieStore.get(SESSION_COOKIE)?.value;
      const u = tok ? await verifySessionToken(tok) : null;
      if (!u) return { data: { user: null }, error: { message: "no session" } };
      return { data: { user: toSupabaseUser(u) }, error: null };
    },
    async updateUser(payload: { data?: Record<string, unknown>; password?: string }) {
      try {
        const tok = cookieStore.get(SESSION_COOKIE)?.value;
        const u = tok ? await verifySessionToken(tok) : null;
        const name = payload?.data?.full_name ?? payload?.data?.name;
        if (u && typeof name === "string" && name) {
          await pg.from("profiles").update({ name }).eq("id", u.id);
        }
        return { data: {}, error: null };
      } catch (e) {
        return { data: {}, error: { message: (e as Error).message } };
      }
    },
    async signOut() {
      return { error: null };
    },
  };
  return Object.assign(pg, { auth });
}
