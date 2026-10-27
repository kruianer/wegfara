import Anthropic from "@anthropic-ai/sdk";
import type {
  AiChatAnfrage,
  AiChatClient,
  ChatStromStueck,
} from "./chat-client";
import { aiFehlerLogZeile, type AiFehler } from "./fehler";
import type {
  AiModellKatalog,
  KatalogErgebnis,
  KatalogModell,
} from "./modell-katalog";
import { aiFehlerAusSdk } from "./sdk-fehler";

/**
 * Die Anbindung an Anthropic fuer das Chatfenster im Planer (req-081).
 *
 * Sie liegt hinter der austauschbaren Schnittstelle AiChatClient -- aus der
 * Anwendungslogik geht kein Aufruf direkt ins SDK (stack.md). Hier steht
 * keine Modellkennung: welche es gibt, sagt der Dienst selbst (req-090,
 * createAnthropicModellKatalog), und welches antwortet, entscheidet der
 * Aufrufer.
 *
 * Das SDK wird mit Werkzeugen im Blick gewaehlt (req-081, Constraints) -- in
 * diesem Schritt bekommt die KI aber keine: keine Werkzeuge, keine Reisedaten
 * im Zusammenhang. Sie antwortet auf das Geschriebene, nichts weiter.
 */

/**
 * Wie lang eine Antwort hoechstens werden darf. Eine Obergrenze gehoert dazu
 * -- ohne sie kann eine einzelne Antwort beliebig teuer werden. Fuer eine
 * Unterhaltung ist das reichlich; die Antwort wird gestroemt, ein
 * Zeitueberlauf der Anfrage droht deshalb nicht.
 *
 * Nachdenken zaehlt beim Dienst gegen dieselbe Grenze wie der Antworttext
 * (bug-061) -- bei hohem Denkaufwand (voreingestellt bei Opus 5 und Sonnet
 * 5, req-081) reichten 8192 Token nicht. Der Wert ist Anthropics eigenes
 * Beispiel fuer eine Grenze mit Luft fuer beides.
 */
const MAX_TOKENS = 16000;

/**
 * Wer antwortet. Bewusst kurz und ohne eine einzige Angabe zur geoeffneten
 * Reise: Reisedaten im Zusammenhang sind ausdruecklich nicht Teil dieses
 * Schritts (req-081, Out of Scope). Der letzte Satz haelt die Antworten
 * ehrlich -- wer nach dem Plan fragt, soll keine erfundene Auskunft bekommen.
 */
export const CHAT_SYSTEM_PROMPT = [
  "Du bist der Gesprächspartner im Reiseplaner von Wegfara und hilfst beim Planen einer Reise.",
  "Antworte auf Deutsch, in ganzen Sätzen und so knapp, wie die Frage es zulässt.",
  "Du kennst die geöffnete Reise nicht und kannst in der App nichts ändern:",
  "Wirst du nach den Daten dieser Reise gefragt oder darum gebeten, etwas zu tun, sage das offen statt zu raten.",
].join(" ");

export interface AnthropicOptions {
  /**
   * Der Zugangsschluessel des Accounts, in dem gerade gearbeitet wird
   * (req-028). Er wird immer mitgegeben -- es gibt hier kein Ausweichen auf
   * eine Umgebungsvariable, damit kein Account auf Kosten eines anderen
   * redet.
   */
  apiKey: string;
  /**
   * Wird ausschliesslich von Tests gesetzt, um ohne echten Netzwerkzugriff
   * zu laufen (siehe stack.md: externe Dienste werden gemockt).
   */
  fetch?: typeof fetch;
}

/** Bildet einen Fehlschlag des Anthropic-SDK auf einen benannten Grund ab. */
export function aiFehlerAusAnthropic(error: unknown): AiFehler {
  return aiFehlerAusSdk(error);
}

/**
 * Ein abgelehnter Inhalt kommt nicht als Fehler, sondern als Antwort mit dem
 * Grund "refusal" zurueck (HTTP 200). Sie wird wie ein Fehlschlag behandelt:
 * die Anfrage ist abgelehnt, und das soll im Verlauf stehen (req-081) statt
 * als leere Antwort zu erscheinen.
 */
const ABGELEHNT_DETAIL = "Der Dienst hat die Anfrage abgelehnt (refusal).";

/**
 * `stop_reason: "max_tokens"` heisst: die Grenze aus MAX_TOKENS wurde
 * erreicht, egal ob durch Nachdenken, Antworttext oder beides zusammen
 * (bug-061). Was bis dahin an Text kam, bleibt nicht als vollstaendige
 * Antwort stehen -- dasselbe Muster wie bei "refusal".
 */
const ABGESCHNITTEN_DETAIL =
  "Der Dienst hat die Token-Grenze (max_tokens) erreicht, bevor die Antwort fertig war.";

