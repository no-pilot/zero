"use client";

/**
 * Browser client after retiring Supabase. There is NO browser-side data access in
 * nozero (all `.from()` usage is server-side); this only provides the auth surface
 * (`getUser` / `signOut` / `signInWithOAuth`) the client components still call, via
 * server API routes.
 */
export function createClient(): any {
  const auth = {
    async getUser() {
      try {
        const r = await fetch("/api/auth/me", { cache: "no-store" });
        if (!r.ok) return { data: { user: null }, error: { message: "no session" } };
        const j = await r.json();
        return { data: { user: j.user ?? null }, error: j.user ? null : { message: "no session" } };
      } catch (e) {
        return { data: { user: null }, error: { message: (e as Error).message } };
      }
    },
    async signOut() {
      try {
        await fetch("/api/auth/signout", { method: "POST" });
      } catch {
        /* ignore */
      }
      return { error: null };
    },
    async signInWithOAuth(_opts?: unknown) {
      const url = "/api/auth/login";
      if (typeof window !== "undefined") window.location.href = url;
      return { data: { provider: "google", url }, error: null };
    },
  };
  return { auth };
}
