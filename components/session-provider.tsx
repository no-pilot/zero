"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type React from "react";

/**
 * Session context after retiring Supabase Auth. Fetches the current user from
 * `/api/auth/me` (signed cookie session). No realtime auth events — session changes
 * take effect on navigation after login/logout.
 */
type SessionUser = {
  id: string;
  email: string | null;
  user_metadata?: Record<string, unknown>;
};
type SessionLike = { user: SessionUser } | null;

type SessionContextValue = {
  session: SessionLike;
  user: SessionUser | null;
  loading: boolean;
};

const SessionContext = createContext<SessionContextValue>({
  session: null,
  user: null,
  loading: true,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetch("/api/auth/me", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { user: null }))
      .then((j) => {
        if (!active) return;
        setUser(j.user ?? null);
        setLoading(false);
      })
      .catch(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const value = useMemo<SessionContextValue>(
    () => ({ session: user ? { user } : null, user, loading }),
    [user, loading],
  );

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

export function useSession() {
  return useContext(SessionContext);
}
