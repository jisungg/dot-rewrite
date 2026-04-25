"use client";

import { useEffect, useRef } from "react";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";

import { createClient } from "@/utils/supabase/client";

// Light wrapper around supabase-js realtime channels. Subscribes to
// postgres_changes events for a single table, optionally scoped by a
// PostgREST-style filter (e.g. `user_id=eq.${user.id}`).
//
// The handler ref is updated on every render so the effect doesn't tear
// down the channel just because the parent component re-rendered.

export type RealtimePayload = RealtimePostgresChangesPayload<
  Record<string, unknown>
>;

export function useRealtimeTable(args: {
  table: string;
  filter?: string;
  enabled?: boolean;
  schema?: string;
  onChange: (payload: RealtimePayload) => void;
}): void {
  const { table, filter, enabled = true, schema = "public", onChange } = args;
  const handlerRef = useRef(onChange);
  handlerRef.current = onChange;

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;
    const supabase = createClient();
    const tag = `${schema}_${table}_${
      filter ?? "all"
    }_${Math.random().toString(36).slice(2, 8)}`;
    const channel = supabase.channel(tag).on(
      "postgres_changes",
      // The supabase-js types don't expose every union, so cast.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      {
        event: "*",
        schema,
        table,
        ...(filter ? { filter } : {}),
      } as any,
      (payload: RealtimePayload) => {
        try {
          handlerRef.current(payload);
        } catch (err) {
          console.error("realtime handler threw:", err);
        }
      },
    );
    channel.subscribe((status) => {
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        console.warn(`realtime channel ${tag}:`, status);
      }
    });
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [enabled, table, filter, schema]);
}
