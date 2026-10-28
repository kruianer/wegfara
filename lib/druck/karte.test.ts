import { describe, expect, it } from "vitest";
import {
  baskenland,
  baskenlandTrip,
  ORTE,
  programmpunkt,
  weg,
} from "@/tests/fixtures/baskenland-reise";
import type { Activity } from "@/lib/activities/types";
import type { Transfer } from "@/lib/transfers/types";
import type { DruckKarte } from "./types";
import { druckTage } from "./stationen";
import { tagesfarbe } from "./tagesfarben";
import {
  ausschnitt,
  DRUCK_KACHEL_URL,
  kacheln,
  projiziere,
  STRICHARTEN_LEGENDE,
  strichart,
  tagesKarte,
  uebersichtsKarte,
  vorOrt,
} from "./karte";
import { druckUebersicht } from "./uebersicht";

function karteVon(
  activities: Activity[],
  transfers: Transfer[],
  tageAnzahl = 6,
): DruckKarte {
  const trip = baskenlandTrip(tageAnzahl);
  const tage = druckTage({ trip, activities, pois: [] });
  return uebersichtsKarte({ tage, activities, transfers })!;
}

function drin(karte: DruckKarte, id: string): boolean {
  const nadel = karte.nadeln.find((n) => n.id === id)!;
  return (
    nadel.x >= 0 &&
    nadel.x <= karte.breite &&
    nadel.y >= 0 &&
    nadel.y <= karte.hoehe
  );
}

function linie(karte: DruckKarte, id: string) {
  return karte.linien.find((l) => l.id === id)!;
}

describe("Projektion und Kacheln (req-103)", () => {
  it("legt die Orte so, dass alle in die Flaeche passen", () => {
    const flaeche = { breite: 680, hoehe: 370 };
    const orte = [ORTE.guggenheim, ORTE.concha, ORTE.laguardia];
    const rahmen = ausschnitt(orte, flaeche)!;
    for (const ort of orte) {
      const p = projiziere(ort, rahmen);
      expect(p.x).toBeGreaterThan(0);
      expect(p.x).toBeLessThan(680);
      expect(p.y).toBeGreaterThan(0);
      expect(p.y).toBeLessThan(370);
    }
  });

  it("nimmt helle Kacheln, die die Flaeche bedecken", () => {
    const rahmen = ausschnitt([ORTE.guggenheim, ORTE.concha], {
      breite: 680,
      hoehe: 370,
    })!;
    const grund = kacheln(rahmen);
    expect(grund.length).toBeGreaterThan(0);
    expect(DRUCK_KACHEL_URL).toContain("light_all");
    for (const kachel of grund) {
      expect(kachel.url).toMatch(
        /^https:\/\/[abcd]\.basemaps\.cartocdn\.com\/light_all\/\d+\/\d+\/\d+@2x\.png$/,
      );
    }
    expect(Math.min(...grund.map((k) => k.x))).toBeLessThanOrEqual(0);
    expect(
      Math.max(...grund.map((k) => k.x + k.groesse)),
    ).toBeGreaterThanOrEqual(680);
  });
});

describe("vorOrt (req-103)", () => {
  it("laesst den fernen Ausgangspunkt der Anreise aus", () => {
    const { activities } = baskenland();
    const orte = activities.map((a) => ({ id: a.id, position: a.position! }));
    const ids = vorOrt(orte).map((o) => o.id);
    expect(ids).not.toContain("zuerich");
    expect(ids).not.toContain("heim");
    expect(ids).toContain("laguardia");
    expect(ids).toContain("concha");
  });

  it("laesst bei einer Rundreise ohne Ausreisser alle Orte im Ausschnitt", () => {
    const orte = [ORTE.guggenheim, ORTE.concha, ORTE.laguardia, ORTE.getxo].map(
      (position, index) => ({ id: String(index), position }),
    );
    expect(vorOrt(orte)).toHaveLength(4);
  });
});

