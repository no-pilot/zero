import crypto from "node:crypto";
import { type NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  OAUTH_NEXT_COOKIE,
  OAUTH_STATE_COOKIE,
  SESSION_COOKIE,
  createSessionToken,
  exchangeCode,
  safeNext,
  type SessionUser,
} from "@/lib/auth-session";

function statesMatch(a: string | undefined, b: string | undefined): boolean {
  if (!a || !b) return false;
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}

/**
 * Direct Google OAuth callback (retired Supabase Auth). Verifies the CSRF `state` against
 * the cookie set at /api/auth/login, exchanges the auth code for Google tokens, resolves
 * the profile BY EMAIL so existing data (events keyed by the old Supabase user_id) stays
 * linked, upserts tokens, and sets the session cookie.
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const returnedState = url.searchParams.get("state") ?? undefined;
  const expectedState = request.cookies.get(OAUTH_STATE_COOKIE)?.value;
  const next = safeNext(request.cookies.get(OAUTH_NEXT_COOKIE)?.value);

  const fail = (err: string) => {
    const res = NextResponse.redirect(new URL(`/auth/signin?error=${err}`, url.origin));
    res.cookies.delete(OAUTH_STATE_COOKIE);
    res.cookies.delete(OAUTH_NEXT_COOKIE);
    return res;
  };

  if (!code) return fail("missing_code");
  if (!statesMatch(returnedState, expectedState)) return fail("invalid_state");

  try {
    const { tokens, user: g } = await exchangeCode(code);
    const admin = createAdminClient();

    // Preserve continuity: if a profile with this email already exists, keep its id.
    let userId = g.id;
    if (g.email) {
      const { data: existing } = await admin
        .from("profiles")
        .select("id")
        .eq("email", g.email)
        .maybeSingle();
      if (existing && (existing as { id: string }).id) {
        userId = (existing as { id: string }).id;
      }
    }

    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
    const { error: upsertError } = await admin.from("profiles").upsert(
      {
        id: userId,
        email: g.email,
        name: g.name,
        image: g.image,
        provider: "google",
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token ?? null,
        expires_at: expiresAt,
      },
      { onConflict: "id" },
    );
    if (upsertError) console.error("profile upsert failed", upsertError);

    const sessionUser: SessionUser = { id: userId, email: g.email, name: g.name, image: g.image };
    const jwt = await createSessionToken(sessionUser);
    const res = NextResponse.redirect(new URL(next, url.origin));
    res.cookies.set(SESSION_COOKIE, jwt, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
    res.cookies.delete(OAUTH_STATE_COOKIE);
    res.cookies.delete(OAUTH_NEXT_COOKIE);
    return res;
  } catch (e) {
    return fail(encodeURIComponent((e as Error).message || "exchange_failed"));
  }
}
