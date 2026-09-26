import { describe, expect, it } from "vitest";
import { routenPfeile } from "./pfeile";
import type { DayMapLine } from "./day-map";

/**
 * Die Richtungspfeile der Tageskarte (req-075): wo sie sitzen und wohin sie
 * zeigen. Gerechnet wird ohne Karte -- die Zeichnung selbst prueft
 * app/plan/components/day-route-map.test.tsx.
 */

const AMALFI = { lat: 40.634, lng: 14.602 };

function linie(overrides: Partial<DayMapLine> = {}): DayMapLine {
  const verlauf = overrides.verlauf ?? [AMALFI, { lat: 40.634, lng: 14.702 }];
  return {
    mode: null,
    from: verlauf[0],
    to: verlauf[verlauf.length - 1],
    transferId: null,
    gerade: true,
    vonNummer: 1,
    nachNummer: 2,
    ...overrides,
    verlauf,
  };
}

describe("routenPfeile (req-075)", () => {
  it("legt den Pfeil einer Geraden auf ihre Mitte", () => {
    const [pfeil] = routenPfeile([linie()]);

    expect(pfeil.position.lat).toBeCloseTo(40.634, 6);
    expect(pfeil.position.lng).toBeCloseTo(14.652, 6);
  });

  it("laesst ihn nach Osten zeigen, wo es nach Osten geht", () => {
    const [pfeil] = routenPfeile([linie()]);

    expect(pfeil.winkel).toBeCloseTo(90, 6);
  });

  it("dreht ihn um, wenn dieselben Orte in umgekehrter Folge liegen", () => {
    const [pfeil] = routenPfeile([
      linie({ verlauf: [{ lat: 40.634, lng: 14.702 }, AMALFI] }),
    ]);

    expect(pfeil.winkel).toBeCloseTo(270, 6);
  });

  it("zeigt nach Norden, wo es nach Norden geht", () => {
    const [pfeil] = routenPfeile([
      linie({ verlauf: [AMALFI, { lat: 40.734, lng: 14.602 }] }),
    ]);

    expect(pfeil.winkel).toBeCloseTo(0, 6);
  });

  it("folgt dem Strassenverlauf statt der Luftlinie", () => {
    // Ein Knick nach Norden und wieder zurueck: die halbe Strecke liegt im
    // Knick, und dort geht es nach Sueden -- nicht nach Osten wie die
    // Luftlinie.
    const [pfeil] = routenPfeile([
      linie({
        gerade: false,
        verlauf: [
          AMALFI,
          { lat: 40.734, lng: 14.602 },
          { lat: 40.634, lng: 14.602 },
          { lat: 40.634, lng: 14.702 },
        ],
      }),
    ]);

    expect(pfeil.winkel).toBeCloseTo(180, 6);
    expect(pfeil.position.lng).toBeCloseTo(14.602, 6);
  });

  it("gibt zwei Programmpunkten am selben Ort keinen Pfeil", () => {
    expect(routenPfeile([linie({ verlauf: [AMALFI, AMALFI] })])).toHaveLength(
      0,
    );
  });

  it("uebersteht einen Verlauf, der zwischendurch stillsteht", () => {
    const [pfeil] = routenPfeile([
      linie({
        verlauf: [AMALFI, AMALFI, { lat: 40.634, lng: 14.702 }],
      }),
    ]);

    expect(pfeil.winkel).toBeCloseTo(90, 6);
    expect(pfeil.position.lng).toBeCloseTo(14.652, 6);
  });

  it("nennt die beiden Programmpunkte, die der Pfeil verbindet", () => {
    const [pfeil] = routenPfeile([linie({ vonNummer: 3, nachNummer: 4 })]);

    expect(pfeil.vonNummer).toBe(3);
    expect(pfeil.nachNummer).toBe(4);
  });

  it("gibt je Linie genau einen Pfeil", () => {
    expect(routenPfeile([linie(), linie(), linie()])).toHaveLength(3);
  });
});
