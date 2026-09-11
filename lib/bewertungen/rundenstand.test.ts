import { describe, expect, it } from "vitest";
import type { Poi } from "../pois/types";
import {
  anzuzeigendeRunde,
  rundenzeilen,
  type RundenZeile,
} from "./rundenstand";
import type { Bewertungsrunde, Stimme } from "./types";

/**
 * Der Stand einer ganzen Bewertungsrunde (req-063) -- ohne UI und ohne
 * Datenbank.
 */

function runde(overrides: Partial<Bewertungsrunde> = {}): Bewertungsrunde {
  return {
    id: "runde-1",
    tripId: "trip-1",
    status: "laeuft",
    poiIds: ["poi-1", "poi-2"],
    startedAt: "2026-09-07T10:00:00.000Z",
    endedAt: null,
    ...overrides,
  };
}

describe("anzuzeigendeRunde (req-063)", () => {
  it("zeigt die laufende Runde", () => {
    const beendet = runde({
      id: "alt",
      status: "beendet",
      startedAt: "2026-09-08T10:00:00.000Z",
      endedAt: "2026-09-09T10:00:00.000Z",
    });

    expect(anzuzeigendeRunde([beendet, runde()])?.id).toBe("runde-1");
  });

  it("zeigt ohne laufende die zuletzt beendete", () => {
    const frueher = runde({
      id: "frueher",
      status: "beendet",
      startedAt: "2026-09-01T10:00:00.000Z",
      endedAt: "2026-09-02T10:00:00.000Z",
    });
    const spaeter = runde({
      id: "spaeter",
      status: "beendet",
      startedAt: "2026-09-03T10:00:00.000Z",
      endedAt: "2026-09-04T10:00:00.000Z",
    });

    expect(anzuzeigendeRunde([frueher, spaeter])?.id).toBe("spaeter");
    expect(anzuzeigendeRunde([spaeter, frueher])?.id).toBe("spaeter");
  });

  it("liefert nichts, wenn es noch nie eine Runde gab", () => {
    expect(anzuzeigendeRunde([])).toBeNull();
  });
});

function poi(id: string, overrides: Partial<Poi> = {}): Poi {
  return {
    id,
    tripId: "trip-1",
    number: 1,
    name: id,
    ort: "Ravello",
    type: "sehenswuerdigkeit",
    position: { lat: 40.649, lng: 14.612 },
    status: "weiss_nicht",
    ...overrides,
  };
}

const PERSONEN = [
  { id: "anna", name: "Anna" },
  { id: "bert", name: "Bert" },
  { id: "clara", name: "Clara" },
  { id: "dirk", name: "Dirk" },
];

function stimme(
  participantId: string,
  wahl: Stimme["wahl"],
  poiId = "poi-1",
  roundId = "runde-1",
): Stimme {
  return { roundId, poiId, participantId, wahl };
}

/** Wie oft eine Stufe in dieser Zeile gestimmt wurde. */
function anzahl(zeile: RundenZeile, wahl: Stimme["wahl"]): number {
  return (
    zeile.stand.verteilung.find((eintrag) => eintrag.wahl === wahl)?.anzahl ?? 0
  );
}

