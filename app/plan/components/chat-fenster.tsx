"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { AiFehlerArt } from "@/lib/ai/fehler";
import { AI_FEHLER_TEXT, WEB_SUCHE_FEHLER_TEXT } from "@/lib/ai/fehler";
import type { WebSucheFehlerArt } from "@/lib/ai/fehler";
import { apiKeyMissingHint } from "@/lib/api-keys/types";
import { MEIN_BEREICH_PATH } from "@/lib/auth/paths";
import {
  chatModellBeschriftung,
  chatModellLabel,
  vorgewaehltesChatModell,
} from "@/lib/chat/modelle";
import {
  holeChatModelle,
  holeChatVerlauf,
  sendeChatFrage,
  type ChatModelleAntwort,
} from "@/lib/chat/senden";
import { CHAT_MAX_ZEICHEN, zuSendenderText } from "@/lib/chat/validate";
import type { ChatNachricht, ChatQuelle } from "@/lib/chat/types";
import { ChatVerwerfenDialog } from "./chat-verwerfen-dialog";
import styles from "./chat-fenster.module.css";

/**
 * Das Chatfenster des Planers (req-081): oben die Modellauswahl, darunter der
 * Verlauf, unten das Feld zum Schreiben.
 *
 * Der Verlauf kommt von der Schnittstelle und nicht aus der Seite: er gehoert
 * der Reise, ueberdauert das Neuladen und wird beim Wechsel der Reise neu
 * geholt. Die Antwort wird gelesen, waehrend sie entsteht -- bei laengeren
 * Antworten entstuende sonst der Eindruck, es haenge.
 */

export const VERLAUF_LEER_HINWEIS =
  "Noch keine Unterhaltung. Schreibe die erste Nachricht.";

export const VERLAUF_LADEFEHLER =
  "Die Unterhaltung dieser Reise ließ sich nicht holen. Bitte die Seite neu laden.";

/**
 * Waehrend das Modell im Web sucht (req-092) -- in der Art der uebrigen
 * leisen Hinweise, am Eintrag der entstehenden Antwort.
 */
export const SUCHT_IM_WEB = "sucht im Web …";

/** Solange die Liste geholt wird und noch kein Modell feststeht. */
export const MODELLE_WERDEN_GEHOLT = "Modelle werden geholt…";

/**
 * Der Hinweis, wenn die Liste der Modelle nicht zu holen war (req-090): in
 * Worten und sichtbar, keine stille Verkuerzung auf einen Eintrag.
 */
export const MODELLE_FEHLEN_HINWEIS =
  "Die Liste der Modelle ließ sich gerade nicht holen. Zur Wahl steht nur das Modell, mit dem die Unterhaltung läuft.";

/** Derselbe Fall, wenn noch keine Unterhaltung mit einem Modell lief. */
export const MODELLE_FEHLEN_OHNE_MODELL =
  "Die Liste der Modelle ließ sich gerade nicht holen. Bitte später erneut versuchen.";

/**
 * Die Quellen einer Antwort, die auf einer Web-Suche beruht (req-092): als
 * Liste kleiner Verweise unter der Antwort, mit dem Titel der Seite und
 * ihrer Adresse. Sie oeffnen in einem neuen Reiter -- der Planer bleibt
 * stehen. Ohne Quellen steht nichts da, auch keine leere Zeile.
 */
