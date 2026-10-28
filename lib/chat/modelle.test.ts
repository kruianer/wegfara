import { describe, expect, it } from "vitest";
import type { KatalogModell } from "../ai/modell-katalog";
import {
  chatModellBeschriftung,
  chatModellLabel,
  istChatModell,
  vorgewaehltesChatModell,
  waehlbareChatModelle,
  type ChatModell,
} from "./modelle";

function katalogModell(
  id: string,
  name: string,
  reihe: string | null,
  lebenslauf: KatalogModell["lebenslauf"] = "active",
): KatalogModell {
  return { id, name, reihe, lebenslauf, maxEingabeTokens: 200000 };
}

/** Wie der Dienst den Katalog nennt: die neueren zuerst. */
const KATALOG: KatalogModell[] = [
  katalogModell("claude-opus-5-5", "Claude Opus 5.5", "opus"),
  katalogModell("claude-sonnet-5-5", "Claude Sonnet 5.5", "sonnet"),
  katalogModell("claude-haiku-5-5", "Claude Haiku 5.5", "haiku"),
  katalogModell("claude-opus-5", "Claude Opus 5", "opus"),
  katalogModell("claude-sonnet-5", "Claude Sonnet 5", "sonnet"),
];

describe("Modelle des Chats -- was zur Wahl steht (req-090)", () => {
  it("nimmt genau die fuenf aktiven Modelle des Dienstes", () => {
    expect(waehlbareChatModelle(KATALOG).map((modell) => modell.id)).toEqual(
      KATALOG.map((modell) => modell.id),
    );
  });

  it("laesst ein abgeschaltetes Modell weg", () => {
    const katalog = [
      ...KATALOG,
      katalogModell("claude-opus-4-1", "Claude Opus 4.1", "opus", "retired"),
    ];
    expect(
      waehlbareChatModelle(katalog).map((modell) => modell.id),
    ).not.toContain("claude-opus-4-1");
  });

  it("laesst ein abgekuendigtes Modell weg", () => {
    const katalog = [
      katalogModell(
        "claude-haiku-4-5",
        "Claude Haiku 4.5",
        "haiku",
        "deprecated",
      ),
      ...KATALOG,
    ];
    expect(
      waehlbareChatModelle(katalog).map((modell) => modell.id),
    ).not.toContain("claude-haiku-4-5");
  });

  it("behaelt die Reihenfolge des Dienstes", () => {
    const umgedreht = [...KATALOG].reverse();
    expect(waehlbareChatModelle(umgedreht).map((modell) => modell.id)).toEqual(
      umgedreht.map((modell) => modell.id),
    );
  });

  it("uebernimmt Name, Reihe und Kontextfenster des Dienstes", () => {
    expect(waehlbareChatModelle(KATALOG)[1]).toEqual({
      id: "claude-sonnet-5-5",
      name: "Claude Sonnet 5.5",
      reihe: "sonnet",
      kontextTokens: 200000,
    });
  });
});

describe("Modelle des Chats -- die Vorwahl (req-090)", () => {
  it("waehlt das neueste aktive Sonnet vor", () => {
    expect(vorgewaehltesChatModell(waehlbareChatModelle(KATALOG))).toBe(
      "claude-sonnet-5-5",
    );
  });

  /** Die Reihe kommt aus dem Feld des Dienstes, nicht aus der Kennung. */
  it("raet die Reihe nicht aus der Kennung", () => {
    const modelle = waehlbareChatModelle([
      katalogModell("claude-opus-5-5", "Claude Opus 5.5", "opus"),
      katalogModell("claude-sonnet-5", "Claude Sonnet 5", null),
    ]);
    expect(vorgewaehltesChatModell(modelle)).toBe("claude-opus-5-5");
  });

  it("nimmt ohne Sonnet das erste aktive Modell", () => {
    const modelle = waehlbareChatModelle([
      katalogModell(
        "claude-sonnet-5",
        "Claude Sonnet 5",
        "sonnet",
        "deprecated",
      ),
      katalogModell("claude-haiku-5-5", "Claude Haiku 5.5", "haiku"),
      katalogModell("claude-opus-5-5", "Claude Opus 5.5", "opus"),
    ]);
    expect(vorgewaehltesChatModell(modelle)).toBe("claude-haiku-5-5");
  });

  it("hat ohne ein Modell keine Vorwahl", () => {
    expect(vorgewaehltesChatModell([])).toBeNull();
  });
});

describe("Modelle des Chats -- welche Kennung gefragt werden darf (req-090)", () => {
  const modelle = waehlbareChatModelle(KATALOG);

  it("nimmt mit Katalog nur, was darin zur Wahl steht", () => {
    expect(istChatModell("claude-sonnet-5-5", modelle)).toBe(true);
    expect(istChatModell("claude-haiku-4-5", modelle)).toBe(false);
  });

  /** Der Ausfall des Katalogs darf den Chat nicht scheitern lassen. */
  it("nimmt ohne Katalog jede wohlgeformte Kennung", () => {
    expect(istChatModell("claude-sonnet-5-5", null)).toBe(true);
    expect(istChatModell("claude-neu-7", null)).toBe(true);
  });

  it("nimmt nie etwas, das keine Kennung ist", () => {
    for (const wert of ["", " ", "a b", "x".repeat(200), undefined, null, 42]) {
      expect(istChatModell(wert, null)).toBe(false);
    }
  });
});

describe("Modelle des Chats -- wie sie dastehen (req-090)", () => {
  const modelle: ChatModell[] = waehlbareChatModelle(KATALOG);

  it("beschriftet mit dem Namen des Dienstes und nicht mit der Kennung", () => {
    const beschriftung = chatModellBeschriftung(modelle[1]);
    expect(beschriftung).toContain("Claude Sonnet 5.5");
    expect(beschriftung).not.toContain("claude-sonnet-5-5");
  });

  it("nennt die Groesse des Kontextfensters, wo sie bekannt ist", () => {
    expect(chatModellBeschriftung(modelle[1])).toBe(
      "Claude Sonnet 5.5 — 200.000 Token Kontext",
    );
    expect(chatModellBeschriftung({ ...modelle[1], kontextTokens: null })).toBe(
      "Claude Sonnet 5.5",
    );
  });

  it("macht aus der Kennung im Verlauf den Namen des Dienstes", () => {
    expect(chatModellLabel("claude-opus-5-5", modelle)).toBe("Claude Opus 5.5");
  });

  /**
   * Eine Antwort aus einem abgeloesten Modell soll ihre Herkunft behalten --
   * gespeichert ist die Kennung, und die bleibt lesbar, auch wenn der Dienst
   * das Modell nicht mehr nennt.
   */
  it("laesst eine Kennung stehen, die der Dienst nicht mehr nennt", () => {
    expect(chatModellLabel("claude-opus-4-8", modelle)).toBe("claude-opus-4-8");
    expect(chatModellLabel("claude-opus-4-8", null)).toBe("claude-opus-4-8");
  });
});