describe("Die Uebersichtskarte (req-103)", () => {
  it("gibt es fuer eine Reise mit Orten -- mit Kacheln, Linien und Nadeln", () => {
    const { activities, transfers } = baskenland();
    const karte = karteVon(activities, transfers);
    expect(karte.kacheln.length).toBeGreaterThan(0);
    expect(karte.linien).toHaveLength(transfers.length);
    expect(karte.nadeln).toHaveLength(activities.length);
  });

  it("gibt es nicht, wenn keine Station einen Ort hat", () => {
    const ohne = baskenland().activities.map(({ position, ...rest }) => {
      void position;
      return rest;
    });
    const trip = baskenlandTrip();
    const tage = druckTage({ trip, activities: ohne, pois: [] });
    expect(uebersichtsKarte({ tage, activities: ohne, transfers: [] })).toBe(
      null,
    );
  });

  it("gibt bei sechs Tagen jedem Tag seine eigene Linienfarbe, und die Legende nennt sie", () => {
    const { activities, transfers } = baskenland();
    const karte = karteVon(activities, transfers);
    for (const l of karte.linien) {
      expect(l.farbe).toBe(tagesfarbe(l.tag));
    }
    const farbeJeTag = new Map(karte.linien.map((l) => [l.tag, l.farbe]));
    expect(farbeJeTag.size).toBe(6);
    expect(new Set(farbeJeTag.values()).size).toBe(6);

    const trip = baskenlandTrip();
    const tage = druckTage({ trip, activities, pois: [] });
    const { legende } = druckUebersicht({
      tage,
      activities,
      transfers,
      pois: [],
    });
    expect(legende).toEqual(
      [1, 2, 3, 4, 5, 6].map((tag) => ({ tag, farbe: tagesfarbe(tag) })),
    );
  });

  it.each(["auto", "flug"] as const)(
    "laesst bei einer Anreise mit %s die Stationen vor Ort im Ausschnitt und die Anreise am Rand hinauslaufen",
    (mode) => {
      const { activities, transfers } = baskenland(mode);
      const karte = karteVon(activities, transfers);

      for (const id of [
        "hotel",
        "guggenheim",
        "getxo",
        "concha",
        "laguardia",
        "elciego",
      ]) {
        expect(drin(karte, id)).toBe(true);
      }
      expect(drin(karte, "zuerich")).toBe(false);
      expect(linie(karte, "anreise").strich).toBe("gestrichelt");
      expect(linie(karte, "abreise").strich).toBe("gestrichelt");
    },
  );

  it("waehlt bei Auto und Flug denselben Ausschnitt -- das Verkehrsmittel entscheidet nicht", () => {
    const auto = baskenland("auto");
    const flug = baskenland("flug");
    expect(karteVon(flug.activities, flug.transfers).nadeln).toEqual(
      karteVon(auto.activities, auto.transfers).nadeln,
    );
  });

  it("zieht eine Strecke im Ausschnitt durch und strichelt eine, die hinauslaeuft", () => {
    const { activities, transfers } = baskenland();
    const karte = karteVon(activities, transfers);
    for (const id of ["t1", "t2", "t3", "t4", "t5", "t6", "t7"]) {
      expect(linie(karte, id).strich).toBe("durchgezogen");
    }
    expect(linie(karte, "anreise").strich).toBe("gestrichelt");
  });

  it("wiederholt bei neun Tagen die Farben ab dem achten Tag", () => {
    const { activities, transfers } = baskenland();
    const tag7 = programmpunkt("tag7", 7, "10:00", ORTE.igueldo);
    const tag7b = programmpunkt("tag7b", 7, "12:00", ORTE.concha);
    const tag8 = programmpunkt("tag8", 8, "10:00", ORTE.guggenheim);
    const tag8b = programmpunkt("tag8b", 8, "12:00", ORTE.cascoViejo);
    const tag9 = programmpunkt("tag9", 9, "10:00", ORTE.laguardia);
    const tag9b = programmpunkt("tag9b", 9, "12:00", ORTE.ysios);
    const karte = karteVon(
      [...activities, tag7, tag7b, tag8, tag8b, tag9, tag9b],
      [
        ...transfers,
        weg("w7", tag7, tag7b, "fuss", 2),
        weg("w8", tag8, tag8b, "fuss", 2),
        weg("w9", tag9, tag9b, "auto", 2),
      ],
      9,
    );
    expect(linie(karte, "w8").farbe).toBe(linie(karte, "anreise").farbe);
    expect(linie(karte, "w9").farbe).toBe(linie(karte, "t2").farbe);
    expect(linie(karte, "w7").farbe).not.toBe(linie(karte, "anreise").farbe);
  });
});

