import OpenAI from "openai";
import type { AiClient } from "./client";

/**
 * Modellname an genau dieser Stelle (siehe stack.md), uebersteuerbar per
 * Umgebungsvariable OPENAI_MODEL.
 */
const DEFAULT_MODEL = "gpt-5.6-luna";

/**
 * `fetchImpl` wird ausschliesslich von Tests gesetzt, um ohne echten
 * Netzwerkzugriff zu laufen (siehe stack.md: externe Dienste werden
 * gemockt).
 */
export function createOpenAiClient(fetchImpl?: typeof fetch): AiClient {
  let openai: OpenAI | undefined;

  return {
    async complete(prompt: string): Promise<string | null> {
      try {
        openai ??= new OpenAI({
          apiKey: process.env.OPENAI_API_KEY,
          fetch: fetchImpl,
          maxRetries: 0,
        });
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

export const openAiClient: AiClient = createOpenAiClient();
