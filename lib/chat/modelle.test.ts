import { describe, expect, it } from "vitest";
import {
  CHAT_MODELLE,
  VORGEWAEHLTES_CHAT_MODELL,
  chatModellLabel,
  istChatModell,
} from "./modelle";

describe("Modelle des Chats (req-081)", () => {
  it("fuehrt genau die drei Modelle von Anthropic", () => {
    expect(CHAT_MODELLE.map((modell) => modell.label)).toEqual([
      "Opus 5",
      "Sonnet 5",
      "Haiku 4.5",
    ]);
  });

  it("nennt zu jedem, wofuer man es nimmt", () => {
    expect(CHAT_MODELLE.map((modell) => modell.eignung)).toEqual([
      "stark, teuer",
      "ausgewogen",
      "schnell, günstig",
    ]);
  });

  it("beginnt eine Unterhaltung mit dem ausgewogenen Modell", () => {
    expect(VORGEWAEHLTES_CHAT_MODELL).toBe("claude-sonnet-5");
    expect(istChatModell(VORGEWAEHLTES_CHAT_MODELL)).toBe(true);
  });

  it("nimmt kein Modell an, das nicht in der Liste steht", () => {
    expect(istChatModell("gpt-5.6-luna")).toBe(false);
    expect(istChatModell("")).toBe(false);
    expect(istChatModell(undefined)).toBe(false);
    expect(istChatModell(null)).toBe(false);
    expect(istChatModell(42)).toBe(false);
  });

  it("hat zu jeder Kennung genau einen Eintrag", () => {
    const ids = CHAT_MODELLE.map((modell) => modell.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("macht aus der Kennung den Namen, den der Verlauf zeigt", () => {
    expect(chatModellLabel("claude-opus-5")).toBe("Opus 5");
    expect(chatModellLabel("claude-haiku-4-5")).toBe("Haiku 4.5");
  });

  /**
   * Eine Antwort aus einem abgeloesten Modell soll ihre Herkunft behalten --
   * gespeichert ist die Kennung, und die bleibt lesbar, auch wenn das Modell
   * nicht mehr in der Auswahl steht.
   */
  it("laesst eine abgeloeste Kennung stehen, wie sie ist", () => {
    expect(chatModellLabel("claude-opus-4-8")).toBe("claude-opus-4-8");
  });
});
