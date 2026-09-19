import { describe, expect, it } from "vitest";
import { GESTE_GRENZE_MS, brauchtGeste, fehlerName } from "./entsperrung";

function domFehler(name: string) {
  const fehler = new Error(name);
  fehler.name = name;
  return fehler;
}

describe("fehlerName (req-066)", () => {
  it("liest den Namen eines DOMException-artigen Fehlers", () => {
    expect(fehlerName(domFehler("NotAllowedError"))).toBe("NotAllowedError");
  });

  it("nennt nichts, wo kein Name steht", () => {
    expect(fehlerName(null)).toBeNull();
    expect(fehlerName("abgebrochen")).toBeNull();
    expect(fehlerName({})).toBeNull();
  });
});

describe("brauchtGeste (req-066)", () => {
  it("erkennt die sofortige Weigerung des Browsers", () => {
    expect(brauchtGeste(domFehler("NotAllowedError"), 5)).toBe(true);
  });

  it("haelt einen Abbruch durch den Nutzer nicht dafuer", () => {
    // Niemand nimmt eine Abfrage wahr und tippt sie weg, bevor die Grenze
    // erreicht ist -- so lange gebraucht, war es eine Entscheidung.
    expect(brauchtGeste(domFehler("NotAllowedError"), GESTE_GRENZE_MS)).toBe(
      false,
    );
    expect(brauchtGeste(domFehler("NotAllowedError"), 4000)).toBe(false);
  });

  it("haelt jeden anderen Fehler nicht dafuer", () => {
    expect(brauchtGeste(domFehler("SecurityError"), 1)).toBe(false);
    expect(brauchtGeste(new Error("kaputt"), 1)).toBe(false);
  });
});
