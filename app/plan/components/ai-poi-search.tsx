"use client";

import { useState } from "react";
import type { Poi, PoiTypeFilter } from "@/lib/pois/types";
import { runAiPoiSearch } from "@/lib/pois/run-ai-search";
import { apiKeyMissingHint } from "@/lib/api-keys/types";
import styles from "./ai-poi-search.module.css";

type SearchState =
  | { kind: "idle" }
  | { kind: "running" }
  | { kind: "done"; addedCount: number; discardedCount: number }
  | { kind: "error" };

/**
 * Suche neuer POIs per KI im gezeichneten Suchgebiet (siehe req-014,
 * req-057).
 *
 * Sie rechnet ueber die Zugangsschluessel des Accounts ab (req-028) und
 * braucht seit req-057 beide: den fuer das Sprachmodell und den fuer Google,
 * wo die vorgeschlagenen Orte mit Foto und Bewertung nachgeschlagen werden.
 * Fehlt einer, ist die Schaltflaeche nicht bedienbar und ein Hinweis nennt
 * den Grund. Die Sperre gilt zusaetzlich serverseitig -- die Schnittstelle
 * sucht ohne Schluessel gar nicht erst.
 */
export function AiPoiSearch({
  tripId,
  typeFilter,
  hasSearchArea,
  onPoisAdded,
  hasApiKey = false,
  hasGoogleKey = false,
}: {
  tripId: string;
  typeFilter: PoiTypeFilter;
  hasSearchArea: boolean;
  onPoisAdded: (pois: Poi[]) => void;
  /** Ob der Account einen Zugangsschluessel fuer die KI-Suche hat (req-028). */
  hasApiKey?: boolean;
  /** Ob der Account einen Zugangsschluessel fuer Google hat (req-028, req-057). */
  hasGoogleKey?: boolean;
}) {
  const [wish, setWish] = useState("");
  const [state, setState] = useState<SearchState>({ kind: "idle" });

  // Ohne beide Schluessel gibt es keinen Lauf: die KI schlaegt die Orte vor,
  // Google liefert Foto und Bewertung dazu (req-057).
  const bereit = hasApiKey && hasGoogleKey;

  async function handleSearch() {
    if (state.kind === "running" || !hasSearchArea || !bereit) return;
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
          disabled={running || !bereit}
        />
        <button
          type="button"
          className={styles.searchButton}
          onClick={handleSearch}
          disabled={!bereit || !hasSearchArea || running}
        >
          {running ? "Sucht…" : "POIs per KI suchen"}
        </button>
      </div>
      {/* Der fehlende Schluessel steht vor dem fehlenden Suchgebiet: er ist
          der Grund, der sich nicht in der Karte beheben laesst (req-028). */}
      {!bereit ? (
        <p className={styles.hint} data-testid="ai-search-kein-schluessel">
          {apiKeyMissingHint(!hasApiKey ? "ki_suche" : "google")}
        </p>
      ) : (
        !hasSearchArea && (
          <p className={styles.hint}>
            Zuerst ein Suchgebiet auf der Karte zeichnen.
          </p>
        )
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
