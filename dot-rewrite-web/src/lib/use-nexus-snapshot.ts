"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  fetchNexusSnapshot,
  fetchTypedRelations,
  fetchConceptReach,
  fetchInsightDetail,
} from "@/utils/supabase/queries";
import type {
  NexusSnapshot,
  TypedRelationRow,
  ConceptMentionRow,
  NexusInsight,
} from "@/data/types";
import { EMPTY_NEXUS_SNAPSHOT } from "@/data/types";
import { useEngineUpdates } from "@/lib/engine-events";

type FetchState = "idle" | "loading" | "ready" | "error";

export type NexusSnapshotState = {
  snapshot: NexusSnapshot;
  status: FetchState;
  error: string | null;
  reload: () => void;
};

const STALE_MS = 60_000;

export function useNexusSnapshot(spaceIds: string[]): NexusSnapshotState {
  const [snapshot, setSnapshot] = useState<NexusSnapshot>(EMPTY_NEXUS_SNAPSHOT);
  const [status, setStatus] = useState<FetchState>("idle");
  const [error, setError] = useState<string | null>(null);
  const lastFetchRef = useRef<number>(0);
  const cancelledRef = useRef<boolean>(false);
  const idsKey = spaceIds.slice().sort().join(",");

  const run = useCallback(async () => {
    if (spaceIds.length === 0) {
      setSnapshot(EMPTY_NEXUS_SNAPSHOT);
      setStatus("ready");
      return;
    }
    setStatus("loading");
    setError(null);
    try {
      const data = await fetchNexusSnapshot(spaceIds);
      if (cancelledRef.current) return;
      setSnapshot(data);
      setStatus("ready");
      lastFetchRef.current = Date.now();
    } catch (err) {
      if (cancelledRef.current) return;
      setError(err instanceof Error ? err.message : String(err));
      setStatus("error");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey]);

  useEffect(() => {
    cancelledRef.current = false;
    void run();
    return () => {
      cancelledRef.current = true;
    };
  }, [run]);

  useEngineUpdates(() => {
    if (Date.now() - lastFetchRef.current < 750) return; // dedupe burst
    void run();
  });

  return { snapshot, status, error, reload: run };
}

// ============================================================
// Lazy fetchers — typed relations, concept reach, insight detail.
// Each one is small + idempotent; cached by key for the session.
// ============================================================

type LazyState<T> = {
  data: T | null;
  status: FetchState;
  error: string | null;
};

export function useTypedRelations(
  spaceIds: string[],
  enabled: boolean,
): LazyState<TypedRelationRow[]> {
  const [state, setState] = useState<LazyState<TypedRelationRow[]>>({
    data: null,
    status: "idle",
    error: null,
  });
  const cacheRef = useRef<Map<string, TypedRelationRow[]>>(new Map());
  const idsKey = spaceIds.slice().sort().join(",");

  useEffect(() => {
    if (!enabled || spaceIds.length === 0) return;
    const cached = cacheRef.current.get(idsKey);
    if (cached) {
      setState({ data: cached, status: "ready", error: null });
      return;
    }
    let cancelled = false;
    setState({ data: null, status: "loading", error: null });
    fetchTypedRelations(spaceIds, null)
      .then((rows) => {
        if (cancelled) return;
        cacheRef.current.set(idsKey, rows);
        setState({ data: rows, status: "ready", error: null });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setState({
          data: null,
          status: "error",
          error: err instanceof Error ? err.message : String(err),
        });
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, idsKey]);

  return state;
}

export function useConceptReach(
  spaceIds: string[],
  conceptKey: string | null,
): LazyState<ConceptMentionRow[]> {
  const [state, setState] = useState<LazyState<ConceptMentionRow[]>>({
    data: null,
    status: "idle",
    error: null,
  });
  const idsKey = spaceIds.slice().sort().join(",");
  const cacheKey = `${idsKey}|${conceptKey ?? ""}`;
  const cacheRef = useRef<Map<string, ConceptMentionRow[]>>(new Map());

  useEffect(() => {
    if (!conceptKey || spaceIds.length === 0) {
      setState({ data: null, status: "idle", error: null });
      return;
    }
    const cached = cacheRef.current.get(cacheKey);
    if (cached) {
      setState({ data: cached, status: "ready", error: null });
      return;
    }
    let cancelled = false;
    setState({ data: null, status: "loading", error: null });
    fetchConceptReach(spaceIds, conceptKey)
      .then((rows) => {
        if (cancelled) return;
        cacheRef.current.set(cacheKey, rows);
        setState({ data: rows, status: "ready", error: null });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setState({
          data: null,
          status: "error",
          error: err instanceof Error ? err.message : String(err),
        });
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey]);

  return state;
}

export function useInsightDetail(insightId: string | null): LazyState<NexusInsight> {
  const [state, setState] = useState<LazyState<NexusInsight>>({
    data: null,
    status: "idle",
    error: null,
  });
  const cacheRef = useRef<Map<string, NexusInsight>>(new Map());

  useEffect(() => {
    if (!insightId) {
      setState({ data: null, status: "idle", error: null });
      return;
    }
    const cached = cacheRef.current.get(insightId);
    if (cached) {
      setState({ data: cached, status: "ready", error: null });
      return;
    }
    let cancelled = false;
    setState({ data: null, status: "loading", error: null });
    fetchInsightDetail(insightId)
      .then((row) => {
        if (cancelled) return;
        if (row) cacheRef.current.set(insightId, row);
        setState({
          data: row,
          status: row ? "ready" : "error",
          error: row ? null : "not found",
        });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setState({
          data: null,
          status: "error",
          error: err instanceof Error ? err.message : String(err),
        });
      });
    return () => {
      cancelled = true;
    };
  }, [insightId]);

  return state;
}

// Re-export STALE_MS in case other modules want to align cache windows.
export const NEXUS_STALE_MS = STALE_MS;
