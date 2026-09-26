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

  /**
   * req-078: Die hoechste Stufe ist die, auf der sich ein Programmpunkt mit
   * dem Finger treffsicher auf eine Viertelstunde setzen laesst -- ihre
   * Trefferflaeche erreicht die 44 px, die stack.md fuer Bedienelemente
   * verlangt. Vorher waren es 96 px je Stunde und damit 24 px je
   * Viertelstunde, auf dem iPad zu knapp.
   */
  it("gibt der Viertelstunde auf der hoechsten Stufe 44 px (req-078)", () => {
    expect(ZOOM_MAX_PX / 4).toBeGreaterThanOrEqual(44);
  });

  it("bleibt unten bei der bisherigen kleinsten Stufe (req-078)", () => {
    // Beim Verkleinern aendert req-078 nichts -- 24 px je Stunde wie seit
    // req-076.
    expect(ZOOM_MIN_PX).toBe(24);
  });

  /**
   * Die Stufen bleiben Stufen: kein Sprung ist mehr als doppelt so gross wie
   * die Stufe darunter, sonst uebersaehe man beim Zoomen die Haelfte des
   * Weges (req-078).
   */
  it("haelt die Abstaende zwischen den Stufen massvoll", () => {
    for (let i = 1; i < ZOOM_STUFEN_PX.length; i += 1) {
      expect(ZOOM_STUFEN_PX[i]).toBeLessThanOrEqual(2 * ZOOM_STUFEN_PX[i - 1]);
    }
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
