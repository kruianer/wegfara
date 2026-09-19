// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  PASSKEY_GRUND,
  PasskeyFehler,
  passkeyFehlerText,
  passkeyGrundText,
  serverFehler,
} from "./passkey-fehler";

function domFehler(name: string) {
  const fehler = new Error(name);
  fehler.name = name;
  return fehler;
}

describe("passkeyFehlerText (req-066)", () => {
  it("nennt jeden Grund anders", () => {
    const gruende = [
      "NotAllowedError",
      "InvalidStateError",
      "ConstraintError",
      "NotSupportedError",
      "SecurityError",
      "AbortError",
      "TimeoutError",
      "UnknownError",
    ].map((name) => passkeyFehlerText(domFehler(name), "einrichten"));

    // Kein Satz, der fuer jeden Grund derselbe ist -- genau das war das
    // Muster hinter bug-046.
    expect(new Set(gruende).size).toBe(gruende.length);
  });

  it("erklaert einen bereits hinterlegten Passkey", () => {
    expect(
      passkeyFehlerText(domFehler("InvalidStateError"), "einrichten"),
    ).toContain("bereits ein Passkey hinterlegt");
  });

  it("erklaert ein Geraet ohne eingerichtete Entsperrung", () => {
    expect(
      passkeyFehlerText(domFehler("ConstraintError"), "einrichten"),
    ).toContain("keine Entsperrung eingerichtet");
  });

  it("unterscheidet Einrichten und Anmelden", () => {
    expect(
      passkeyFehlerText(domFehler("NotSupportedError"), "einrichten"),
    ).not.toBe(passkeyFehlerText(domFehler("NotSupportedError"), "anmelden"));
  });

  it("nennt auch einen unbekannten Fehler beim Namen", () => {
    // Ein Name, den man nachschlagen kann, ist mehr als "hat nicht geklappt".
    expect(
      passkeyFehlerText(domFehler("NagelneuerError"), "anmelden"),
    ).toContain("NagelneuerError");
  });

  it("gibt den Grund des Servers unveraendert weiter", () => {
    const text = passkeyGrundText(PASSKEY_GRUND.passkeyUnbekannt, "anmelden");

    expect(passkeyFehlerText(new PasskeyFehler(text), "anmelden")).toBe(text);
  });
});

describe("passkeyGrundText (req-066)", () => {
  it("nennt jeden Schritt anders", () => {
    const texte = Object.values(PASSKEY_GRUND).map((grund) =>
      passkeyGrundText(grund, "einrichten"),
    );

    expect(new Set(texte).size).toBe(texte.length);
  });
});

describe("serverFehler (req-066)", () => {
  it("uebernimmt den Grund aus der Antwort", async () => {
    const antwort = Response.json(
      { error: "Die Aufforderung war abgelaufen." },
      { status: 401 },
    );

    const fehler = await serverFehler(antwort, "anmelden");

    expect(fehler.message).toBe("Die Aufforderung war abgelaufen.");
  });

  it("nennt wenigstens den Status, wenn die Antwort keinen Grund traegt", async () => {
    const antwort = new Response("kaputt", { status: 503 });

    const fehler = await serverFehler(antwort, "einrichten");

    expect(fehler.message).toContain("503");
  });
});
