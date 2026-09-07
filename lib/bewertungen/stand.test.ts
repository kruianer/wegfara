import { describe, expect, it } from "vitest";
import {
  bewertungsstand,
  laufendeRunde,
  ohneMichAmPoi,
  ohneMichJeProgrammpunkt,
  rundeZuPoi,
} from "./stand";
import type { Bewertungsrunde, Stimme } from "./types";

/**
 * Der Stand einer Bewertungsrunde an einem POI (req-054) -- ohne UI und ohne
 * Datenbank.
 */

const PERSONEN = [
  { id: "anna", name: "Anna" },
  { id: "bert", name: "Bert" },
  { id: "clara", name: "Clara" },
];

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

function stimme(
  participantId: string,
  wahl: Stimme["wahl"],
  poiId = "poi-1",
  roundId = "runde-1",
): Stimme {
  return { roundId, poiId, participantId, wahl };
}

describe("laufendeRunde (req-054)", () => {
  it("findet die laufende Runde der Reise", () => {
    expect(laufendeRunde([runde()], "trip-1")?.id).toBe("runde-1");
  });

  it("liefert nichts, wenn die Runde beendet ist", () => {
    expect(laufendeRunde([runde({ status: "beendet" })], "trip-1")).toBeNull();
  });

  it("liefert nichts fuer eine Reise ohne Runde", () => {
    expect(laufendeRunde([runde()], "trip-2")).toBeNull();
  });
});

describe("rundeZuPoi (req-054)", () => {
  it("liefert die laufende Runde, in der der POI steht", () => {
    const beendet = runde({
      id: "alt",
      status: "beendet",
      startedAt: "2026-09-01T10:00:00.000Z",
      endedAt: "2026-09-02T10:00:00.000Z",
    });
    expect(rundeZuPoi([beendet, runde()], "poi-1")?.id).toBe("runde-1");
  });

  it("liefert die zuletzt gestartete beendete Runde, wenn keine laeuft", () => {
    const alt = runde({
      id: "alt",
      status: "beendet",
      startedAt: "2026-09-01T10:00:00.000Z",
    });
    const neu = runde({
      id: "neu",
      status: "beendet",
      startedAt: "2026-09-05T10:00:00.000Z",
    });
    expect(rundeZuPoi([alt, neu], "poi-1")?.id).toBe("neu");
  });

  it("liefert nichts fuer einen POI, ueber den nie abgestimmt wurde", () => {
    expect(rundeZuPoi([runde()], "poi-9")).toBeNull();
  });
});

describe("bewertungsstand (req-054)", () => {
  it("zaehlt die Stimmen je Wahl", () => {
    const stand = bewertungsstand(
      "poi-1",
      [runde()],
      [stimme("anna", "unbedingt"), stimme("bert", "unbedingt")],
      PERSONEN,
    );

    expect(stand?.verteilung).toEqual([
      { wahl: "unbedingt", anzahl: 2 },
      { wahl: "waere_schoen", anzahl: 0 },
      { wahl: "wenn_zeit", anzahl: 0 },
      { wahl: "lieber_nicht", anzahl: 0 },
      { wahl: "ohne_mich", anzahl: 0 },
    ]);
  });

  it("nennt die abgegebenen Stimmen mit Namen und wer noch fehlt", () => {
    const stand = bewertungsstand(
      "poi-1",
      [runde()],
      [stimme("anna", "unbedingt"), stimme("bert", "ohne_mich")],
      PERSONEN,
    );

    expect(stand?.abgegeben).toEqual([
      { id: "anna", name: "Anna", wahl: "unbedingt" },
      { id: "bert", name: "Bert", wahl: "ohne_mich" },
    ]);
    expect(stand?.fehlend).toEqual([{ id: "clara", name: "Clara" }]);
  });

  it("nennt, wer nicht dabei ist", () => {
    const stand = bewertungsstand(
      "poi-1",
      [runde()],
      [stimme("bert", "ohne_mich")],
      PERSONEN,
    );

    expect(stand?.ohneMich).toEqual([{ id: "bert", name: "Bert" }]);
  });

  it("kennt die eigene Stimme", () => {
    const stand = bewertungsstand(
      "poi-1",
      [runde()],
      [stimme("anna", "waere_schoen")],
      PERSONEN,
      "anna",
    );

    expect(stand?.eigeneWahl).toBe("waere_schoen");
  });

  it("zaehlt nur die Stimmen zu diesem POI", () => {
    const stand = bewertungsstand(
      "poi-1",
      [runde()],
      [stimme("anna", "unbedingt", "poi-2")],
      PERSONEN,
    );

    expect(stand?.abgegeben).toEqual([]);
    expect(stand?.fehlend).toHaveLength(3);
  });

  it("bleibt nach dem Beenden der Runde erhalten", () => {
    const stand = bewertungsstand(
      "poi-1",
      [runde({ status: "beendet", endedAt: "2026-09-08T10:00:00.000Z" })],
      [stimme("anna", "unbedingt")],
      PERSONEN,
    );

    expect(stand?.runde.status).toBe("beendet");
    expect(stand?.abgegeben).toHaveLength(1);
  });

  it("liefert nichts fuer einen POI ohne Runde", () => {
    expect(bewertungsstand("poi-9", [runde()], [], PERSONEN)).toBeNull();
  });
});

describe("ohneMich am POI und am Programmpunkt (req-054)", () => {
  it("nennt am POI, wer nicht dabei ist", () => {
    expect(
      ohneMichAmPoi(
        "poi-1",
        [runde()],
        [stimme("bert", "ohne_mich")],
        PERSONEN,
      ),
    ).toEqual([{ id: "bert", name: "Bert" }]);
  });

  it("nennt es am Programmpunkt, der aus dem POI entstanden ist", () => {
    const namen = ohneMichJeProgrammpunkt(
      [{ id: "activity-1", poiId: "poi-1" }],
      [runde()],
      [stimme("bert", "ohne_mich")],
      PERSONEN,
    );

    expect(namen).toEqual({ "activity-1": ["Bert"] });
  });

  it("nennt nichts an einem Programmpunkt ohne POI", () => {
    expect(
      ohneMichJeProgrammpunkt(
        [{ id: "activity-1" }],
        [runde()],
        [stimme("bert", "ohne_mich")],
        PERSONEN,
      ),
    ).toEqual({});
  });

  it("nennt nichts, solange niemand „Ohne mich“ gestimmt hat", () => {
    expect(
      ohneMichJeProgrammpunkt(
        [{ id: "activity-1", poiId: "poi-1" }],
        [runde()],
        [stimme("anna", "unbedingt")],
        PERSONEN,
      ),
    ).toEqual({});
  });
});