describe("Die Tageskarte (req-103)", () => {
  function tageskarte(nummer: number, anreise: "auto" | "flug" = "auto") {
    const { activities, transfers } = baskenland(anreise);
    const trip = baskenlandTrip();
    const tage = druckTage({ trip, activities, pois: [] });
    return tagesKarte({
      tag: tage[nummer - 1],
      tage,
      activities,
      transfers,
    })!;
  }

  it("zeigt nur diesen Tag, in seiner Farbe", () => {
    const karte = tageskarte(4);
    expect(karte.nadeln.map((n) => n.id)).toEqual(["igueldo", "santelmo"]);
    expect(karte.linien.map((l) => l.id)).toEqual(["t5"]);
    for (const teil of [...karte.nadeln, ...karte.linien]) {
      expect(teil.farbe).toBe(tagesfarbe(4));
    }
  });

  it("nummeriert in der Reihenfolge des Tages, nicht nach POI", () => {
    expect(tageskarte(5).nadeln.map((n) => n.nummer)).toEqual([1, 2, 3]);
    expect(tageskarte(2).nadeln.map((n) => [n.id, n.nummer])).toEqual([
      ["guggenheim", 1],
      ["casco", 2],
      ["puente", 3],
    ]);
  });

  it("unterscheidet einen Weg zu Fuss von einem mit dem Auto an der Strichart", () => {
    const tag5 = tageskarte(5);
    const auto = tag5.linien.find((l) => l.id === "t6")!;
    const rad = tag5.linien.find((l) => l.id === "t7")!;
    expect(auto.strich).toBe("durchgezogen");
    expect(rad.strich).toBe("gepunktet");
    expect(auto.farbe).toBe(rad.farbe);

    const tag2 = tageskarte(2);
    expect(tag2.linien.find((l) => l.id === "t2")!.strich).toBe("gepunktet");
    expect(tag2.linien.find((l) => l.id === "t3")!.strich).toBe(
      "kurzGestrichelt",
    );
  });

  it("ordnet jedes Verkehrsmittel einer der drei Arten zu", () => {
    expect(strichart("fuss")).toBe("gepunktet");
    expect(strichart("rad")).toBe("gepunktet");
    for (const mode of ["bus", "bahn", "faehre", "boot"] as const) {
      expect(strichart(mode)).toBe("kurzGestrichelt");
    }
    expect(strichart("auto")).toBe("durchgezogen");
    expect(STRICHARTEN_LEGENDE.map((e) => e.strich)).toEqual([
      "gepunktet",
      "kurzGestrichelt",
      "durchgezogen",
    ]);
  });

  it("richtet den Ausschnitt am Anreisetag nach den Stationen vor Ort", () => {
    for (const anreise of ["auto", "flug"] as const) {
      const karte = tageskarte(1, anreise);
      expect(drin(karte, "hotel")).toBe(true);
      expect(drin(karte, "mercado")).toBe(true);
      expect(drin(karte, "zuerich")).toBe(false);
    }
  });

  it("gibt es nicht fuer einen Tag ohne Orte", () => {
    const { activities, transfers } = baskenland();
    const trip = baskenlandTrip(7);
    const tage = druckTage({ trip, activities, pois: [] });
    expect(tagesKarte({ tag: tage[6], tage, activities, transfers })).toBe(
      null,
    );
  });
});
