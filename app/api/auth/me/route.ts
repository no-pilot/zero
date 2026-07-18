import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth-session";

/** Current session user for browser components. */
export async function GET() {
  const tok = (await cookies()).get(SESSION_COOKIE)?.value;
  const u = tok ? await verifySessionToken(tok) : null;
  if (!u) return NextResponse.json({ user: null }, { status: 401 });
  return NextResponse.json({
    user: {
      id: u.id,
      email: u.email,
      user_metadata: { full_name: u.name, name: u.name, avatar_url: u.image, picture: u.image },
    },
  });
}
