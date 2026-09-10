import { describe, expect, it } from "vitest";
import {
  AI_SEARCH_FEHLER_TEXT,
  aiSearchFehlerText,
  istAiSearchFehler,
} from "./ai-search-fehler";

describe("AI_SEARCH_FEHLER_TEXT (bug-032)", () => {
  it("kennt zu jedem Grund einen Satz", () => {
    for (const [art, text] of Object.entries(AI_SEARCH_FEHLER_TEXT)) {
      expect(text.length, art).toBeGreaterThan(0);
    }
  });

  /**
   * Kern des Bugs: wo der Zugangsschluessel nicht die Ursache ist, muss der
   * Satz das sagen -- sonst sucht der Nutzer dort weiter (vgl. bug-021,
   * bug-026).
   */
  it("nennt den Zugangsschluessel nur, wo er die Ursache sein kann", () => {
    expect(AI_SEARCH_FEHLER_TEXT.zugang).toContain("Zugangsschlüssel");
    expect(AI_SEARCH_FEHLER_TEXT.modell).toContain(
      "Nicht der Zugangsschlüssel",
    );
    expect(AI_SEARCH_FEHLER_TEXT.dienst).toContain(
      "Nicht der Zugangsschlüssel",
    );
    expect(AI_SEARCH_FEHLER_TEXT.netz).toContain("Nicht der Zugangsschlüssel");
    expect(AI_SEARCH_FEHLER_TEXT.region).toContain(
      "Nicht der Zugangsschlüssel",
    );
  });
});

describe("aiSearchFehlerText (bug-032)", () => {
  it("haengt die Worte des Dienstes an den Satz", () => {
    const text = aiSearchFehlerText({
      art: "modell",
      detail: "you must provide a model parameter",
    });

    expect(text).toContain(AI_SEARCH_FEHLER_TEXT.modell);
    expect(text).toContain("you must provide a model parameter");
  });

  it("laesst den Zusatz weg, wenn der Dienst nichts gesagt hat", () => {
    expect(aiSearchFehlerText({ art: "region", detail: "" })).toBe(
      AI_SEARCH_FEHLER_TEXT.region,
    );
  });
});

describe("istAiSearchFehler", () => {
  it("erkennt einen benannten Grund", () => {
    expect(istAiSearchFehler({ art: "zugang", detail: "abgelehnt" })).toBe(
      true,
    );
  });

  it("weist Unbekanntes ab", () => {
    expect(istAiSearchFehler({ art: "irgendwas", detail: "" })).toBe(false);
    expect(istAiSearchFehler({ art: "zugang" })).toBe(false);
    expect(istAiSearchFehler(null)).toBe(false);
    expect(istAiSearchFehler("zugang")).toBe(false);
  });
});
