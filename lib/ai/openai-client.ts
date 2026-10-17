import OpenAI from "openai";
import type { AiAntwort, AiBildAntwort, AiClient } from "./client";
import { aiFehlerLogZeile, type AiFehler } from "./fehler";
import { aiFehlerAusSdk } from "./sdk-fehler";
import { envGeheimnis, envWert } from "@/lib/env/umgebung";

/**
 * Modellname an genau dieser Stelle (siehe stack.md), uebersteuerbar per
 * Umgebungsvariable OPENAI_MODEL.
 */
const DEFAULT_MODEL = "gpt-5.6-luna";

/**
 * Das Modell, das Bilder erzeugt (req-072) — ein anderes als das der Fragen,
 * und wie jenes an genau einer Stelle und per Umgebungsvariable
 * uebersteuerbar (stack.md).
 */
const DEFAULT_IMAGE_MODEL = "gpt-image-1";

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
   * Wird ausschliesslich von Tests gesetzt, um ohne echten Netzwerkzugriff
   * zu laufen (siehe stack.md: externe Dienste werden gemockt).
   */
  fetch?: typeof fetch;
}

/**
 * Das Modell, das gefragt wird. Ein leeres OPENAI_MODEL zaehlt wie ein
 * fehlendes (bug-032) -- sonst ginge `model: ""` hinaus, und OpenAI
 * antwortete mit 400 "you must provide a model parameter".
 */
export function openAiModel(): string {
  return envWert("OPENAI_MODEL") ?? DEFAULT_MODEL;
}

/**
 * Das Bildmodell. Ein leeres OPENAI_IMAGE_MODEL zaehlt wie ein fehlendes —
 * aus demselben Grund wie beim Modell der Fragen (bug-032).
 */
export function openAiBildModell(): string {
  return envWert("OPENAI_IMAGE_MODEL") ?? DEFAULT_IMAGE_MODEL;
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

export function createOpenAiClient({ apiKey, fetch }: OpenAiOptions): AiClient {
  let openai: OpenAI | undefined;

  async function frage(
    prompt: string,
    tools?: OpenAI.Chat.ChatCompletionTool[],
  ): Promise<AiAntwort> {
    try {
      openai ??= new OpenAI({ apiKey, fetch, maxRetries: 0 });
      const response = await openai.chat.completions.create({
        model: openAiModel(),
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
        model: openAiBildModell(),
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
