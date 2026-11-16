import { describe, expect, it } from "vitest";
import {
  blaetterZiel,
  blaetterZustand,
  insBildZiel,
  type Spanne,
} from "./blaettern";

/** 21 Reiter wie in der Tagauswahl: 46 px breit, 4 px Abstand. */
const REITER: Spanne[] = Array.from({ length: 21 }, (_, i) => ({
  links: i * 50,
  breite: 46,
}));
const INHALT = 21 * 50 - 4;
const BREITE = 300;
const GANZ_RECHTS = INHALT - BREITE;

function lauf(scrollLeft: number, clientWidth = BREITE, scrollWidth = INHALT) {
  return { scrollLeft, scrollWidth, clientWidth };
}

describe("blaetterZustand (req-110)", () => {
  it("braucht keine Knöpfe, wenn alles in die Leiste passt", () => {
    expect(blaetterZustand(lauf(0, 1200, 1046))).toEqual({
      noetig: false,
      zurueck: false,
      vor: false,
    });
  });

  it("entscheidet nach dem Platz, nicht nach der Zahl der Einträge", () => {
    expect(blaetterZustand(lauf(0, 300)).noetig).toBe(true);
    expect(blaetterZustand(lauf(0, INHALT)).noetig).toBe(false);
  });

  it("übergeht einen Bruchteil eines Pixels Überstand", () => {
    expect(blaetterZustand(lauf(0, 300, 300.6)).noetig).toBe(false);
  });

  it("schaltet ganz links den Weg zurück ab, den nach vorn nicht", () => {
    expect(blaetterZustand(lauf(0))).toEqual({
      noetig: true,
      zurueck: false,
      vor: true,
    });
  });

  it("schaltet ganz rechts den Weg nach vorn ab, den zurück nicht", () => {
    expect(blaetterZustand(lauf(GANZ_RECHTS))).toEqual({
      noetig: true,
      zurueck: true,
      vor: false,
    });
  });

  it("lässt dazwischen beide Wege offen", () => {
    expect(blaetterZustand(lauf(120))).toEqual({
      noetig: true,
      zurueck: true,
      vor: true,
    });
  });
});

describe("blaetterZiel (req-110)", () => {
  it("rückt nach vorn um genau einen Reiter", () => {
    expect(blaetterZiel(REITER, lauf(0), "vor")).toBe(50);
    expect(blaetterZiel(REITER, lauf(150), "vor")).toBe(200);
  });

  it("rückt nach hinten um genau einen Reiter", () => {
    expect(blaetterZiel(REITER, lauf(200), "zurueck")).toBe(150);
    expect(blaetterZiel(REITER, lauf(50), "zurueck")).toBe(0);
  });

  it("rückt nach einem Wisch auf den nächsten Anfang, nie halb darüber hinaus", () => {
    expect(blaetterZiel(REITER, lauf(130), "vor")).toBe(150);
    expect(blaetterZiel(REITER, lauf(130), "zurueck")).toBe(100);
  });

  it("bleibt am Ende stehen", () => {
    expect(blaetterZiel(REITER, lauf(0), "zurueck")).toBe(0);
    expect(blaetterZiel(REITER, lauf(GANZ_RECHTS), "vor")).toBe(GANZ_RECHTS);
  });

  it("steht nach so vielen Schritten nach vorn, wie es Tage gibt, ganz rechts", () => {
    let stand = lauf(0);
    for (let i = 0; i < REITER.length; i++) {
      stand = lauf(blaetterZiel(REITER, stand, "vor"));
    }
    expect(stand.scrollLeft).toBe(GANZ_RECHTS);
    expect(blaetterZustand(stand).vor).toBe(false);
  });

  it("rechnet ab dem ersten Reiter, ein Innenabstand davor bleibt", () => {
    const eingerueckt = REITER.map((r) => ({ ...r, links: r.links + 14 }));
    expect(blaetterZiel(eingerueckt, lauf(0, BREITE, INHALT + 28), "vor")).toBe(
      50,
    );
  });

  it("lässt eine leere Leiste stehen", () => {
    expect(blaetterZiel([], lauf(0), "vor")).toBe(0);
  });
});

describe("insBildZiel (req-110)", () => {
  it("lässt einen Reiter stehen, der schon ganz zu sehen ist", () => {
    expect(insBildZiel(REITER[2], lauf(0))).toBe(0);
  });

  it("rollt einen Reiter, der rechts draußen steht, ganz an den rechten Rand", () => {
    // Reiter 10: 500 bis 546.
    expect(insBildZiel(REITER[10], lauf(0))).toBe(546 - BREITE);
  });

  it("rollt einen halb abgeschnittenen am rechten Rand ganz ins Bild", () => {
    // Reiter 6: 300 bis 346 -- bei 300 px Breite und 10 px Bildlauf halb.
    expect(insBildZiel(REITER[6], lauf(10))).toBe(346 - BREITE);
  });

  it("rollt einen Reiter, der links draußen steht, an den linken Rand", () => {
    expect(insBildZiel(REITER[3], lauf(170))).toBe(150);
  });

  it("hält den Innenabstand zum Rand", () => {
    expect(insBildZiel(REITER[3], lauf(170), 14)).toBe(136);
  });

  it("rollt nie über das Ende hinaus", () => {
    expect(insBildZiel(REITER[20], lauf(0), 14)).toBe(GANZ_RECHTS);
  });
});
