import { type NextRequest, NextResponse } from "next/server";

/**
 * Pass-through middleware. Supabase SSR session refresh was retired — nozero now uses
 * a stateless signed session cookie (see lib/auth-session), so there is nothing to
 * refresh here. Route protection is enforced in server components/handlers via
 * lib/supabase/auth-server `requireUser()`.
 */
export async function proxy(_request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
