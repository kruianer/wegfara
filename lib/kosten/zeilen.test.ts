import { describe, expect, it } from "vitest";
import type { Activity } from "../activities/types";
import type { Poi } from "../pois/types";
import { LEERE_PRAEFERENZEN } from "../trips/praeferenzen";
import type { Trip } from "../trips/types";
import type { GespeicherteKostenzeile } from "./types";
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

function zeilen(
  activities: Activity[],
  pois: Poi[],
  teilnehmerzahl = 4,
  gespeicherte: GespeicherteKostenzeile[] = [],
) {
  return kostenzeilen({
    trip: REISE,
    activities,
    pois,
    gespeicherte,
    teilnehmerzahl,
  });
}

function gespeichert(
  overrides: Partial<GespeicherteKostenzeile> = {},
): GespeicherteKostenzeile {
  return {
    id: "zeile-1",
    tripId: REISE.id,
    activityId: null,
    bezeichnung: null,
    preisCent: null,
    buchung: null,
    anzahl: null,
    dokumentId: null,
    createdAt: "2026-09-11T10:00:00.000Z",
    ...overrides,
  };
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

  /**
   * Wer beim Mietauto 1 eingetragen hat, behaelt 1 -- auch wenn ein
   * fuenfter Teilnehmer zur Reise kommt (req-062).
   */
  it("laesst eine von Hand gesetzte Anzahl stehen", () => {
    const [zeile] = zeilen([programmpunkt({ id: "a1" })], [poi()], 5, [
      gespeichert({ activityId: "a1", anzahl: 1 }),
    ]);

    expect(zeile.anzahl).toBe(1);
  });

  it("laesst eine nie geaenderte Anzahl mit der Teilnehmerzahl nachziehen", () => {
    const [zeile] = zeilen([programmpunkt({ id: "a1" })], [poi()], 5, [
      gespeichert({ activityId: "a1", anzahl: null }),
    ]);

    expect(zeile.anzahl).toBe(5);
  });

  it("rechnet Gesamt mit der von Hand gesetzten Anzahl", () => {
    const [zeile] = zeilen(
      [programmpunkt({ id: "a1" })],
      [poi({ kostenCent: 1250 })],
      5,
      [gespeichert({ activityId: "a1", anzahl: 1 })],
    );

    expect(zeile.gesamtCent).toBe(1250);
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

  /**
   * Ohne POI gibt es nichts, woran Preis und Buchungsstatus stehen koennten
   * -- fuer eine solche Zeile gilt, was an ihr selbst gespeichert ist.
   */
  it("nimmt Preis und Buchung ohne POI aus der gespeicherten Zeile", () => {
    const [zeile] = zeilen(
      [programmpunkt({ id: "a1", poiId: undefined, title: "Wien" })],
      [],
      4,
      [
        gespeichert({
          activityId: "a1",
          preisCent: 3000,
          buchung: "gebucht",
        }),
      ],
    );

    expect(zeile.preisCent).toBe(3000);
    expect(zeile.gesamtCent).toBe(12000);
    expect(zeile.buchung).toBe("gebucht");
  });

  /**
   * Mit POI ist der POI die Wahrheit (req-061) -- eine zweite Kopie an der
   * Zeile gaebe es nur, wenn jemand sie dort hineinschriebe; gelesen wird
   * sie nie.
   */
  it("nimmt Preis und Buchung mit POI vom POI", () => {
    const [zeile] = zeilen(
      [programmpunkt({ id: "a1" })],
      [poi({ kostenCent: 1250, buchung: "offen" })],
      4,
      [
        gespeichert({
          activityId: "a1",
          preisCent: 9900,
          buchung: "gebucht",
        }),
      ],
    );

    expect(zeile.preisCent).toBe(1250);
    expect(zeile.buchung).toBe("offen");
  });

  it("nimmt den Buchungsstatus des POI (req-061)", () => {
    const [zeile] = zeilen([programmpunkt()], [poi({ buchung: "gebucht" })]);

    expect(zeile.buchung).toBe("gebucht");
  });

  it('steht ohne Angabe auf "Nicht nötig"', () => {
    const [zeile] = zeilen([programmpunkt()], [poi()]);

    expect(zeile.buchung).toBe("nicht_noetig");
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

/**
 * Manuelle Zeilen fuer alles ohne Programmpunkt -- Maut, Parkgebuehren,
 * Sprit (req-062). Sie stehen unter denen aus dem Plan.
 */
describe("kostenzeilen -- manuelle Zeilen (req-062)", () => {
  it("nimmt eine manuelle Zeile mit in die Tabelle", () => {
    const gebildet = zeilen([], [], 4, [
      gespeichert({
        id: "maut",
        bezeichnung: "Maut",
        preisCent: 3000,
        anzahl: 1,
      }),
    ]);

    expect(gebildet).toHaveLength(1);
    expect(gebildet[0]).toMatchObject({
      id: "maut",
      herkunft: "manuell",
      bezeichnung: "Maut",
      preisCent: 3000,
      anzahl: 1,
      gesamtCent: 3000,
      reisetag: null,
      activityId: null,
    });
  });

  it("stellt die manuellen Zeilen unter die aus dem Plan", () => {
    const gebildet = zeilen([programmpunkt({ id: "a1" })], [poi()], 4, [
      gespeichert({ id: "maut", bezeichnung: "Maut" }),
    ]);

    expect(gebildet.map((zeile) => zeile.herkunft)).toEqual([
      "programmpunkt",
      "manuell",
    ]);
  });

  it("ordnet die manuellen Zeilen nach dem Anlegen", () => {
    const gebildet = zeilen([], [], 4, [
      gespeichert({
        id: "spaet",
        bezeichnung: "Sprit",
        createdAt: "2026-09-11T12:00:00.000Z",
      }),
      gespeichert({
        id: "frueh",
        bezeichnung: "Maut",
        createdAt: "2026-09-11T10:00:00.000Z",
      }),
    ]);

    expect(gebildet.map((zeile) => zeile.id)).toEqual(["frueh", "spaet"]);
  });

  it("laesst auch eine manuelle Zeile mit der Teilnehmerzahl nachziehen", () => {
    const [zeile] = zeilen([], [], 5, [
      gespeichert({ bezeichnung: "Maut", anzahl: null }),
    ]);

    expect(zeile.anzahl).toBe(5);
  });
});

/**
 * Der Preis steht am POI (req-061) und wird von dort gelesen, nicht kopiert:
 * ein aus dem Plan entfernter und erneut verplanter Ort bringt ihn wieder mit
 * (req-062).
 */
describe("kostenzeilen -- erneut verplanter POI (req-062)", () => {
  it("zeigt den Preis des POI auch am neuen Programmpunkt", () => {
    const teuer = poi({ kostenCent: 1250 });
    const vorher = zeilen([programmpunkt({ id: "alt" })], [teuer]);
    expect(vorher[0].preisCent).toBe(1250);

    // Aus dem Plan entfernt (keine Programmpunkte), danach erneut verplant:
    // ein neuer Programmpunkt auf denselben POI.
    expect(zeilen([], [teuer])).toEqual([]);
    const nachher = zeilen(
      [programmpunkt({ id: "neu", startAt: "2026-07-21T10:00" })],
      [teuer],
    );

    expect(nachher[0].preisCent).toBe(1250);
  });
});
