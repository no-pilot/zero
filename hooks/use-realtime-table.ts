"use client";

import { useEffect, useRef } from "react";

type NozeroTable = "events" | "categories" | "invitations" | "profiles";

/** Minimal stand-in for the old Supabase RealtimePostgresChangesPayload. */
export type RealtimeChange<Row extends { [key: string]: unknown }> = {
  eventType: "INSERT" | "UPDATE" | "DELETE";
  new: Row | null;
  old: Row | null;
};

type Options<Row extends { [key: string]: unknown }> = {
  table: NozeroTable;
  filter?: string;
  onChange: (payload: RealtimeChange<Row>) => void;
  channelKey?: string;
};

/**
 * NO-OP after retiring Supabase Realtime. Postgres change subscriptions (websockets)
 * have no plain-Postgres equivalent; live table updates are disabled until replaced by
 * polling or SSE. Signature preserved so call sites are unchanged — data still loads via
 * the normal server fetch on navigation/refresh.
 *
 * TODO(nozero): reintroduce live updates via a polling hook against an API route, or
 * Postgres LISTEN/NOTIFY bridged over SSE.
 */
export function useRealtimeTable<Row extends { [key: string]: unknown }>({
  onChange,
}: Options<Row>) {
  const callbackRef = useRef(onChange);
  callbackRef.current = onChange;

  useEffect(() => {
    // intentionally no subscription — see TODO above.
    return () => {};
  }, []);
}
