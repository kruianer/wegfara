import { describe, expect, it } from "vitest";
import type { Poi } from "@/lib/pois/types";
import { baskenland, baskenlandTrip } from "@/tests/fixtures/baskenland-reise";
import { druckTage } from "./stationen";
import { druckUebersicht, uebersichtTitel } from "./uebersicht";

function uebersicht(
  overrides: Partial<Parameters<typeof druckUebersicht>[0]> = {},
  anreise: "auto" | "flug" = "auto",
) {
  const { activities, transfers } = baskenland(anreise);
  const tage = druckTage({ trip: baskenlandTrip(), activities, pois: [] });
  return druckUebersicht({
    tage,
    activities,
    transfers,
    pois: [],
    summen: { gesamtCent: 124000, jePersonCent: 31000 },
    teilnehmerzahl: 4,
    ...overrides,
  });
}

describe("Die Tagesliste auf Seite 2 (req-103)", () => {
  it("hat je Reisetag eine Zeile mit Datum, Ueberschrift, Orten und Zahl der Stationen", () => {
    const { zeilen } = uebersicht();

    expect(zeilen).toHaveLength(6);
    expect(zeilen[1]).toMatchObject({
      nummer: 2,
      datum: "2027-05-19",
      wochentag: "Mi",
      tagMonat: "19. Mai",
      orte: "guggenheim · casco · puente",
      stationen: 3,
    });
    expect(zeilen[1].ueberschrift.length).toBeGreaterThan(0);
  });

  it("nennt hoechstens drei Stationen", () => {
    const { activities, transfers, p } = baskenland();
    const vierte = {
      ...p.puente,
      id: "vierte",
      title: "vierte",
      startAt: "2027-05-19T19:00",
      endAt: "2027-05-19T19:00",
    };
    const alle = [...activities, vierte];
    const tage = druckTage({
      trip: baskenlandTrip(),
      activities: alle,
      pois: [],
    });
    const { zeilen } = druckUebersicht({
      tage,
      activities: alle,
      transfers,
      pois: [],
    });
    expect(zeilen[1].orte.split(" · ")).toHaveLength(3);
    expect(zeilen[1].stationen).toBe(4);
  });

  it("markiert den ersten Tag als Anreise und den letzten als Abreise", () => {
    const { zeilen } = uebersicht();
    expect(zeilen.map((z) => z.reisetag)).toEqual([
      "anreise",
      null,
      null,
      null,
      null,
      "abreise",
    ]);
  });

  it("nimmt die gespeicherte Ueberschrift, sonst die Orte des Tages", () => {
    const tripId = baskenlandTrip().id;
    const { zeilen } = uebersicht({
      ueberschriften: [
        {
          tripId,
          datum: "2027-05-19",
          text: "Guggenheim und Altstadt",
          vonHand: false,
        },
      ],
    });
    expect(zeilen[1].ueberschrift).toBe("Guggenheim und Altstadt");
    // Ohne gespeicherte steht da, was auch auf der Tagesseite steht.
    const tage = druckTage({
      trip: baskenlandTrip(),
      activities: baskenland().activities,
      pois: [],
    });
    expect(zeilen[2].ueberschrift).toBe(tage[2].ueberschrift);
  });
});

describe("Die drei Zahlen auf Seite 2 (req-103)", () => {
  it("nennt Stationen, die vor Ort gefahrenen Kilometer und die Kosten", () => {
    const { zahlen } = uebersicht();
    expect(zahlen.map((z) => [z.wert, z.einheit, z.bezeichnung])).toEqual([
      ["15", null, "Stationen"],
      // 1 + 2 + 14 + 105 + 3 + 2 + 6 -- ohne die 800 km An- und Abreise.
      ["133", "km", "vor Ort gefahren"],
      ["1240", "€", "geplant, für 4"],
    ]);
  });

  it("zaehlt bei einer Anreise mit dem Flugzeug genauso", () => {
    expect(uebersicht({}, "flug").zahlen[1].wert).toBe("133");
  });

  it("nennt keine Kilometer, wenn an einem Tag eine Entfernung fehlt -- sondern die Gegenden", () => {
    const { activities, transfers } = baskenland();
    const ohneT4 = transfers.filter((t) => t.id !== "t4");
    const pois = activities.map(
      (a, index) =>
        ({
          id: `poi-${a.id}`,
          tripId: a.tripId,
          number: index + 1,
          name: a.title,
          ort: "",
          type: "sehenswuerdigkeit",
          position: a.position!,
          status: "gesetzt",
          gegend: index < 8 ? "BIO" : index < 10 ? "SS" : "RIO",
        }) as Poi,
    );
    const mitPoi = activities.map((a) => ({ ...a, poiId: `poi-${a.id}` }));
    const tage = druckTage({
      trip: baskenlandTrip(),
      activities: mitPoi,
      pois,
    });
    const { zahlen } = druckUebersicht({
      tage,
      activities: mitPoi,
      transfers: ohneT4,
      pois,
    });
    expect(zahlen[1]).toMatchObject({ wert: "3", bezeichnung: "Gegenden" });
    expect(zahlen[1].einheit).not.toBe("km");
  });

  it("nennt auch bei einer Entfernung von 0 keine Kilometer", () => {
    const { transfers } = baskenland();
    const { zahlen } = uebersicht({
      transfers: transfers.map((t) =>
        t.id === "t2" ? { ...t, distanceKm: 0 } : t,
      ),
    });
    expect(zahlen[1].einheit).toBeNull();
    expect(zahlen[1].bezeichnung).toBe("Reisetage");
  });
});

describe("uebersichtTitel (req-103)", () => {
  it("nennt Tage und Gegenden in Worten", () => {
    expect(uebersichtTitel(6, 3)).toBe("Sechs Tage, drei Gegenden");
    expect(uebersichtTitel(6, 1)).toBe("Sechs Tage");
    expect(uebersichtTitel(14, 0)).toBe("14 Tage");
    expect(uebersichtTitel(1, 0)).toBe("Ein Tag");
  });
});
