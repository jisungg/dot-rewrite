"use client";

import { useEffect } from "react";

// Cross-component event bus for "the engine just produced new data".
// Used so the Nexus tab, Relationships tab, etc. can re-fetch their
// engine-owned tables (note_semantic_edges, semantic_topic_clusters,
// note_diagnostics, …) without each one independently subscribing to
// realtime channels.

export type EngineEventDetail = {
  space_id?: string | null;
  reason: "analysis_ok" | "clusters_changed" | "diagnostics_changed" | "manual";
};

const EVENT = "dot-rewrite:engine-updated";

export function emitEngineUpdate(detail: EngineEventDetail): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<EngineEventDetail>(EVENT, { detail }));
}

export function useEngineUpdates(
  handler: (detail: EngineEventDetail) => void,
): void {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onEvent = (e: Event) => {
      const ce = e as CustomEvent<EngineEventDetail>;
      handler(ce.detail);
    };
    window.addEventListener(EVENT, onEvent as EventListener);
    return () => window.removeEventListener(EVENT, onEvent as EventListener);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