export function createAnthropicChatClient({
  apiKey,
  fetch,
}: AnthropicOptions): AiChatClient {
  const anthropic = new Anthropic({ apiKey, fetch, maxRetries: 0 });

  /** Der Grund geht an den Aufrufer und ins Log (bug-032). */
  function scheitert(fehler: AiFehler): ChatStromStueck {
    console.error(aiFehlerLogZeile(fehler));
    return { art: "fehler", fehler };
  }

  async function* antworte(
    anfrage: AiChatAnfrage,
  ): AsyncIterable<ChatStromStueck> {
    // Das Modell bekommt keine Werkzeuge (req-081, Constraints). "thinking"
    // und "effort" bleiben unberuehrt: jedes Modell hat dafuer andere
    // erlaubte Werte, und die Vorgabe des Dienstes ist bei allen nutzbar --
    // eine eigene Einstellung waere je Modell eine andere und damit eine
    // zweite Liste, die veraltet.
    let gab = 0;
    try {
      const strom = anthropic.messages.stream({
        model: anfrage.modell,
        max_tokens: MAX_TOKENS,
        system: CHAT_SYSTEM_PROMPT,
        messages: anfrage.verlauf.map((nachricht) => ({
          role:
            nachricht.rolle === "ich"
              ? ("user" as const)
              : ("assistant" as const),
          content: nachricht.text,
        })),
      });

      for await (const ereignis of strom) {
        if (
          ereignis.type === "content_block_delta" &&
          ereignis.delta.type === "text_delta" &&
          ereignis.delta.text.length > 0
        ) {
          gab += ereignis.delta.text.length;
          yield { art: "text", text: ereignis.delta.text };
          continue;
        }
        // Die Pruefung auf unerlaubte Inhalte kann mitten im Strom
        // eingreifen. Was bis dahin kam, bleibt stehen; dahinter steht der
        // Grund.
        if (
          ereignis.type === "message_delta" &&
          ereignis.delta.stop_reason === "refusal"
        ) {
          yield scheitert({
            art: "anfrage",
            detail:
              ereignis.delta.stop_details?.explanation ?? ABGELEHNT_DETAIL,
          });
          return;
        }
        // Nachdenken und Antworttext zaehlen gemeinsam gegen MAX_TOKENS
        // (bug-061) -- was bis dahin an Text kam, darf nicht als
        // vollstaendige Antwort im Verlauf landen.
        if (
          ereignis.type === "message_delta" &&
          ereignis.delta.stop_reason === "max_tokens"
        ) {
          yield scheitert({
            art: "abgeschnitten",
            detail: ABGESCHNITTEN_DETAIL,
          });
          return;
        }
      }
    } catch (error) {
      yield scheitert(aiFehlerAusAnthropic(error));
      return;
    }

    // Der Dienst hat geantwortet, aber ohne ein Wort -- auch das ist ein
    // Fehlschlag mit Namen und keine leere Antwort im Verlauf (bug-032).
    if (gab === 0) {
      yield scheitert({ art: "leer", detail: "Antwort ohne Inhalt." });
    }
  }

  return { antworte };
}

/**
 * Wie lange die Frage nach dem Katalog hoechstens dauern darf (req-090).
 * Haengt der Dienst, soll das Chatfenster nicht mit ihm haengen -- es zeigt
 * dann das laufende Modell und den Hinweis, dass die Liste fehlt.
 */
const KATALOG_ZEITGRENZE_MS = 10_000;

/**
 * Der Katalog der Modelle bei Anthropic (req-090), ueber `models.list()` aus
 * dem SDK -- keine eigene HTTP-Anfrage. Die Seiten des Katalogs holt das SDK
 * selbst nacheinander; die Reihenfolge ist die des Dienstes, die neueren
 * zuerst.
 */
export function createAnthropicModellKatalog({
  apiKey,
  fetch,
}: AnthropicOptions): AiModellKatalog {
  const anthropic = new Anthropic({
    apiKey,
    fetch,
    maxRetries: 0,
    timeout: KATALOG_ZEITGRENZE_MS,
  });

  async function liste(): Promise<KatalogErgebnis> {
    try {
      const modelle: KatalogModell[] = [];
      for await (const modell of anthropic.models.list({ limit: 1000 })) {
        modelle.push({
          id: modell.id,
          name: modell.display_name,
          lebenslauf: modell.lifecycle,
          reihe: modell.line,
          maxEingabeTokens: modell.max_input_tokens,
        });
      }
      return { modelle, fehler: null };
    } catch (error) {
      const fehler = aiFehlerAusAnthropic(error);
      console.error(`modell-katalog: ${aiFehlerLogZeile(fehler)}`);
      return { modelle: null, fehler };
    }
  }

  return { liste };
}
