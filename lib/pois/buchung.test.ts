import { describe, expect, it } from "vitest";
import {
  buchungKennzeichen,
  isPoiBuchung,
  poiBuchung,
  POI_BUCHUNGEN,
  VORGEGEBENE_BUCHUNG,
} from "./buchung";

describe("poiBuchung (req-061)", () => {
  it("gibt einem POI ohne Angabe 'Nicht nötig'", () => {
    expect(poiBuchung({})).toBe("nicht_noetig");
    expect(VORGEGEBENE_BUCHUNG).toBe("nicht_noetig");
  });

  it("liefert den gesetzten Buchungsstatus", () => {
    expect(poiBuchung({ buchung: "offen" })).toBe("offen");
    expect(poiBuchung({ buchung: "gebucht" })).toBe("gebucht");
  });
});

describe("buchungKennzeichen (req-061)", () => {
  it("nennt einen offenen und einen gebuchten Ort", () => {
    expect(buchungKennzeichen({ buchung: "offen" })).toBe("Offen");
    expect(buchungKennzeichen({ buchung: "gebucht" })).toBe("Gebucht");
  });

  it("gibt 'Nicht nötig' kein Kennzeichen — sonst trüge jeder Strand eines", () => {
    expect(buchungKennzeichen({ buchung: "nicht_noetig" })).toBeNull();
    expect(buchungKennzeichen({})).toBeNull();
  });
});

describe("isPoiBuchung (req-061)", () => {
  it("erkennt die drei Zustände", () => {
    expect(POI_BUCHUNGEN.every(isPoiBuchung)).toBe(true);
  });

  it("weist alles Übrige ab", () => {
    expect(isPoiBuchung("storniert")).toBe(false);
    expect(isPoiBuchung(7)).toBe(false);
    expect(isPoiBuchung(undefined)).toBe(false);
  });
});
