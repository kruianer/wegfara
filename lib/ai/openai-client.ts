import OpenAI from "openai";
import type { AiClient } from "./client";

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

export function createOpenAiClient({ apiKey, fetch }: OpenAiOptions): AiClient {
  let openai: OpenAI | undefined;

  return {
    async complete(prompt: string): Promise<string | null> {
      try {
        openai ??= new OpenAI({ apiKey, fetch, maxRetries: 0 });
        const response = await openai.chat.completions.create({
          model: process.env.OPENAI_MODEL ?? DEFAULT_MODEL,
          messages: [{ role: "user", content: prompt }],
        });
        return response.choices[0]?.message?.content ?? null;
      } catch {
        return null;
      }
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
  const key = process.env.OPENAI_API_KEY;
  return key && key.length > 0 ? key : null;
}
