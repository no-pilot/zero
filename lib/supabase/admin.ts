import "server-only";
import { createPgClient } from "@/lib/pg-compat";

/**
 * Service-role equivalent: plain Postgres client (Railway) connecting as the DB
 * superuser, so there is no RLS to bypass. Keeps `createAdminClient().from(...)`
 * and the narrow `.auth.admin.getUserById(...)` used by lib/auth-provider.
 */
export function createAdminClient(): any {
  const pg = createPgClient();
  const auth = {
    admin: {
      async getUserById(id: string) {
        const { data } = await pg.from("profiles").select("*").eq("id", id).maybeSingle();
        const p = data as Record<string, unknown> | null;
        if (!p) return { data: { user: null }, error: { message: "not found" } };
        const provider = (p.provider as string) || "google";
        return {
          data: {
            user: {
              id: p.id,
              email: p.email ?? null,
              app_metadata: { provider },
              identities: [{ provider }],
              user_metadata: { full_name: p.name, name: p.name, avatar_url: p.image, picture: p.image },
            },
          },
          error: null,
        };
      },
    },
  };
  return Object.assign(pg, { auth });
}
