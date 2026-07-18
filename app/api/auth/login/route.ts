import { NextResponse, type NextRequest } from "next/server";
import { googleAuthUrl } from "@/lib/auth-session";

/** Kick off sign-in: redirect to Google's consent screen (retired Supabase Auth). */
export async function GET(request: NextRequest) {
  const next = new URL(request.url).searchParams.get("next") || "/calendar";
  return NextResponse.redirect(googleAuthUrl(next));
}
