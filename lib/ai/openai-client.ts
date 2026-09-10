import OpenAI from "openai";
import type { AiAntwort, AiClient } from "./client";
import { aiFehlerLogZeile, type AiFehler, type AiFehlerArt } from "./fehler";
import { envGeheimnis, envWert } from "@/lib/env/umgebung";

/**
 * Modellname an genau dieser Stelle (siehe stack.md), uebersteuerbar per
 * Umgebungsvariable OPENAI_MODEL.
 */
const DEFAULT_MODEL = "gpt-5.6-luna";

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

/** Was der Dienst selbst zum Fehlschlag sagt — in seinen eigenen Worten. */
function detailAus(error: unknown): string {
  const kandidat = error as {
    error?: { message?: unknown };
    message?: unknown;
  } | null;
  const ausDemKoerper = kandidat?.error?.message;
  if (typeof ausDemKoerper === "string" && ausDemKoerper.trim().length > 0) {
    return ausDemKoerper.trim();
  }
  if (typeof kandidat?.message === "string" && kandidat.message.trim()) {
    return kandidat.message.trim();
  }
  return String(error);
}

function statusAus(error: unknown): number | null {
  const status = (error as { status?: unknown } | null)?.status;
  return typeof status === "number" ? status : null;
}

function artAus(status: number | null, detail: string): AiFehlerArt {
  // Ohne Status kam nicht einmal eine Antwort zurueck.
  if (status === null) return "netz";
  if (status === 401 || status === 403) return "zugang";
  if (status === 429) return "kontingent";
  if (status === 404) return "modell";
  // Ein 400 sagt genau, was fehlt. Nennt es das Modell, ist es das Modell --
  // genau der Fall aus bug-032.
  if (status === 400) return /model/i.test(detail) ? "modell" : "anfrage";
  if (status >= 500) return "dienst";
  return "anfrage";
}

/** Bildet einen Fehlschlag des OpenAI-SDK auf einen benannten Grund ab (bug-032). */
export function aiFehlerAusOpenAi(error: unknown): AiFehler {
  const detail = detailAus(error);
  return { art: artAus(statusAus(error), detail), detail };
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

  return {
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
