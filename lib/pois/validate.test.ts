import { describe, expect, it } from "vitest";
import type { Poi } from "./types";
import {
  POI_NAME_MAX_LENGTH,
  POI_SHORT_TEXT_MAX_LENGTH,
  emptyPoiInput,
  normalizeWeb,
  poiInputIsValid,
  poiInputToValues,
  poiToInput,
  validatePoiInput,
  type PoiInput,
} from "./validate";

function eingabe(overrides: Partial<PoiInput> = {}): PoiInput {
  return {
    ...emptyPoiInput(),
    name: "Bucht bei Praiano",
    ort: "Praiano",
    type: "strand",
    position: { lat: 40.6117, lng: 14.5289 },
    ...overrides,
  };
}

describe("emptyPoiInput (req-035)", () => {
  it("beginnt ohne Angaben und mit dem Status 'Weiß noch nicht'", () => {
    expect(emptyPoiInput()).toMatchObject({
      name: "",
      ort: "",
      position: null,
      status: "weiss_nicht",
    });
  });
});

describe("validatePoiInput (req-035)", () => {
  it("nimmt Name, Typ und Position an; alles Weitere darf leer bleiben", () => {
    expect(validatePoiInput(eingabe())).toEqual({});
    expect(poiInputIsValid(eingabe())).toBe(true);
  });

  it("verlangt einen Namen", () => {
    expect(validatePoiInput(eingabe({ name: "  " })).name).toBeDefined();
  });

  it("verlangt keinen Ort — er wird abgeleitet (req-041)", () => {
    expect(validatePoiInput(eingabe({ ort: "" }))).toEqual({});
    expect(poiInputIsValid(eingabe({ ort: "" }))).toBe(true);
  });

  it("verlangt eine Position", () => {
    expect(
      validatePoiInput(eingabe({ position: null })).position,
    ).toBeDefined();
  });

  it("weist einen zu langen Namen ab", () => {
    const zuLang = "a".repeat(POI_NAME_MAX_LENGTH + 1);

    expect(validatePoiInput(eingabe({ name: zuLang })).name).toBeDefined();
  });

  it("nimmt einen Kurztext mit genau 200 Zeichen an (req-044)", () => {
    const genau = "a".repeat(POI_SHORT_TEXT_MAX_LENGTH);

    expect(validatePoiInput(eingabe({ shortText: genau }))).toEqual({});
  });

  it("weist einen Kurztext ueber 200 Zeichen ab (req-044)", () => {
    const zuLang = "a".repeat(POI_SHORT_TEXT_MAX_LENGTH + 1);

    expect(
      validatePoiInput(eingabe({ shortText: zuLang })).shortText,
    ).toBeDefined();
  });

  it("laesst den Langtext unbegrenzt (req-044)", () => {
    const lang = "a".repeat(5000);

    expect(validatePoiInput(eingabe({ longText: lang }))).toEqual({});
  });
});

describe("normalizeWeb", () => {
  it("ergaenzt das fehlende Schema", () => {
    expect(normalizeWeb("villarufolo.com")).toBe("https://villarufolo.com");
  });

  it("laesst eine vollstaendige Adresse unangetastet", () => {
    expect(normalizeWeb("http://villarufolo.com")).toBe(
      "http://villarufolo.com",
    );
  });

  it("laesst Leeres leer", () => {
    expect(normalizeWeb("   ")).toBe("");
  });
});

describe("poiInputToValues (req-035)", () => {
  it("liefert nichts, wenn die Eingabe unvollstaendig ist", () => {
    expect(poiInputToValues(eingabe({ name: "" }))).toBeNull();
    expect(poiInputToValues(eingabe({ position: null }))).toBeNull();
  });

  it("raeumt die Eingaben auf", () => {
    const values = poiInputToValues(
      eingabe({
        name: "  Bucht bei Praiano ",
        ort: " Praiano ",
        web: "villarufolo.com",
        address: "  ",
        openingHours: "Montag: 09:00\n\n  Dienstag: 09:00 ",
      }),
    );

    expect(values).toMatchObject({
      name: "Bucht bei Praiano",
      web: "https://villarufolo.com",
      address: null,
      openingHours: ["Montag: 09:00", "Dienstag: 09:00"],
    });
  });

  it("laesst den Ort offen — er wird beim Speichern abgeleitet (req-041)", () => {
    expect(poiInputToValues(eingabe({ ort: "Praiano" }))?.ort).toBeNull();
  });

  it("uebernimmt Kurz- und Langtext, leere bleiben offen (req-044)", () => {
    expect(
      poiInputToValues(
        eingabe({
          shortText: " Gärten mit Meerblick ",
          longText: "Erste Zeile\n\nZweite Zeile",
        }),
      ),
    ).toMatchObject({
      shortText: "Gärten mit Meerblick",
      // Die Absaetze des Langtextes bleiben erhalten.
      longText: "Erste Zeile\n\nZweite Zeile",
    });

    expect(poiInputToValues(eingabe())).toMatchObject({
      shortText: null,
      longText: null,
    });
  });
});

describe("poiToInput (req-035)", () => {
  it("uebernimmt die Angaben eines vorhandenen POI", () => {
    const poi: Poi = {
      id: "poi-1",
      tripId: "trip-1",
      number: 13,
      name: "Villa Rufolo",
      ort: "Ravello",
      type: "sehenswuerdigkeit",
      position: { lat: 40.6491, lng: 14.6113 },
      status: "gesetzt",
      openingHours: ["Montag: 09:00", "Dienstag: 09:00"],
    };

    expect(poiToInput(poi)).toEqual({
      name: "Villa Rufolo",
      ort: "Ravello",
      type: "sehenswuerdigkeit",
      position: { lat: 40.6491, lng: 14.6113 },
      status: "gesetzt",
      shortText: "",
      longText: "",
      address: "",
      web: "",
      phone: "",
      openingHours: "Montag: 09:00\nDienstag: 09:00",
    });
  });

  it("uebernimmt Kurz- und Langtext (req-044)", () => {
    const input = poiToInput({
      id: "poi-1",
      tripId: "trip-1",
      number: 13,
      name: "Villa Rufolo",
      ort: "Ravello",
      type: "sehenswuerdigkeit",
      position: { lat: 40.6491, lng: 14.6113 },
      status: "gesetzt",
      shortText: "Gärten mit Meerblick",
      longText: "Ein Palast aus dem 13. Jahrhundert über der Amalfiküste.",
    });

    expect(input.shortText).toBe("Gärten mit Meerblick");
    expect(input.longText).toBe(
      "Ein Palast aus dem 13. Jahrhundert über der Amalfiküste.",
    );
  });
});
