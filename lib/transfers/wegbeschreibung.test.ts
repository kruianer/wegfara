import { describe, expect, it } from "vitest";
import { wegbeschreibung, WEGBESCHREIBUNG_MAX_ZEILEN } from "./wegbeschreibung";

/** Die Abschnitte, wie OSRM sie fuer die Kuestenstrasse nennt. */
const AMALFIKUESTE = [
  { strasse: "Via Lorenzo d'Amalfi", distanzKm: 0.3 },
  { strasse: "SS163", distanzKm: 4.2 },
  { strasse: "SS163", distanzKm: 3.8 },
  { strasse: "Via Cristoforo Colombo", distanzKm: 1.1 },
  { strasse: "Via Pasitea", distanzKm: 2.4 },
  { strasse: "Viale Pasitea", distanzKm: 0.6 },
  { strasse: "Via Cristoforo Colombo", distanzKm: 0.4 },
  { strasse: "Via del Brigantino", distanzKm: 0.2 },
];

describe("wegbeschreibung (req-059)", () => {
  it("nennt je Zeile die Strasse und ihre Laenge", () => {
    const zeilen = wegbeschreibung([{ strasse: "SS163", distanzKm: 8 }]);

    expect(zeilen).toEqual(["SS163, 8,0 km"]);
  });

  it("fasst aufeinanderfolgende Stuecke derselben Strasse zusammen", () => {
    const zeilen = wegbeschreibung([
      { strasse: "SS163", distanzKm: 4.2 },
      { strasse: "SS163", distanzKm: 3.8 },
    ]);

    expect(zeilen).toEqual(["SS163, 8,0 km"]);
  });

  it("gibt hoechstens fuenf Zeilen aus", () => {
    const zeilen = wegbeschreibung(AMALFIKUESTE);

    expect(zeilen.length).toBeLessThanOrEqual(WEGBESCHREIBUNG_MAX_ZEILEN);
    expect(zeilen.length).toBe(5);
  });

  it("behaelt die Reihenfolge der Fahrt bei", () => {
    const zeilen = wegbeschreibung(AMALFIKUESTE);

    expect(zeilen[0]).toContain("SS163");
    expect(zeilen[zeilen.length - 1]).toContain("Via Cristoforo Colombo");
  });

  it("schreibt kurze Abschnitte in Metern", () => {
    expect(
      wegbeschreibung([{ strasse: "Via Pasitea", distanzKm: 0.35 }]),
    ).toEqual(["Via Pasitea, 350 m"]);
  });

  it("benennt einen Abschnitt ohne Strassennamen", () => {
    expect(wegbeschreibung([{ strasse: "", distanzKm: 2 }])).toEqual([
      "Weg ohne Namen, 2,0 km",
    ]);
  });

  it("liefert ohne Abschnitte nichts", () => {
    expect(wegbeschreibung()).toEqual([]);
    expect(wegbeschreibung([])).toEqual([]);
  });
});
