import { describe, expect, it } from "vitest";
import type { Activity } from "../activities/types";
import type { Poi } from "../pois/types";
import { LEERE_PRAEFERENZEN } from "../trips/praeferenzen";
import type { Trip } from "../trips/types";
import { gesamtCent, kostenzeilen, reisetagText } from "./zeilen";

const REISE: Trip = {
  id: "reise-1",
  title: "Süditalien Rundreise",
  startDate: "2026-07-18",
  endDate: "2026-07-23",
  mainPlace: { name: "Amalfi", lat: 40.634, lng: 14.6027 },
  description: "",
  state: "in_planung",
  tempo: "ausgewogen",
  praeferenzen: LEERE_PRAEFERENZEN,
};

function poi(overrides: Partial<Poi> = {}): Poi {
  return {
    id: "poi-1",
    tripId: REISE.id,
    number: 1,
    name: "Villa Rufolo",
    ort: "Ravello",
    type: "sehenswuerdigkeit",
    position: { lat: 40.649, lng: 14.612 },
    status: "gesetzt",
    ...overrides,
  };
}

function programmpunkt(overrides: Partial<Activity> = {}): Activity {
  return {
    id: "activity-1",
    tripId: REISE.id,
    type: "sehenswuerdigkeit",
    title: "Villa Rufolo",
    shortText: "",
    longText: "",
    startAt: "2026-07-19T10:00",
    endAt: "2026-07-19T12:00",
    poiId: "poi-1",
    ...overrides,
  };
}

function zeilen(activities: Activity[], pois: Poi[], teilnehmerzahl = 4) {
  return kostenzeilen({ trip: REISE, activities, pois, teilnehmerzahl });
}

describe("kostenzeilen (req-062)", () => {
  it("bildet je Programmpunkt eine Zeile", () => {
    const drei = [
      programmpunkt({ id: "a1", poiId: "poi-1" }),
      programmpunkt({
        id: "a2",
        poiId: "poi-2",
        startAt: "2026-07-20T10:00",
        endAt: "2026-07-20T11:00",
      }),
      programmpunkt({
        id: "a3",
        poiId: "poi-3",
        startAt: "2026-07-21T10:00",
        endAt: "2026-07-21T11:00",
      }),
    ];

    expect(
      zeilen(drei, [
        poi({ id: "poi-1" }),
        poi({ id: "poi-2", name: "Pompeji" }),
        poi({ id: "poi-3", name: "Capri" }),
      ]),
    ).toHaveLength(3);
  });

  it("nimmt den Preis je Person vom POI (req-061)", () => {
    const [zeile] = zeilen([programmpunkt()], [poi({ kostenCent: 1250 })], 4);

    expect(zeile.preisCent).toBe(1250);
  });

  it("belegt die Anzahl mit der Teilnehmerzahl vor", () => {
    const [zeile] = zeilen([programmpunkt()], [poi()], 4);

    expect(zeile.anzahl).toBe(4);
  });

  it("rechnet Gesamt als Preis mal Anzahl", () => {
    const [zeile] = zeilen([programmpunkt()], [poi({ kostenCent: 1250 })], 4);

    expect(zeile.gesamtCent).toBe(5000);
  });

  it("laesst Gesamt ohne eingetragenen Preis leer", () => {
    const [zeile] = zeilen([programmpunkt()], [poi()], 4);

    expect(zeile.preisCent).toBeNull();
    expect(zeile.gesamtCent).toBeNull();
  });

  /**
   * Zweimal essen kostet zweimal -- derselbe POI an zwei Reisetagen ergibt
   * zwei Zeilen, nicht eine (req-062).
   */
  it("bildet fuer denselben POI an zwei Reisetagen zwei Zeilen", () => {
    const gebildet = zeilen(
      [
        programmpunkt({ id: "a1", startAt: "2026-07-19T12:00" }),
        programmpunkt({ id: "a2", startAt: "2026-07-21T12:00" }),
      ],
      [poi({ kostenCent: 1250 })],
    );

    expect(gebildet).toHaveLength(2);
    expect(gebildet.map((zeile) => zeile.preisCent)).toEqual([1250, 1250]);
  });

  it("nennt den Namen des POI und den Reisetag", () => {
    const [zeile] = zeilen([programmpunkt()], [poi()]);

    expect(zeile.bezeichnung).toBe("Villa Rufolo");
    expect(zeile.reisetag).toBe("Tag 2 · So 19.07.");
  });

  /**
   * Ein Programmpunkt ohne POI -- etwa der Ausgangspunkt der Anreise
   * (req-018) -- bekommt trotzdem seine Zeile: je Programmpunkt eine.
   */
  it("nimmt bei einem Programmpunkt ohne POI dessen Titel", () => {
    const [zeile] = zeilen(
      [programmpunkt({ poiId: undefined, title: "Wien" })],
      [poi()],
    );

    expect(zeile.bezeichnung).toBe("Wien");
    expect(zeile.poiId).toBeNull();
  });

  it("sortiert die Zeilen nach dem Zeitstrahl", () => {
    const gebildet = zeilen(
      [
        programmpunkt({ id: "spaet", startAt: "2026-07-21T09:00" }),
        programmpunkt({ id: "frueh", startAt: "2026-07-19T09:00" }),
      ],
      [poi()],
    );

    expect(gebildet.map((zeile) => zeile.id)).toEqual(["frueh", "spaet"]);
  });

  it("liefert ohne Programmpunkte keine Zeile", () => {
    expect(zeilen([], [poi()])).toEqual([]);
  });
});

describe("reisetagText (req-062)", () => {
  it("zaehlt die Reisetage ab dem Anreisetag", () => {
    expect(reisetagText(REISE, "2026-07-18T08:00")).toBe("Tag 1 · Sa 18.07.");
    expect(reisetagText(REISE, "2026-07-23T08:00")).toBe("Tag 6 · Do 23.07.");
  });

  it("raet bei einem Datum ausserhalb der Reise keine Tagesnummer", () => {
    expect(reisetagText(REISE, "2026-08-01T08:00")).toBe("01.08.");
  });
});

describe("gesamtCent (req-062)", () => {
  it("rechnet Preis mal Anzahl", () => {
    expect(gesamtCent(1250, 4)).toBe(5000);
  });

  it("bleibt ohne Preis leer", () => {
    expect(gesamtCent(null, 4)).toBeNull();
  });
});
