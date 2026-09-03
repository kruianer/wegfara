"use client";

import { useState } from "react";
import type { Poi } from "@/lib/pois/types";
import {
  GOOGLE_LINK_FAILURE_TEXT,
  importPoiFromGoogleLink,
} from "@/lib/pois/import-google-link";
import styles from "./poi-link-import.module.css";

type ImportState =
  | { kind: "idle" }
  | { kind: "running" }
  | { kind: "done"; text: string };

/** POI aus einem eingefuegten Google-Maps-Link anlegen (siehe req-026). */
export function PoiLinkImport({
  tripId,
  onPoiImported,
}: {
  tripId: string;
  /** Der angelegte oder aufgefrischte POI — die Liste uebernimmt ihn. */
  onPoiImported: (poi: Poi) => void;
}) {
  const [link, setLink] = useState("");
  const [state, setState] = useState<ImportState>({ kind: "idle" });

  async function handleImport() {
    if (state.kind === "running" || link.trim().length === 0) return;
    setState({ kind: "running" });

    const outcome = await importPoiFromGoogleLink(tripId, link.trim());
    if (outcome.result === "fehler") {
      setState({
        kind: "done",
        text: GOOGLE_LINK_FAILURE_TEXT[outcome.reason],
      });
      return;
    }

    onPoiImported(outcome.poi);
    setLink("");
    setState({
      kind: "done",
      text:
        outcome.result === "angelegt"
          ? `„${outcome.poi.name}" angelegt.`
          : `„${outcome.poi.name}" aufgefrischt.`,
    });
  }

  const running = state.kind === "running";

  return (
    <div className={styles.bar}>
      <div className={styles.controls}>
        <input
          type="text"
          className={styles.linkInput}
          placeholder="Google-Maps-Link einfügen"
          aria-label="Google-Maps-Link"
          value={link}
          onChange={(e) => setLink(e.target.value)}
          disabled={running}
        />
        <button
          type="button"
          className={styles.importButton}
          onClick={handleImport}
          disabled={running || link.trim().length === 0}
        >
          {running ? "Schlägt nach…" : "POI aus Link"}
        </button>
      </div>
      {state.kind === "done" && (
        <p className={styles.hint} data-testid="poi-link-result">
          {state.text}
        </p>
      )}
    </div>
  );
}
