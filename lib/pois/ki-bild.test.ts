import { describe, expect, it } from "vitest";
import {
  KI_BILD_QUELLE,
  istKiBild,
  kiBildAufforderung,
  kiBildVorlage,
} from "./ki-bild";
import type { Poi } from "./types";

const wanderung: Poi = {
  id: "poi-1",
  tripId: "trip-1",
  number: 7,
  name: "Sentiero degli Dei",
  ort: "Agerola",
  type: "aktivitaet",
  position: { lat: 40.63, lng: 14.54 },
  status: "wahrscheinlich",
  buchung: "nicht_noetig",
  shortText: "Wanderweg hoch über der Amalfiküste.",
  longText: "Rund drei Stunden von Bomerano nach Nocelle, meist bergab.",
  photos: [],
};

describe("kiBildAufforderung (req-072)", () => {
  it("nennt Titel und Beschreibung des POI", () => {
    const aufforderung = kiBildAufforderung(kiBildVorlage(wanderung));

    expect(aufforderung).toContain("Sentiero degli Dei");
    expect(aufforderung).toContain("Wanderweg hoch über der Amalfiküste.");
    expect(aufforderung).toContain("nach Nocelle");
  });

  /**
   * Fotorealistisch ist keine Hoffnung, sondern Auftrag: das Bild soll
   * aussehen wie eine Aufnahme des Ortes, nicht wie eine Zeichnung oder ein
   * Gemaelde (req-072).
   */
  it("verlangt eine Aufnahme und schliesst Zeichnung und Gemaelde aus", () => {
    const aufforderung = kiBildAufforderung(kiBildVorlage(wanderung));

    expect(aufforderung).toMatch(/fotorealistisch/i);
    expect(aufforderung).toMatch(/echte Fotografie/i);
    expect(aufforderung).toMatch(/keine Zeichnung/i);
    expect(aufforderung).toMatch(/kein Gemälde/i);
    expect(aufforderung).toMatch(/keine Illustration/i);
  });

  it("verbietet Schrift im Bild", () => {
    expect(kiBildAufforderung(kiBildVorlage(wanderung))).toMatch(
      /keine Schrift/i,
    );
  });

  it("nimmt den Titel allein, wenn es keine Beschreibung gibt", () => {
    const ohneBeschreibung = kiBildAufforderung(
      kiBildVorlage({
        ...wanderung,
        shortText: undefined,
        longText: undefined,
      }),
    );

    expect(ohneBeschreibung).toContain("Sentiero degli Dei");
    expect(ohneBeschreibung).not.toContain("Dazu ist bekannt");
    expect(ohneBeschreibung).toMatch(/fotorealistisch/i);
  });

  it("uebergeht eine Beschreibung aus lauter Leerraum", () => {
    const aufforderung = kiBildAufforderung(
      kiBildVorlage({ ...wanderung, shortText: "   ", longText: "" }),
    );

    expect(aufforderung).not.toContain("Dazu ist bekannt");
  });

  it("nennt den Ort und den Typ des POI", () => {
    const aufforderung = kiBildAufforderung(kiBildVorlage(wanderung));

    expect(aufforderung).toContain("Agerola");
    expect(aufforderung).toContain("Aktivität");
  });

  it("kommt auch ohne Ort aus", () => {
    const aufforderung = kiBildAufforderung(
      kiBildVorlage({ ...wanderung, ort: "" }),
    );

    expect(aufforderung).toContain("Sentiero degli Dei");
    expect(aufforderung).not.toContain(" in .");
  });
});

describe("istKiBild (req-072)", () => {
  it("erkennt ein erzeugtes Bild an seiner Herkunft", () => {
    expect(istKiBild({ id: "f1", position: 1, source: KI_BILD_QUELLE })).toBe(
      true,
    );
  });

  it("zaehlt hochgeladene und aus Google uebernommene Fotos nicht dazu", () => {
    expect(istKiBild({ id: "f1", position: 1, source: "manuell" })).toBe(false);
    expect(istKiBild({ id: "f2", position: 2, source: "google" })).toBe(false);
  });

  /** Ohne Herkunft wird nichts vermutet (req-072, Constraints). */
  it("vermutet nichts, wenn die Herkunft fehlt", () => {
    expect(istKiBild({ id: "f1", position: 1 })).toBe(false);
  });
});