function ChatQuellen({ quellen }: { quellen: ChatQuelle[] }) {
  if (quellen.length === 0) return null;
  return (
    <ul className={styles.quellen} aria-label="Quellen">
      {quellen.map((quelle) => (
        <li key={quelle.url} className={styles.quelleZeile}>
          <a
            className={styles.quelle}
            href={quelle.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            <span className={styles.quelleTitel}>{quelle.titel}</span>
            <span className={styles.quelleAdresse}>{quelle.url}</span>
          </a>
        </li>
      ))}
    </ul>
  );
}

/**
 * Warum eine Suche waehrend der Antwort scheiterte (req-092). Die Antwort
 * darueber bleibt stehen; der Grund steht leise darunter, wie die uebrigen
 * Hinweise am Eintrag.
 */
function SucheFehler({ grund }: { grund: WebSucheFehlerArt | null }) {
  if (grund === null) return null;
  return (
    <p className={styles.sucheFehler} role="note">
      {WEB_SUCHE_FEHLER_TEXT[grund]}
    </p>
  );
}

/** Das Modell der letzten Antwort im Verlauf -- damit laeuft die Unterhaltung. */
function letztesAntwortModell(nachrichten: ChatNachricht[]): string | null {
  for (let i = nachrichten.length - 1; i >= 0; i -= 1) {
    const modell = nachrichten[i].modell;
    if (modell !== null) return modell;
  }
  return null;
}

export function ChatFenster({
  tripId,
  hasAnthropicKey,
  modell,
  onModellChange,
}: {
  /** Die geoeffnete Reise -- ihr gehoert der Verlauf (req-081). */
  tripId: string;
  /**
   * Ob der Account einen Anthropic-Zugangsschluessel hinterlegt hat
   * (req-028). Ohne ihn zeigt das Fenster kein leeres Feld, in das man
   * vergeblich schreibt, sondern den Grund und den Weg zum Hinterlegen.
   */
  hasAnthropicKey: boolean;
  /**
   * Das gewaehlte Modell -- null, solange keines gewaehlt wurde; dann gilt
   * das der laufenden Unterhaltung oder die Vorwahl aus dem Katalog
   * (req-090). Es liegt in PlanView und nicht hier: ein Sprung in einen
   * anderen Bereich des Planers unmountet das Fenster, und die Wahl gehoert
   * zur Unterhaltung und nicht zur Ansicht.
   */
  modell: string | null;
  onModellChange: (modell: string) => void;
}) {
  const [nachrichten, setNachrichten] = useState<ChatNachricht[]>([]);
  const [ladeFehler, setLadeFehler] = useState(false);
  // Die entstehende Antwort, Stueck fuer Stueck -- null heisst: es entsteht
  // gerade keine.
  const [entstehend, setEntstehend] = useState<string | null>(null);
  // Ob das Modell gerade im Web sucht (req-092) -- bis der naechste Text
  // kommt oder die Antwort endet.
  const [sucht, setSucht] = useState(false);
  // Warum eine Suche der entstehenden Antwort scheiterte (req-092) -- die
  // Antwort laeuft weiter, der Grund steht schon dabei.
  const [sucheFehler, setSucheFehler] = useState<WebSucheFehlerArt | null>(
    null,
  );
  // Der Grund, warum die letzte Antwort nicht zustande kam (bug-032). Er
  // steht an der Stelle, an der die Antwort stuende, und wird nicht
  // gespeichert: die Frage daneben ist es, und die laesst sich erneut senden.
  const [fehler, setFehler] = useState<AiFehlerArt | null>(null);
  // Die Frage, auf die keine Antwort kam -- sie laesst sich erneut senden,
  // ohne sie noch einmal zu tippen (req-081). null heisst: keine offen.
  const [offeneFrage, setOffeneFrage] = useState<string | null>(null);
  const [eingabe, setEingabe] = useState("");
  const [laeuft, setLaeuft] = useState(false);
  // Ob die Rueckfrage vor dem Verwerfen offen steht (req-081).
  const [verwirft, setVerwirft] = useState(false);
  // Die Modelle, die der Dienst anbietet (req-090) -- null, solange sie
  // geholt werden.
  const [auswahl, setAuswahl] = useState<ChatModelleAntwort | null>(null);
  const verlaufRef = useRef<HTMLDivElement>(null);

  // Beim Wechsel der Reise den Stand der vorigen waehrend des Renderns fallen
  // lassen (siehe react.dev/learn/you-might-not-need-an-effect, wie in
  // pois-view.tsx): die Komponente bleibt dabei gemountet, ihr Zustand waere
  // sonst der der vorigen Reise -- fuer einen Augenblick stuende deren
  // Unterhaltung unter dem Namen der neuen.
  const [syncedTripId, setSyncedTripId] = useState(tripId);
  if (tripId !== syncedTripId) {
    setSyncedTripId(tripId);
    setNachrichten([]);
    setEntstehend(null);
    setSucht(false);
    setSucheFehler(null);
    setFehler(null);
    setOffeneFrage(null);
    setVerwirft(false);
    setLadeFehler(false);
  }

  // Der Verlauf der geoeffneten Reise -- beim Wechsel wird der der neuen
  // geholt. Die Antwort auf eine ueberholte Anfrage wird verworfen.
  useEffect(() => {
    let aktuell = true;
    void holeChatVerlauf(tripId).then((geholt) => {
      if (!aktuell) return;
      if (geholt === null) {
        setLadeFehler(true);
        return;
      }
      setNachrichten(geholt);
    });
    return () => {
      aktuell = false;
    };
  }, [tripId]);

  // Die Modellauswahl kommt vom Dienst, ueber den Server (req-090). Ohne
  // Zugangsschluessel wird gar nicht erst gefragt -- der Server koennte es
  // auch nicht.
  useEffect(() => {
    if (!hasAnthropicKey) return;
    let aktuell = true;
    void holeChatModelle().then((geholt) => {
      if (aktuell) setAuswahl(geholt);
    });
    return () => {
      aktuell = false;
    };
  }, [hasAnthropicKey]);

  const katalog = auswahl?.modelle ?? null;
  // Womit die Unterhaltung laeuft: die eigene Wahl, sonst das Modell der
  // letzten Antwort.
  const laufend = modell ?? letztesAntwortModell(nachrichten);
  // Steht der Katalog, gilt das laufende Modell nur, wenn es darin zur Wahl
  // steht -- sonst die Vorwahl, das neueste Sonnet. Ohne Katalog gilt das
  // laufende, denn ein anderes ist nicht bekannt.
  const gewaehlt = katalog
    ? laufend !== null && katalog.some((eintrag) => eintrag.id === laufend)
      ? laufend
      : vorgewaehltesChatModell(katalog)
    : laufend;
  const eintraege = katalog
    ? katalog.map((eintrag) => ({
        id: eintrag.id,
        text: chatModellBeschriftung(eintrag),
      }))
    : gewaehlt !== null
      ? [{ id: gewaehlt, text: gewaehlt }]
      : [];
  const wirdGeholt = hasAnthropicKey && auswahl === null;
  const listeFehlt = hasAnthropicKey && auswahl?.grund === "dienst";

  // Der Verlauf laeuft nach unten mit: das Neueste steht unten, und waehrend
  // eine Antwort waechst, soll man ihr nicht nachscrollen muessen.
  useEffect(() => {
    const spur = verlaufRef.current;
    if (spur) spur.scrollTop = spur.scrollHeight;
  }, [nachrichten, entstehend, fehler]);

  async function frageSenden(text: string, wiederholen = false) {
    if (
      laeuft ||
      gewaehlt === null ||
      text.length === 0 ||
      text.length > CHAT_MAX_ZEICHEN
    ) {
      return;
    }

    setLaeuft(true);
    setFehler(null);
    // Die entstehende Antwort beginnt leer: das Feld steht im Verlauf, sobald
    // die Frage abgelegt ist, und waechst von dort.
    setEntstehend("");
    await sendeChatFrage(
      { tripId, text, modell: gewaehlt, wiederholen },
      {
        // Die Frage kommt beim erneuten Versuch mit der Kennung zurueck, die
        // sie schon im Verlauf hat -- dann steht sie dort bereits.
        frage: (nachricht) =>
          setNachrichten((bisher) =>
            bisher.some((vorhanden) => vorhanden.id === nachricht.id)
              ? bisher
              : [...bisher, nachricht],
          ),
        text: (stueck) => {
          setSucht(false);
          setEntstehend((bisher) => (bisher ?? "") + stueck);
        },
        suche: () => setSucht(true),
        sucheFehler: (grund) => {
          setSucht(false);
          setSucheFehler(grund);
        },
        antwort: (nachricht) => {
          setSucht(false);
          setEntstehend(null);
          setNachrichten((bisher) => [...bisher, nachricht]);
          setOffeneFrage(null);
        },
        fehler: (grund) => {
          setSucht(false);
          setEntstehend(null);
          setFehler(grund);
          // Die Frage bleibt stehen und laesst sich erneut senden (req-081)
          // -- ohne sie noch einmal zu tippen.
          setOffeneFrage(text);
        },
      },
    );
    setSucht(false);
    setSucheFehler(null);
    setLaeuft(false);
  }

  function senden() {
    const text = zuSendenderText(eingabe);
    if (text === null) return;
    setEingabe("");
    void frageSenden(text);
  }

  /** Die Unterhaltung ist verworfen -- der Verlauf beginnt von vorn. */
  function verworfen() {
    setNachrichten([]);
    setEntstehend(null);
    setFehler(null);
    setOffeneFrage(null);
    setVerwirft(false);
  }

  // Zu verwerfen gibt es nur etwas, wo etwas steht.
  const etwasDa = nachrichten.length > 0 || fehler !== null;

  return (
    <section className={styles.fenster} aria-label="Chat">
      <header className={styles.kopf}>
        <h2 className={styles.titel}>Chat</h2>
        <div className={styles.kopfAktionen}>
          {/* Eine Unterhaltung laesst sich verwerfen und neu beginnen
              (req-081) -- nach einer Rueckfrage, denn zurueckzuholen ist sie
              nicht. */}
          {etwasDa && (
            <button
              type="button"
              className={styles.verwerfen}
              disabled={laeuft}
              onClick={() => setVerwirft(true)}
            >
              Verwerfen
            </button>
          )}
          {/* Die Auswahl ist sichtbar, ohne dass man suchen muss (req-081),
              und steht offen, auch waehrend eine Antwort entsteht: der
              Wechsel gilt ab der naechsten Frage. Ihre Eintraege nennt der
              Dienst (req-090); solange sie geholt werden, steht darin das
              laufende Modell -- nie eine leere Auswahl. */}
          {(eintraege.length > 0 || wirdGeholt) && (
            <label className={styles.modellwahl}>
              <span className={styles.modellLabel}>Modell</span>
              <select
                className={styles.modellFeld}
                value={gewaehlt ?? ""}
                disabled={eintraege.length === 0}
                onChange={(event) => onModellChange(event.target.value)}
              >
                {eintraege.length === 0 ? (
                  <option value="">{MODELLE_WERDEN_GEHOLT}</option>
                ) : (
                  eintraege.map((eintrag) => (
                    <option key={eintrag.id} value={eintrag.id}>
                      {eintrag.text}
                    </option>
                  ))
                )}
              </select>
            </label>
          )}
        </div>
      </header>
      {listeFehlt && (
        <p className={styles.modellHinweis} role="status">
          {gewaehlt !== null
            ? MODELLE_FEHLEN_HINWEIS
            : MODELLE_FEHLEN_OHNE_MODELL}
        </p>
      )}

      <div
        className={styles.verlauf}
        data-testid="chat-verlauf"
        ref={verlaufRef}
        // Ein Vorleseprogramm soll die Antwort mitbekommen, ohne dass man
        // danach sucht -- aber nicht jedes Stueck einzeln vorlesen.
        role="log"
        aria-live="polite"
        aria-busy={laeuft}
      >
        {ladeFehler && (
          <p className={styles.hinweis} role="alert">
            {VERLAUF_LADEFEHLER}
          </p>
        )}
        {/* Ohne Schluessel sagt der Grund am Fuss alles -- eine Aufforderung
            zum Schreiben waere dann irre. */}
        {!ladeFehler &&
          hasAnthropicKey &&
          nachrichten.length === 0 &&
          entstehend === null &&
          fehler === null && (
            <p className={styles.hinweis}>{VERLAUF_LEER_HINWEIS}</p>
          )}
        <ol className={styles.liste}>
          {nachrichten.map((nachricht) => (
            <li
              key={nachricht.id}
              className={
                nachricht.rolle === "ich" ? styles.zeileIch : styles.zeileKi
              }
            >
              <div
                className={
                  nachricht.rolle === "ich" ? styles.blaseIch : styles.blaseKi
                }
              >
                {nachricht.text}
              </div>
              <ChatQuellen quellen={nachricht.quellen} />
              <SucheFehler grund={nachricht.sucheFehler} />
              {/* Welche Antwort von welchem Modell kam, steht dabei (req-081). */}
              {nachricht.modell !== null && (
                <p className={styles.herkunft}>
                  {chatModellLabel(nachricht.modell, katalog)}
                </p>
              )}
            </li>
          ))}
          {entstehend !== null && (
            <li className={styles.zeileKi}>
              <div className={styles.blaseKi} data-testid="chat-entstehend">
                {entstehend}
              </div>
              {/* Dass gerade gesucht wird, steht am Eintrag der Antwort
                  (req-092) -- nicht als eigene Nachricht. */}
              {sucht && (
                <p className={styles.herkunft} role="status">
                  {SUCHT_IM_WEB}
                </p>
              )}
              <SucheFehler grund={sucheFehler} />
              <p className={styles.herkunft}>
                {gewaehlt !== null ? chatModellLabel(gewaehlt, katalog) : ""}
              </p>
            </li>
          )}
          {/* Der Grund steht an der Stelle, an der die Antwort stuende
              (req-081) -- die Frage darueber bleibt stehen. */}
          {fehler !== null && (
            <li className={styles.zeileKi}>
              <p className={styles.fehler} role="alert">
                {AI_FEHLER_TEXT[fehler]}
              </p>
              {offeneFrage !== null && (
                <button
                  type="button"
                  className={styles.erneut}
                  disabled={laeuft}
                  onClick={() => void frageSenden(offeneFrage, true)}
                >
                  Erneut senden
                </button>
              )}
            </li>
          )}
        </ol>
      </div>

      {/* Fehlt der Zugangsschluessel, steht hier der Grund und der Weg zum
          Hinterlegen (req-081, req-028) -- und kein Feld, in das man
          vergeblich schreibt. */}
      {!hasAnthropicKey ? (
        <div
          className={styles.keinSchluessel}
          data-testid="chat-kein-schluessel"
        >
          <p className={styles.keinSchluesselText}>
            {apiKeyMissingHint("anthropic")}
          </p>
          <Link className={styles.weg} href={MEIN_BEREICH_PATH}>
            Zu „Mein Bereich“
          </Link>
        </div>
      ) : (
        <form
          className={styles.form}
          aria-label="Nachricht senden"
          onSubmit={(event) => {
            event.preventDefault();
            senden();
          }}
        >
          <textarea
            className={styles.feld}
            aria-label="Nachricht"
            rows={2}
            maxLength={CHAT_MAX_ZEICHEN}
            value={eingabe}
            disabled={laeuft}
            onChange={(event) => setEingabe(event.target.value)}
            // Die Eingabetaste sendet, wie man es von einem Chat erwartet;
            // Shift+Eingabe macht eine neue Zeile.
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                senden();
              }
            }}
          />
          <button
            type="submit"
            className={styles.senden}
            disabled={
              laeuft || gewaehlt === null || zuSendenderText(eingabe) === null
            }
          >
            {laeuft ? "Antwortet…" : "Senden"}
          </button>
        </form>
      )}

      {verwirft && (
        <ChatVerwerfenDialog
          tripId={tripId}
          onVerworfen={verworfen}
          onCancel={() => setVerwirft(false)}
        />
      )}
    </section>
  );
}
