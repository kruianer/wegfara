import OpenAI from "openai";
import type { AiAntwort, AiBildAntwort, AiClient } from "./client";
import { aiFehlerLogZeile, type AiFehler } from "./fehler";
import type {
  AiModellKatalog,
  KatalogErgebnis,
  OpenAiKatalogModell,
} from "./modell-katalog";
import { aiFehlerAusSdk } from "./sdk-fehler";
import { envGeheimnis, envWert } from "@/lib/env/umgebung";

/**
 * Modellname an genau dieser Stelle (siehe stack.md), uebersteuerbar per
 * Umgebungsvariable OPENAI_MODEL -- und seit req-108 vor allem durch die Wahl
 * des Accounts in der Karte "KI-Modelle". Der Standard hier ist der letzte
 * Rueckfall, nicht die Regel.
 */
const DEFAULT_MODEL = "gpt-5.6-luna";

/**
 * Das Modell, das Bilder erzeugt (req-072) — ein anderes als das der Fragen,
 * und wie jenes an genau einer Stelle und per Umgebungsvariable
 * uebersteuerbar (stack.md).
 *
 * Bis bug-076 stand hier gpt-image-1, das OpenAI am 23.10.2026 abgeschaltet
 * hat. Als Ersatz nennt OpenAI gpt-image-2.5-sunburst und -flare; Flare ist
 * das fuer alltaegliches Erzeugen, Sunburst das fuer genaues Bearbeiten --
 * hier wird nur erzeugt.
 */
const DEFAULT_IMAGE_MODEL = "gpt-image-2.5-flare";

/**
 * Die Kantenlaenge eines erzeugten Bildes. Quadratisch, weil es in der
 * POI-Liste, im Formular und im Flyout in quadratischen Flaechen steht.
 */
const IMAGE_SIZE = "1024x1024";

export interface OpenAiOptions {
  /**
   * Der Zugangsschluessel des Accounts, in dem gerade gearbeitet wird
   * (req-028). Er wird immer mitgegeben -- es gibt hier kein Ausweichen auf
   * eine Umgebungsvariable, damit kein Account auf Kosten eines anderen
   * sucht.
   */
  apiKey: string;
  /**
   * Das Modell der Fragen, das der Account gewaehlt hat (req-108). null oder
   * fehlend heisst: nichts gewaehlt -- dann gilt die Umgebung, sonst der
   * Standard.
   */
  modell?: string | null;
  /** Das Bildmodell, das der Account gewaehlt hat (req-108) -- wie `modell`. */
  bildModell?: string | null;
  /**
   * Wird ausschliesslich von Tests gesetzt, um ohne echten Netzwerkzugriff
   * zu laufen (siehe stack.md: externe Dienste werden gemockt).
   */
  fetch?: typeof fetch;
}

/**
 * Das Modell, das gefragt wird -- in dieser Reihenfolge (req-108): die Wahl
 * des Accounts, sonst OPENAI_MODEL, sonst der Standard. Ein leeres
 * OPENAI_MODEL zaehlt wie ein fehlendes (bug-032) -- sonst ginge `model: ""`
 * hinaus, und OpenAI antwortete mit 400 "you must provide a model parameter".
 */
export function openAiModel(gewaehlt: string | null = null): string {
  return gewaehlt || (envWert("OPENAI_MODEL") ?? DEFAULT_MODEL);
}

/**
 * Das Bildmodell, in derselben Reihenfolge wie das der Fragen (req-108). Ein
 * leeres OPENAI_IMAGE_MODEL zaehlt wie ein fehlendes (bug-032).
 */
export function openAiBildModell(gewaehlt: string | null = null): string {
  return gewaehlt || (envWert("OPENAI_IMAGE_MODEL") ?? DEFAULT_IMAGE_MODEL);
}

/**
 * Bildet einen Fehlschlag des OpenAI-SDK auf einen benannten Grund ab
 * (bug-032). Die Abbildung selbst steht seit req-081 in lib/ai/sdk-fehler.ts:
 * das Anthropic-SDK wirft Fehler derselben Gestalt, und zwei Kopien davon
 * liefen auseinander.
 */
export function aiFehlerAusOpenAi(error: unknown): AiFehler {
  return aiFehlerAusSdk(error);
}

