import { SignJWT, jwtVerify } from "jose";

/**
 * Plain session auth for nozero (replaces Supabase Auth / GoTrue). Google OAuth2
 * authorization-code flow + a signed session cookie. Edge- and Node-compatible (jose).
 *
 * Env: NOZERO_SESSION_SECRET, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET,
 *      NEXT_PUBLIC_SITE_URL (origin for the OAuth redirect URI).
 * Redirect URI = <SITE_URL>/auth/callback  (must be registered in the Google OAuth client).
 */
export const SESSION_COOKIE = "nozero_session";
// Short-lived cookies carrying the OAuth CSRF token and the post-login redirect target.
export const OAUTH_STATE_COOKIE = "nozero_oauth_state";
export const OAUTH_NEXT_COOKIE = "nozero_oauth_next";

/**
 * Constrain a post-login redirect target to a same-origin relative path, so a crafted
 * `next` can't turn the callback into an open redirect. Rejects absolute URLs and
 * protocol-relative (`//host`) / backslash tricks; falls back to `/calendar`.
 */
export function safeNext(next: string | null | undefined, fallback = "/calendar"): string {
  if (!next || next[0] !== "/" || next[1] === "/" || next[1] === "\\") return fallback;
  return next;
}
const GOOGLE_SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/gmail.readonly",
];

export interface SessionUser {
  id: string;
  email: string | null;
  name?: string | null;
  image?: string | null;
}

function secret() {
  const s = process.env.NOZERO_SESSION_SECRET;
  if (!s) throw new Error("NOZERO_SESSION_SECRET is not set");
  return new TextEncoder().encode(s);
}

export function redirectUri() {
  const base = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  return `${base.replace(/\/$/, "")}/auth/callback`;
}

export async function createSessionToken(user: SessionUser): Promise<string> {
  return new SignJWT({ email: user.email, name: user.name, image: user.image })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secret());
}

export async function verifySessionToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, secret());
    return {
      id: String(payload.sub),
      email: (payload.email as string) ?? null,
      name: (payload.name as string) ?? null,
      image: (payload.image as string) ?? null,
    };
  } catch {
    return null;
  }
}

export function googleAuthUrl(state?: string): string {
  const p = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID || "",
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: GOOGLE_SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
  });
  if (state) p.set("state", state);
  return `https://accounts.google.com/o/oauth2/v2/auth?${p.toString()}`;
}

export interface GoogleTokens {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  id_token: string;
}

export async function exchangeCode(code: string): Promise<{ tokens: GoogleTokens; user: SessionUser }> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID || "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
      redirect_uri: redirectUri(),
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) throw new Error(`google token exchange failed: ${res.status} ${await res.text()}`);
  const tokens = (await res.json()) as GoogleTokens;
  // decode id_token (JWT) payload for identity (no verification needed — it came direct from Google over TLS)
  const claims = JSON.parse(Buffer.from(tokens.id_token.split(".")[1], "base64").toString("utf8"));
  const user: SessionUser = {
    id: claims.sub,
    email: claims.email ?? null,
    name: claims.name ?? null,
    image: claims.picture ?? null,
  };
  return { tokens, user };
}

export async function refreshGoogleToken(refreshToken: string): Promise<GoogleTokens> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: process.env.GOOGLE_CLIENT_ID || "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error(`google token refresh failed: ${res.status}`);
  return (await res.json()) as GoogleTokens;
}
