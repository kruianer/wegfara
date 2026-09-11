import { describe, expect, it } from "vitest";
import {
  felderAlsFuellung,
  istVervollstaendigenFehler,
  nurLeereFelder,
  VERVOLLSTAENDIGEN_FEHLER,
  VERVOLLSTAENDIGEN_FEHLER_TEXT,
} from "./vervollstaendigen";
import { emptyPoiInput, type PoiInput } from "./validate";

function stand(overrides: Partial<PoiInput> = {}): PoiInput {
  return {
    ...emptyPoiInput(),
    name: "Villa Rufolo",
    position: { lat: 40.6491, lng: 14.6113 },
    ...overrides,
  };
}

describe("nurLeereFelder (req-061)", () => {
  it("füllt eine leere Adresse", () => {
    expect(
      nurLeereFelder(stand({ address: "" }), { address: "Piazza Duomo 1" }),
    ).toEqual({ address: "Piazza Duomo 1" });
  });

  it("lässt einen selbst geschriebenen Kurztext stehen", () => {
    expect(
      nurLeereFelder(stand({ shortText: "Unser Lieblingsplatz" }), {
        shortText: "Gärten mit Meerblick",
      }),
    ).toEqual({});
  });

  it("behandelt ein Feld aus Leerzeichen wie ein leeres", () => {
    expect(
      nurLeereFelder(stand({ phone: "   " }), { phone: "+39 089 857621" }),
    ).toEqual({ phone: "+39 089 857621" });
  });

  it("füllt nichts, was die Quelle selbst nicht kennt", () => {
    expect(nurLeereFelder(stand({ web: "" }), { web: "" })).toEqual({});
  });

  it("lässt Typ und Status unangetastet — sie sind nie leer", () => {
    expect(
      nurLeereFelder(stand({ type: "strand" }), { type: "restaurant" }),
    ).toEqual({});
  });

  it("lässt die Position eines gespeicherten POI stehen", () => {
    expect(nurLeereFelder(stand(), { position: { lat: 1, lng: 2 } })).toEqual(
      {},
    );
  });

  it("füllt eine noch fehlende Position", () => {
    expect(
      nurLeereFelder(stand({ position: null }), {
        position: { lat: 1, lng: 2 },
      }),
    ).toEqual({ position: { lat: 1, lng: 2 } });
  });
});

describe("felderAlsFuellung (req-061)", () => {
  it("nimmt genau die genannten Angaben mit", () => {
    const gespeichert = stand({
      address: "Piazza Duomo 1",
      phone: "+39 089 857621",
      shortText: "Gärten mit Meerblick",
    });

    expect(felderAlsFuellung(gespeichert, ["address", "shortText"])).toEqual({
      address: "Piazza Duomo 1",
      shortText: "Gärten mit Meerblick",
    });
  });

  it("liefert ohne genannte Angaben nichts", () => {
    expect(felderAlsFuellung(stand(), [])).toEqual({});
  });
});

describe("VERVOLLSTAENDIGEN_FEHLER_TEXT (req-061, bug-021)", () => {
  it("nennt zu jedem Grund einen eigenen Satz", () => {
    const saetze = VERVOLLSTAENDIGEN_FEHLER.map(
      (grund) => VERVOLLSTAENDIGEN_FEHLER_TEXT[grund],
    );

    expect(saetze.every((satz) => satz.length > 0)).toBe(true);
    expect(new Set(saetze).size).toBe(saetze.length);
  });

  it("erkennt einen bekannten Grund und weist alles Übrige ab", () => {
    expect(istVervollstaendigenFehler("ort_nicht_gefunden")).toBe(true);
    expect(istVervollstaendigenFehler("kein_google_link")).toBe(false);
    expect(istVervollstaendigenFehler(7)).toBe(false);
  });
});