export function createOpenAiClient({
  apiKey,
  modell = null,
  bildModell = null,
  fetch,
}: OpenAiOptions): AiClient {
  let openai: OpenAI | undefined;

  async function frage(
    prompt: string,
    tools?: OpenAI.Chat.ChatCompletionTool[],
  ): Promise<AiAntwort> {
    try {
      openai ??= new OpenAI({ apiKey, fetch, maxRetries: 0 });
      const response = await openai.chat.completions.create({
        model: openAiModel(modell),
        messages: [{ role: "user", content: prompt }],
        ...(tools ? { tools } : {}),
      });
      const text = response.choices[0]?.message?.content;
      if (typeof text !== "string" || text.length === 0) {
        return scheitert({ art: "leer", detail: "Antwort ohne Inhalt." });
      }
      return { ok: true, text };
    } catch (error) {
      return scheitert(aiFehlerAusOpenAi(error));
    }
  }

  /**
   * Der Grund geht an den Aufrufer und ins Log: der Nutzer bekommt einen
   * Satz, der Betreiber die Worte des Dienstes (bug-032).
   */
  function scheitert(fehler: AiFehler): AiAntwort {
    console.error(aiFehlerLogZeile(fehler));
    return { ok: false, fehler };
  }

  /**
   * Das erzeugte Bild (req-072). Es kommt als Base64 zurueck und wird hier
   * schon in Bytes verwandelt: der Aufrufer legt eine Datei an, keine
   * Zeichenkette. Kommt nichts oder nur ein Verweis zurueck, gilt das als
   * leere Antwort — ein halbes Bild entsteht nie.
   */
  async function erzeugeBild(prompt: string): Promise<AiBildAntwort> {
    try {
      openai ??= new OpenAI({ apiKey, fetch, maxRetries: 0 });
      const antwort = await openai.images.generate({
        model: openAiBildModell(bildModell),
        prompt,
        n: 1,
        size: IMAGE_SIZE,
      });
      const base64 = antwort.data?.[0]?.b64_json;
      if (typeof base64 !== "string" || base64.length === 0) {
        const fehler: AiFehler = { art: "leer", detail: "Antwort ohne Bild." };
        console.error(aiFehlerLogZeile(fehler));
        return { ok: false, fehler };
      }
      return {
        ok: true,
        bild: {
          data: new Uint8Array(Buffer.from(base64, "base64")),
          contentType: "image/png",
        },
      };
    } catch (error) {
      const fehler = aiFehlerAusOpenAi(error);
      console.error(aiFehlerLogZeile(fehler));
      return { ok: false, fehler };
    }
  }

  return {
    generateImage: (prompt) => erzeugeBild(prompt),
    complete: (prompt) => frage(prompt),
    /**
     * Mit Websuche (req-058). Kennt das Modell das Werkzeug nicht, weist die
     * Schnittstelle die Anfrage ab -- dann wird ohne Suche gefragt, damit
     * ein Modellwechsel die Funktion nicht stillschweigend abschaltet.
     */
    async completeWithWebSearch(prompt) {
      const mitSuche = await frage(prompt, [
        { type: "web_search" } as unknown as OpenAI.Chat.ChatCompletionTool,
      ]);
      return mitSuche.ok ? mitSuche : await frage(prompt);
    },
  };
}

/**
 * Der Schluessel aus den Umgebungsvariablen. Er dient dem Betrieb von
 * Diensten ohne Account-Bezug (req-028, Constraints) -- fuer die KI-Suche
 * eines Accounts (req-014) wird ausschliesslich dessen eigener Schluessel
 * verwendet.
 */
export function environmentOpenAiKey(): string | null {
  return envGeheimnis("OPENAI_API_KEY");
}

/**
 * Wie lange die Frage nach dem Katalog hoechstens dauern darf (req-108) --
 * wie beim Katalog von Anthropic (req-090): haengt der Dienst, soll die Karte
 * "KI-Modelle" nicht mit ihm haengen.
 */
const KATALOG_ZEITGRENZE_MS = 10_000;

/**
 * Das Abschaltdatum aus `shutdown_date` als "YYYY-MM-DD". Das Feld ist
 * optional und steht nicht in den Typen des SDK; genannt wird es als
 * Zeitpunkt in Sekunden oder als Datum. Was sich nicht lesen laesst, zaehlt
 * wie ein fehlendes -- das Modell bleibt dann waehlbar.
 */
export function openAiAbschaltDatum(wert: unknown): string | null {
  if (typeof wert === "number" && Number.isFinite(wert) && wert > 0) {
    return new Date(wert * 1000).toISOString().slice(0, 10);
  }
  if (typeof wert === "string" && wert.trim().length > 0) {
    const zeit = Date.parse(wert);
    return Number.isNaN(zeit)
      ? null
      : new Date(zeit).toISOString().slice(0, 10);
  }
  return null;
}

/**
 * Der Katalog der Modelle bei OpenAI (req-108), ueber `models.list()` aus dem
 * SDK -- keine eigene HTTP-Anfrage. Gefragt wird mit dem Schluessel des
 * Accounts (`ki_suche`), im Server.
 *
 * Bild- und Textmodelle stehen darin in einer Liste, ohne Feld, das sie
 * trennt; geraten wird es nicht aus der Kennung (req-108, Constraints).
 */
export function createOpenAiModellKatalog({
  apiKey,
  fetch,
}: OpenAiOptions): AiModellKatalog<OpenAiKatalogModell> {
  const openai = new OpenAI({
    apiKey,
    fetch,
    maxRetries: 0,
    timeout: KATALOG_ZEITGRENZE_MS,
  });

  async function liste(): Promise<KatalogErgebnis<OpenAiKatalogModell>> {
    try {
      const modelle: OpenAiKatalogModell[] = [];
      for await (const modell of openai.models.list()) {
        modelle.push({
          id: modell.id,
          abschaltungAm: openAiAbschaltDatum(
            (modell as { shutdown_date?: unknown }).shutdown_date,
          ),
        });
      }
      return { modelle, fehler: null };
    } catch (error) {
      const fehler = aiFehlerAusOpenAi(error);
      console.error(`modell-katalog: ${aiFehlerLogZeile(fehler)}`);
      return { modelle: null, fehler };
    }
  }

  return { liste };
}