describe("rundenzeilen (req-063)", () => {
  it("liefert je POI der Runde eine Zeile, mit Name und Status", () => {
    const zeilen = rundenzeilen(runde(), [
      poi("poi-1", { name: "Villa Rufolo", status: "gesetzt" }),
      poi("poi-2", { name: "Pompeji" }),
    ]);

    expect(
      zeilen.map(({ poiId, name, status }) => ({ poiId, name, status })),
    ).toEqual([
      { poiId: "poi-1", name: "Villa Rufolo", status: "gesetzt" },
      { poiId: "poi-2", name: "Pompeji", status: "weiss_nicht" },
    ]);
  });

  it("zaehlt die Stimmen je Stufe und wer noch fehlt", () => {
    const [zeile] = rundenzeilen(
      runde({ poiIds: ["poi-1"] }),
      [poi("poi-1")],
      [stimme("anna", "unbedingt"), stimme("bert", "unbedingt")],
      PERSONEN,
    );

    expect(anzahl(zeile, "unbedingt")).toBe(2);
    expect(anzahl(zeile, "waere_schoen")).toBe(0);
    expect(zeile.stand.fehlend.map((person) => person.name)).toEqual([
      "Clara",
      "Dirk",
    ]);
  });

  it("zaehlt nur die Stimmen der gezeigten Runde", () => {
    const [zeile] = rundenzeilen(
      runde({ poiIds: ["poi-1"] }),
      [poi("poi-1")],
      [
        stimme("anna", "unbedingt"),
        stimme("bert", "unbedingt", "poi-1", "andere-runde"),
      ],
      PERSONEN,
    );

    expect(anzahl(zeile, "unbedingt")).toBe(1);
  });

  it("rechnet die Zustimmung als gewichtete Summe (req-063)", () => {
    const [zeile] = rundenzeilen(
      runde({ poiIds: ["poi-1"] }),
      [poi("poi-1")],
      [
        stimme("anna", "unbedingt"),
        stimme("bert", "waere_schoen"),
        stimme("clara", "wenn_zeit"),
        stimme("dirk", "lieber_nicht"),
      ],
      PERSONEN,
    );

    expect(zeile.zustimmung).toBe(2);
  });

  it("zaehlt eine Abwesenheit doppelt gegen den POI", () => {
    const [zeile] = rundenzeilen(
      runde({ poiIds: ["poi-1"] }),
      [poi("poi-1")],
      [stimme("anna", "ohne_mich"), stimme("bert", "ohne_mich")],
      PERSONEN,
    );

    expect(zeile.zustimmung).toBe(-4);
  });

  it("stellt die hoechste Zustimmung nach oben", () => {
    const zeilen = rundenzeilen(
      runde({ poiIds: ["poi-b", "poi-a"] }),
      [poi("poi-a"), poi("poi-b")],
      [
        stimme("anna", "unbedingt", "poi-a"),
        stimme("bert", "unbedingt", "poi-a"),
        stimme("anna", "waere_schoen", "poi-b"),
        stimme("bert", "waere_schoen", "poi-b"),
      ],
      PERSONEN,
    );

    expect(zeilen.map((zeile) => zeile.poiId)).toEqual(["poi-a", "poi-b"]);
  });

  it("stellt einen abgelehnten POI hinter die ohne Ablehnung", () => {
    const zeilen = rundenzeilen(
      runde({ poiIds: ["poi-c", "poi-a", "poi-b"] }),
      [poi("poi-a"), poi("poi-b"), poi("poi-c")],
      [
        stimme("anna", "ohne_mich", "poi-c"),
        stimme("bert", "ohne_mich", "poi-c"),
        stimme("anna", "wenn_zeit", "poi-a"),
        stimme("anna", "waere_schoen", "poi-b"),
      ],
      PERSONEN,
    );

    expect(zeilen.map((zeile) => zeile.poiId)).toEqual([
      "poi-b",
      "poi-a",
      "poi-c",
    ]);
  });

  it("behaelt bei gleicher Zustimmung die Reihenfolge der Runde", () => {
    const zeilen = rundenzeilen(runde({ poiIds: ["poi-2", "poi-1"] }), [
      poi("poi-1"),
      poi("poi-2"),
    ]);

    expect(zeilen.map((zeile) => zeile.poiId)).toEqual(["poi-2", "poi-1"]);
  });

  it("laesst POIs weg, die nicht zur Runde gehoeren", () => {
    const zeilen = rundenzeilen(runde({ poiIds: ["poi-1"] }), [
      poi("poi-1"),
      poi("poi-2"),
    ]);

    expect(zeilen.map((zeile) => zeile.poiId)).toEqual(["poi-1"]);
  });
});
