"use client";

import { useEffect, useRef, useState } from "react";
import type { Poi } from "@/lib/pois/types";
import type { PlaceSuggestion } from "@/lib/osm/place-search";
import {
  MIN_PLACE_QUERY_LENGTH,
  SEARCH_DEBOUNCE_MS,
} from "@/lib/osm/place-search";
import { searchPlaceSuggestions } from "@/lib/trips/search-places";
import {
  enthaeltWebadresse,
  parseGoogleMapsLink,
} from "@/lib/pois/google-link";
import {
  GOOGLE_LINK_FAILURE_TEXT,
  googleQuelleVonOrt,
  ortAusGoogleLink,
} from "@/lib/pois/google-ort";
import {
  googleOrtFuellung,
  ortsvorschlagFuellung,
  type Vorbelegung,
} from "@/lib/pois/formular-fuellen";
import { runAiPoiSearch } from "@/lib/pois/run-ai-search";
import { apiKeyMissingHint } from "@/lib/api-keys/types";
import {
  GOOGLE_FOTO_PROBLEM_TEXT,
  type GoogleFotoProblem,
} from "@/lib/pois/google-foto-problem";
import {
  aiSearchFehlerText,
  type AiSearchFehler,
} from "@/lib/pois/ai-search-fehler";
import styles from "./poi-anlegezeile.module.css";

/** Was an dem einen Eingabefeld steht — auch als Aufschrift fuer die Tests. */
export const ANLEGEZEILE_LABEL =
  "Ort suchen, Google-Maps-Link einfügen oder Wunsch für die KI-Suche";

/**
 * Was am Feld zu einem eingefuegten Google-Maps-Link steht (req-048). Dass
 * gerade nachgeschlagen wird, steht nicht darin: das ergibt sich aus dem
 * Feld selbst (siehe nachschlagLaeuft) und ist damit ab dem Einfuegen zu
 * sehen -- nicht erst, wenn die Anfrage hinausgeht (bug-026).
 */
type Nachschlag =
  | { kind: "ruht" }
  | { kind: "fehler"; text: string }
  | { kind: "uebernommen"; name: string };

type KiSuche =
  | { kind: "ruht" }
  | { kind: "laeuft" }
  | {
      kind: "fertig";
      addedCount: number;
      discardedCount: number;
      /** Warum die Bilder der neuen POIs fehlen (bug-027); null: sie fehlen nicht. */
      fotoProblem: GoogleFotoProblem | null;
    }
  /** Der Fehlschlag traegt seinen Grund bei sich (bug-032). */
  | { kind: "fehler"; fehler: AiSearchFehler };

/**
 * Die Anlegezeile ueber der POI-Liste (req-060): das Anlegen gehoert nicht
 * in die Liste, sondern darueber -- ausserhalb von Filter und Sortierung.
 *
 * Ihr eines Eingabefeld nimmt dreierlei an:
 *
 * - einen **Google-Maps-Link**, der erkannt und abgerufen wird (req-048),
 * - einen **Suchbegriff**, zu dem Vorschlaege aus der Ortssuche erscheinen,
 * - und denselben Text als **Wunsch fuer die KI-Suche** (req-014) -- aber
 *   nur auf Knopfdruck: ohne ihn laeuft keine KI-Suche, denn jeder Lauf
 *   kostet ueber den Zugangsschluessel des Accounts (req-028).
 *
 * Ein abgerufener Link und ein gewaehlter Vorschlag oeffnen das Formular
 * mit den Angaben des Ortes; daneben bleibt der Weg zum leeren Formular,
 * fuer Orte ohne eigenen Namen (req-035).
 */
