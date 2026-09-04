import { describe, expect, it } from "vitest";
import { apiKeyMissingHint, apiKeyStateText } from "./types";

describe("apiKeyStateText (req-028)", () => {
  it("nennt einen gesetzten Schlüssel mit seinen letzten vier Zeichen", () => {
    expect(apiKeyStateText({ kind: "ki_suche", lastFour: "a3f9" })).toBe(
      "Gesetzt (…a3f9)",
    );
  });

  it("nennt einen fehlenden Schlüssel als nicht gesetzt", () => {
    expect(apiKeyStateText({ kind: "google", lastFour: null })).toBe(
      "Nicht gesetzt",
    );
  });
});

describe("apiKeyMissingHint (req-028, req-032)", () => {
  it("verweist auf den Bereich, in dem der Schlüssel hinterlegt wird", () => {
    const hinweis = apiKeyMissingHint("ki_suche");

    expect(hinweis).toContain("KI-Suche");
    // Seit req-032 stehen die Zugangsschluessel im Bereich "Account" -- der
    // Hinweis schickt niemanden mehr in die Einstellungen.
    expect(hinweis).toContain("im Bereich „Account“");
    expect(hinweis).not.toContain("Einstellungen");
  });
});
