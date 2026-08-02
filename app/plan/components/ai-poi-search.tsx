"use client";

import { useState } from "react";
import type { Poi, PoiTypeFilter } from "@/lib/pois/types";
import { runAiPoiSearch } from "@/lib/pois/run-ai-search";
import styles from "./ai-poi-search.module.css";

type SearchState =
  | { kind: "idle" }
  | { kind: "running" }
  | { kind: "done"; addedCount: number; discardedCount: number }
  | { kind: "error" };

/** Suche neuer POIs per KI im gezeichneten Suchgebiet (siehe req-014). */
export function AiPoiSearch({
  tripId,
  typeFilter,
  hasSearchArea,
  onPoisAdded,
}: {
  tripId: string;
  typeFilter: PoiTypeFilter;
  hasSearchArea: boolean;
  onPoisAdded: (pois: Poi[]) => void;
}) {
  const [wish, setWish] = useState("");
  const [state, setState] = useState<SearchState>({ kind: "idle" });

  async function handleSearch() {
    if (state.kind === "running" || !hasSearchArea) return;
    setState({ kind: "running" });

    const outcome = await runAiPoiSearch(tripId, typeFilter, wish);
    if (!outcome) {
      setState({ kind: "error" });
      return;
    }

    onPoisAdded(outcome.createdPois);
    setState({
      kind: "done",
      addedCount: outcome.addedCount,
      discardedCount: outcome.discardedCount,
    });
  }

  const running = state.kind === "running";

  return (
    <div className={styles.bar}>
      <div className={styles.controls}>
        <input
          type="text"
          className={styles.wishInput}
          placeholder='z.B. "ruhige Strände", "mit Kindern"'
          aria-label="Wunsch für die POI-Suche"
          value={wish}
          onChange={(e) => setWish(e.target.value)}
          disabled={running}
        />
        <button
          type="button"
          className={styles.searchButton}
          onClick={handleSearch}
          disabled={!hasSearchArea || running}
        >
          {running ? "Sucht…" : "POIs per KI suchen"}
        </button>
      </div>
      {!hasSearchArea && (
        <p className={styles.hint}>
          Zuerst ein Suchgebiet auf der Karte zeichnen.
        </p>
      )}
      {state.kind === "done" && (
        <p className={styles.hint} data-testid="ai-search-result">
          {state.addedCount} neue POIs angelegt, {state.discardedCount}{" "}
          Vorschläge verworfen.
        </p>
      )}
      {state.kind === "error" && (
        <p className={styles.hint} data-testid="ai-search-error">
          Die Suche ist fehlgeschlagen. Die POI-Liste ist unverändert.
        </p>
      )}
    </div>
  );
}
