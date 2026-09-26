import { describe, expect, it } from "vitest";
import { HOUR_HEIGHT_PX, computeBlockLayout } from "./timeline-grid";
import {
  ZOOM_GRUNDSTUFE_PX,
  ZOOM_MAX_PX,
  ZOOM_MIN_PX,
  ZOOM_STUFEN_PX,
  groessereStundenhoehePx,
  istGroessteStundenhoehe,
  istKleinsteStundenhoehe,
  kleinereStundenhoehePx,
} from "./timeline-zoom";

/**
 * Die Stufen des Zooms (req-076): eine Stunde wird hoeher oder flacher
 * dargestellt, mit einer sinnvollen Ober- und Untergrenze.
 */
describe("Zoomstufen des Zeitstrahls (req-076)", () => {
  it("beginnt in der Grundeinstellung bei der bisherigen Stundenhoehe", () => {
    // Wer nichts zoomt, sieht denselben Zeitstrahl wie vor req-076.
    expect(ZOOM_GRUNDSTUFE_PX).toBe(HOUR_HEIGHT_PX);
    expect(ZOOM_STUFEN_PX).toContain(HOUR_HEIGHT_PX);
  });

  it("ordnet die Stufen von der flachsten zur hoechsten", () => {
    expect([...ZOOM_STUFEN_PX].sort((a, b) => a - b)).toEqual(ZOOM_STUFEN_PX);
    expect(ZOOM_MIN_PX).toBe(ZOOM_STUFEN_PX[0]);
    expect(ZOOM_MAX_PX).toBe(ZOOM_STUFEN_PX[ZOOM_STUFEN_PX.length - 1]);
  });

  it("laesst die Grundeinstellung in beide Richtungen zu", () => {
    // Sonst waere sie schon eine der Grenzen, und der Zeitstrahl liesse sich
    // nur in eine Richtung zoomen.
    expect(ZOOM_MIN_PX).toBeLessThan(ZOOM_GRUNDSTUFE_PX);
    expect(ZOOM_MAX_PX).toBeGreaterThan(ZOOM_GRUNDSTUFE_PX);
  });

  it("haelt die flachste Stufe hoch genug fuer einen lesbaren Block", () => {
    // Ein Programmpunkt von einer Stunde muss die Hoehe haben, in der Nummer
    // und Titel ganz stehen (req-074, min-height des Blocks: 24 px).
    expect(ZOOM_MIN_PX).toBeGreaterThanOrEqual(24);
  });

  it("haelt die hoechste Stufe bei einem bedienbaren Tag", () => {
    // Ein Tag von 08:00 bis 22:00 bleibt in wenigen Bildlaeufen zu
    // ueberblicken -- unbedienbar lang muss es nicht werden.
    expect(14 * ZOOM_MAX_PX).toBeLessThanOrEqual(1500);
  });
});

describe("Vergroessern und Verkleinern (req-076)", () => {
  it("geht vergroessert auf die naechsthoehere Stufe", () => {
    expect(groessereStundenhoehePx(ZOOM_GRUNDSTUFE_PX)).toBeGreaterThan(
      ZOOM_GRUNDSTUFE_PX,
    );
    expect(groessereStundenhoehePx(ZOOM_STUFEN_PX[0])).toBe(ZOOM_STUFEN_PX[1]);
  });

  it("geht verkleinert auf die naechstflachere Stufe", () => {
    expect(kleinereStundenhoehePx(ZOOM_GRUNDSTUFE_PX)).toBeLessThan(
      ZOOM_GRUNDSTUFE_PX,
    );
    expect(kleinereStundenhoehePx(ZOOM_STUFEN_PX[1])).toBe(ZOOM_STUFEN_PX[0]);
  });

  it("bleibt an den Grenzen stehen", () => {
    expect(groessereStundenhoehePx(ZOOM_MAX_PX)).toBe(ZOOM_MAX_PX);
    expect(kleinereStundenhoehePx(ZOOM_MIN_PX)).toBe(ZOOM_MIN_PX);
    expect(istGroessteStundenhoehe(ZOOM_MAX_PX)).toBe(true);
    expect(istKleinsteStundenhoehe(ZOOM_MIN_PX)).toBe(true);
    expect(istGroessteStundenhoehe(ZOOM_GRUNDSTUFE_PX)).toBe(false);
    expect(istKleinsteStundenhoehe(ZOOM_GRUNDSTUFE_PX)).toBe(false);
  });

  it("findet von jeder Stufe zurueck auf dieselbe", () => {
    // Vergroessern und wieder verkleinern ergibt die Ausgangsstufe -- sonst
    // wanderte der Zoom bei jedem Hin und Her.
    for (const stufe of ZOOM_STUFEN_PX) {
      if (!istGroessteStundenhoehe(stufe)) {
        expect(kleinereStundenhoehePx(groessereStundenhoehePx(stufe))).toBe(
          stufe,
        );
      }
      if (!istKleinsteStundenhoehe(stufe)) {
        expect(groessereStundenhoehePx(kleinereStundenhoehePx(stufe))).toBe(
          stufe,
        );
      }
    }
  });
});

/**
 * Was der Zoom im Raster bewirkt (req-076, Akzeptanzkriterien 1 und 2):
 * dieselbe Stunde wird hoeher bzw. flacher gezeichnet.
 */
describe("Raster mit gezoomter Stundenhoehe (req-076)", () => {
  const STUNDE = {
    startAt: "2026-07-18T10:00",
    endAt: "2026-07-18T11:00",
  };

  function hoeheDerStunde(hourHeightPx: number) {
    return computeBlockLayout(
      STUNDE,
      { startHour: 8, endHour: 22, hourHeightPx },
      "2026-07-18",
    ).heightPx;
  }

  it("zeichnet dieselbe Stunde vergroessert hoeher", () => {
    expect(
      hoeheDerStunde(groessereStundenhoehePx(ZOOM_GRUNDSTUFE_PX)),
    ).toBeGreaterThan(hoeheDerStunde(ZOOM_GRUNDSTUFE_PX));
  });

  it("zeichnet dieselbe Stunde verkleinert flacher", () => {
    expect(
      hoeheDerStunde(kleinereStundenhoehePx(ZOOM_GRUNDSTUFE_PX)),
    ).toBeLessThan(hoeheDerStunde(ZOOM_GRUNDSTUFE_PX));
  });

  it("bleibt ohne Angabe bei der Grundeinstellung", () => {
    // Jede Stelle, die kein Raster mit Zoom mitgibt, rechnet weiter mit 48 px.
    expect(
      computeBlockLayout(STUNDE, { startHour: 8, endHour: 22 }, "2026-07-18")
        .heightPx,
    ).toBe(HOUR_HEIGHT_PX);
  });
});