export function PoiAnlegezeile({
  tripId,
  hasSearchArea,
  hasAiKey = false,
  hasGoogleKey = false,
  anlegenOffen = false,
  onOrtGefunden,
  onLeeresFormular,
  onPoisAdded,
}: {
  tripId: string;
  /** Ob auf der Karte ein Suchgebiet gezeichnet ist -- ohne es sucht die KI nicht. */
  hasSearchArea: boolean;
  /** Ob der Account einen Zugangsschluessel fuer die KI-Suche hat (req-028). */
  hasAiKey?: boolean;
  /** Ob der Account einen Zugangsschluessel fuer Google hat (req-028). */
  hasGoogleKey?: boolean;
  /** Ob das Formular zum Anlegen schon offen steht. */
  anlegenOffen?: boolean;
  /** Ein abgerufener Link oder ein gewaehlter Vorschlag oeffnet das Formular. */
  onOrtGefunden: (vorbelegung: Vorbelegung) => void;
  /** Der Weg zum leeren Formular (req-035). */
  onLeeresFormular: () => void;
  /** Die von der KI-Suche angelegten POIs (req-014) -- gespeichert sind sie da bereits. */
  onPoisAdded: (pois: Poi[]) => void;
}) {
  const [text, setText] = useState("");
  // Das Ergebnis der Ortssuche samt der Eingabe, zu der es gehoert -- so
  // verschwinden veraltete Vorschlaege beim Weitertippen von selbst.
  const [found, setFound] = useState<{
    query: string;
    places: PlaceSuggestion[];
  }>({ query: "", places: [] });
  const [nachschlag, setNachschlag] = useState<Nachschlag>({ kind: "ruht" });
  const [kiSuche, setKiSuche] = useState<KiSuche>({ kind: "ruht" });

  // Der Fund geht nach oben, sobald er da ist -- ueber eine Ablage, damit
  // eine neue Funktion des Aufrufers nicht die laufende Abfrage neu startet.
  const meldeOrt = useRef(onOrtGefunden);
  useEffect(() => {
    meldeOrt.current = onOrtGefunden;
  }, [onOrtGefunden]);

  // Ein eingefuegter Google-Maps-Link wird abgerufen statt vorgeschlagen
  // (req-048) -- zu ihm erscheint deshalb nie eine Vorschlagsliste.
  const istLink = parseGoogleMapsLink(text) !== null;
  // Eine andere Webadresse ist weder Link noch Suchbegriff: danach zu suchen
  // waere sinnlos, also sagt das Feld, woran es liegt.
  const fremderLink = !istLink && enthaeltWebadresse(text);
  const suggestions =
    !istLink && !fremderLink && found.query === text ? found.places : [];
  // Ein erkannter Link ist vom Einfuegen an in Arbeit -- erst die kurze
  // Wartezeit, dann die Anfrage (bug-026).
  const nachschlagLaeuft =
    istLink && hasGoogleKey && nachschlag.kind === "ruht";

  // Ohne beide Schluessel gibt es keinen Lauf: die KI schlaegt die Orte vor,
  // Google liefert Foto und Bewertung dazu (req-057).
  const kiBereit = hasAiKey && hasGoogleKey;
  const kiLaeuft = kiSuche.kind === "laeuft";

  useEffect(() => {
    if (parseGoogleMapsLink(text) === null) {
      if (enthaeltWebadresse(text)) return;
      if (text.trim().length < MIN_PLACE_QUERY_LENGTH) return;

      let abandoned = false;
      const timer = setTimeout(async () => {
        const places = await searchPlaceSuggestions(text);
        if (!abandoned) setFound({ query: text, places });
      }, SEARCH_DEBOUNCE_MS);

      return () => {
        abandoned = true;
        clearTimeout(timer);
      };
    }

    // Ohne Zugangsschluessel wird gar nicht erst angefragt (req-028); am
    // Feld steht dann der Hinweis darauf.
    if (!hasGoogleKey) return;

    let abandoned = false;
    const timer = setTimeout(async () => {
      const outcome = await ortAusGoogleLink(text);
      if (abandoned) return;

      if (outcome.result === "fehler") {
        // Der Text bleibt stehen, damit sich der Link ansehen laesst.
        setNachschlag({
          kind: "fehler",
          text: GOOGLE_LINK_FAILURE_TEXT[outcome.reason],
        });
        return;
      }

      // Der abgerufene Ort oeffnet das Formular (req-060) -- dort steht er
      // aenderbar, gespeichert wird er erst von Hand.
      meldeOrt.current({
        fuellung: googleOrtFuellung(outcome.ort),
        google: googleQuelleVonOrt(outcome.ort),
      });
      leereFeld({ kind: "uebernommen", name: outcome.ort.name });
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      abandoned = true;
      clearTimeout(timer);
    };
  }, [text, hasGoogleKey]);

  /** Das Feld ist abgearbeitet: es wird leer, die Vorschlaege gehen mit. */
  function leereFeld(danach: Nachschlag) {
    setText("");
    setFound({ query: "", places: [] });
    setNachschlag(danach);
  }

  /** Ein gewaehlter Vorschlag oeffnet das Formular mit diesem Ort (req-060). */
  function waehleVorschlag(place: PlaceSuggestion) {
    meldeOrt.current({
      fuellung: ortsvorschlagFuellung(place),
      google: null,
    });
    leereFeld({ kind: "uebernommen", name: place.name });
  }

  /**
   * Die KI-Suche laeuft ausschliesslich auf diesen Knopf hin (req-060): der
   * getippte Text gilt dann als Wunsch. Der Typfilter der Liste geht nicht
   * mit -- er wirkt seit req-060 allein auf die Liste.
   */
  async function sucheMitKi() {
    if (kiLaeuft || !hasSearchArea || !kiBereit) return;
    setKiSuche({ kind: "laeuft" });

    const outcome = await runAiPoiSearch(tripId, "alle", text);
    if (outcome.fehler) {
      setKiSuche({ kind: "fehler", fehler: outcome.fehler });
      return;
    }

    onPoisAdded(outcome.createdPois);
    setKiSuche({
      kind: "fertig",
      addedCount: outcome.addedCount,
      discardedCount: outcome.discardedCount,
      fotoProblem: outcome.fotoProblem,
    });
  }

  return (
    <div className={styles.bar} data-testid="poi-anlegezeile">
      <div className={styles.controls}>
        <input
          className={styles.input}
          type="text"
          autoComplete="off"
          aria-label={ANLEGEZEILE_LABEL}
          placeholder='Villa Rufolo · Google-Maps-Link · „ruhige Strände"'
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            setNachschlag({ kind: "ruht" });
          }}
        />
        <button
          type="button"
          className={styles.aiButton}
          onClick={() => void sucheMitKi()}
          disabled={!kiBereit || !hasSearchArea || kiLaeuft}
        >
          {kiLaeuft ? "Sucht…" : "Mit KI suchen"}
        </button>
        <button
          type="button"
          className={styles.createButton}
          onClick={onLeeresFormular}
          disabled={anlegenOffen}
        >
          POI anlegen
        </button>
      </div>

      {suggestions.length > 0 && (
        <ul className={styles.suggestions} aria-label="Ortsvorschläge">
          {suggestions.map((place) => (
            <li key={`${place.name}-${place.lat}-${place.lng}`}>
              <button
                type="button"
                className={styles.suggestion}
                onClick={() => waehleVorschlag(place)}
              >
                <span className={styles.suggestionName}>{place.name}</span>
                {place.context && (
                  <span className={styles.suggestionContext}>
                    {place.context}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Ohne Zugangsschlüssel wird ein Link nicht abgerufen (req-028);
          die Suche nach einem Begriff läuft weiter. */}
      {istLink && !hasGoogleKey && (
        <p className={styles.hint} data-testid="anlegezeile-kein-schluessel">
          {apiKeyMissingHint("google")}
        </p>
      )}
      {nachschlagLaeuft && (
        <p className={styles.hint} data-testid="anlegezeile-laeuft">
          Schlägt bei Google nach…
        </p>
      )}
      {(nachschlag.kind === "fehler" || fremderLink) && (
        <p
          className={styles.error}
          role="alert"
          data-testid="anlegezeile-fehler"
        >
          {nachschlag.kind === "fehler"
            ? nachschlag.text
            : GOOGLE_LINK_FAILURE_TEXT.kein_google_link}
        </p>
      )}
      {nachschlag.kind === "uebernommen" && (
        <p className={styles.hint} data-testid="anlegezeile-uebernommen">
          „{nachschlag.name}“ übernommen — das Formular steht offen.
        </p>
      )}

      {/* Der fehlende Schlüssel steht vor dem fehlenden Suchgebiet: er ist
          der Grund, der sich nicht in der Karte beheben lässt (req-028). */}
      {!kiBereit ? (
        <p className={styles.hint} data-testid="ai-search-kein-schluessel">
          {apiKeyMissingHint(!hasAiKey ? "ki_suche" : "google")}
        </p>
      ) : (
        !hasSearchArea && (
          <p className={styles.hint}>
            Für „Mit KI suchen“ zuerst ein Suchgebiet auf der Karte zeichnen.
          </p>
        )
      )}
      {kiSuche.kind === "fertig" && (
        <p className={styles.hint} data-testid="ai-search-result">
          {kiSuche.addedCount} neue POIs angelegt, {kiSuche.discardedCount}{" "}
          Vorschläge verworfen.
        </p>
      )}
      {/* Die POIs sind angelegt, ihre Bilder nicht — das gehört gesagt
          (bug-027). Eine Liste ohne Bilder sieht sonst aus wie das
          Ergebnis. */}
      {kiSuche.kind === "fertig" && kiSuche.fotoProblem && (
        <p className={styles.hint} role="alert" data-testid="ai-search-fotos">
          {GOOGLE_FOTO_PROBLEM_TEXT[kiSuche.fotoProblem]}
        </p>
      )}
      {/* Warum sie fehlschlug, gehört dazu (bug-032): ein blosses „Fehler“
          schickt den Nutzer auf die Suche nach seinem Zugangsschlüssel,
          obwohl der in Ordnung ist (vgl. bug-021, bug-026). */}
      {kiSuche.kind === "fehler" && (
        <p className={styles.hint} role="alert" data-testid="ai-search-error">
          Die Suche ist fehlgeschlagen, die POI-Liste ist unverändert.{" "}
          {aiSearchFehlerText(kiSuche.fehler)}
        </p>
      )}
    </div>
  );
}
