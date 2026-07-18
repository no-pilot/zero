import crypto from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import {
  OAUTH_NEXT_COOKIE,
  OAUTH_STATE_COOKIE,
  googleAuthUrl,
  safeNext,
} from "@/lib/auth-session";

/**
 * Kick off sign-in (retired Supabase Auth). Generates a random OAuth `state` for CSRF
 * protection and stashes it — plus the validated `next` target — in short-lived HttpOnly
 * cookies the callback verifies. The `state` sent to Google is ONLY the random value.
 */
export async function GET(request: NextRequest) {
  const next = safeNext(new URL(request.url).searchParams.get("next"));
  const state = crypto.randomBytes(32).toString("base64url");

  const res = NextResponse.redirect(googleAuthUrl(state));
  const opts = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 600, // 10 min to complete consent
  };
  res.cookies.set(OAUTH_STATE_COOKIE, state, opts);
  res.cookies.set(OAUTH_NEXT_COOKIE, next, opts);
  return res;
}
