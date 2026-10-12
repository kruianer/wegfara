import { describe, expect, it } from "vitest";
import {
  CHAT_ERRORS,
  CHAT_MAX_ZEICHEN,
  chatEingabeFehler,
  zuSendenderText,
} from "./validate";

describe("Eingabe des Chats (req-081)", () => {
  it("nimmt den geschriebenen Text ohne Leerraum am Rand", () => {
    expect(zuSendenderText("  Was kostet der Tag?  ")).toBe(
      "Was kostet der Tag?",
    );
  });

  it("sendet nichts, wo nichts steht", () => {
    expect(zuSendenderText("")).toBeNull();
    expect(zuSendenderText("   \n  ")).toBeNull();
    expect(chatEingabeFehler("   ")).toBe(CHAT_ERRORS.leer);
  });

  it("laesst eine gewoehnliche Nachricht durch", () => {
    expect(chatEingabeFehler("Suche Weingüter bei Bernkastel")).toBeNull();
    expect(chatEingabeFehler("a".repeat(CHAT_MAX_ZEICHEN))).toBeNull();
  });

  it("nennt den Grund, wenn die Nachricht zu lang ist", () => {
    expect(chatEingabeFehler("a".repeat(CHAT_MAX_ZEICHEN + 1))).toBe(
      CHAT_ERRORS.zuLang,
    );
  });
});
