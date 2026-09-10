import { describe, expect, it } from "vitest";
import {
  GOOGLE_FOTO_PROBLEM_TEXT,
  istGoogleFotoProblem,
  schwereresProblem,
} from "./google-foto-problem";

describe("GOOGLE_FOTO_PROBLEM_TEXT (bug-027)", () => {
  it("hat zu jedem Grund einen Satz, der nicht leer ist", () => {
    for (const text of Object.values(GOOGLE_FOTO_PROBLEM_TEXT)) {
      expect(text.trim().length).toBeGreaterThan(0);
    }
  });
});

describe("istGoogleFotoProblem", () => {
  it("erkennt die bekannten Gruende", () => {
    expect(istGoogleFotoProblem("ablage_fehlt")).toBe(true);
    expect(istGoogleFotoProblem("nicht_gespeichert")).toBe(true);
    expect(istGoogleFotoProblem("nicht_geholt")).toBe(true);
  });

  it("laesst alles Unbekannte liegen -- eine Meldung ohne Text waere schlimmer", () => {
    expect(istGoogleFotoProblem("irgendwas")).toBe(false);
    expect(istGoogleFotoProblem(null)).toBe(false);
    expect(istGoogleFotoProblem(undefined)).toBe(false);
    expect(istGoogleFotoProblem(7)).toBe(false);
  });
});

describe("schwereresProblem", () => {
  it("nennt den Grund, an dem der Betreiber etwas aendern muss", () => {
    expect(schwereresProblem("nicht_geholt", "nicht_gespeichert")).toBe(
      "nicht_gespeichert",
    );
    expect(schwereresProblem("nicht_gespeichert", "ablage_fehlt")).toBe(
      "ablage_fehlt",
    );
    expect(schwereresProblem("ablage_fehlt", "nicht_geholt")).toBe(
      "ablage_fehlt",
    );
  });

  it("laesst einen fehlenden Grund weg", () => {
    expect(schwereresProblem(null, "nicht_geholt")).toBe("nicht_geholt");
    expect(schwereresProblem("nicht_geholt", null)).toBe("nicht_geholt");
    expect(schwereresProblem(null, null)).toBeNull();
  });
});
