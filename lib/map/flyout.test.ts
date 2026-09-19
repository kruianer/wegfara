import { describe, expect, it } from "vitest";
import {
  FLYOUT_ABSTAND_PX,
  FLYOUT_BREITE_PX,
  FLYOUT_HOEHE_PX,
  flyoutAusrichtung,
  flyoutBreite,
  flyoutKasten,
  type Groesse,
  type Punkt,
} from "./flyout";

/** Eine Karte, auf der das Flyout in jede Richtung Platz haette. */
const GROSSE_KARTE: Groesse = { breite: 1000, hoehe: 800 };

/** Das Flyout in der Groesse, die diese Karte hergibt. */
function groesseAuf(karte: Groesse): Groesse {
  return { breite: flyoutBreite(karte.breite), hoehe: FLYOUT_HOEHE_PX };
}

/** Wo das Flyout eines Markers liegt, wenn es sich selbst ausrichtet. */
function kastenFuer(marker: Punkt, karte: Groesse = GROSSE_KARTE) {
  const flyout = groesseAuf(karte);
  return flyoutKasten(flyoutAusrichtung(marker, karte, flyout), marker, flyout);
}

function liegtGanzAuf(marker: Punkt, karte: Groesse) {
  const kasten = kastenFuer(marker, karte);
  return (
    kasten.links >= 0 &&
    kasten.oben >= 0 &&
    kasten.rechts <= karte.breite &&
    kasten.unten <= karte.hoehe
  );
}

describe("flyoutAusrichtung -- Seite am Rand der Karte (req-070)", () => {
  it("klappt mitten auf der Karte nach rechts auf", () => {
    // Dort verdeckt es am wenigsten von dem, was man gerade ansieht.
    expect(flyoutAusrichtung({ x: 500, y: 400 }, GROSSE_KARTE).seite).toBe(
      "rechts",
    );
  });

  it("klappt am rechten Rand nach links auf, statt abgeschnitten zu werden", () => {
    const marker = { x: 960, y: 400 };

    expect(flyoutAusrichtung(marker, GROSSE_KARTE).seite).toBe("links");
    expect(kastenFuer(marker).rechts).toBeLessThanOrEqual(GROSSE_KARTE.breite);
  });

  it("bleibt am linken Rand rechts vom Marker", () => {
    const marker = { x: 20, y: 400 };

    expect(flyoutAusrichtung(marker, GROSSE_KARTE).seite).toBe("rechts");
    expect(kastenFuer(marker).links).toBeGreaterThanOrEqual(0);
  });

  it("wechselt genau dann, wenn rechts ein Pixel fehlt", () => {
    const passtGerade =
      GROSSE_KARTE.breite - FLYOUT_BREITE_PX - FLYOUT_ABSTAND_PX;

    expect(
      flyoutAusrichtung({ x: passtGerade, y: 400 }, GROSSE_KARTE).seite,
    ).toBe("rechts");
    expect(
      flyoutAusrichtung({ x: passtGerade + 1, y: 400 }, GROSSE_KARTE).seite,
    ).toBe("links");
  });

  it("nimmt auf einer Karte, die fuer beides zu schmal ist, die Seite mit mehr Platz", () => {
    const schmal: Groesse = { breite: 300, hoehe: 800 };

    expect(flyoutAusrichtung({ x: 250, y: 400 }, schmal).seite).toBe("links");
    expect(flyoutAusrichtung({ x: 50, y: 400 }, schmal).seite).toBe("rechts");
  });
});

describe("flyoutAusrichtung -- Hoehe am Rand der Karte (req-070)", () => {
  it("stellt das Flyout ueber die Spitze des Tropfens", () => {
    expect(flyoutAusrichtung({ x: 500, y: 400 }, GROSSE_KARTE).hoehe).toBe(
      "oben",
    );
  });

  it("haengt es am oberen Rand unter den Marker", () => {
    const marker = { x: 500, y: 40 };

    expect(flyoutAusrichtung(marker, GROSSE_KARTE).hoehe).toBe("unten");
    expect(kastenFuer(marker).oben).toBeGreaterThanOrEqual(0);
  });

  it("rueckt es in die Mitte, wenn weder darueber noch darunter Platz ist", () => {
    // Eine Karte, die kaum hoeher ist als das Flyout: oben wie unten steht
    // es ueber den Rand, mittig bleibt am wenigsten uebrig.
    const flach: Groesse = { breite: 1000, hoehe: FLYOUT_HOEHE_PX + 20 };

    expect(flyoutAusrichtung({ x: 500, y: 150 }, flach).hoehe).toBe("mitte");
  });
});

describe("flyoutAusrichtung -- vollstaendig sichtbar (req-070)", () => {
  it("laesst das Flyout an jeder Stelle einer gewoehnlichen Karte ganz auf ihr liegen", () => {
    // Jede Ecke, jede Kante, die Mitte -- ueberall muss es vollstaendig zu
    // sehen sein.
    for (const x of [0, 1, 120, 500, 880, 999, 1000]) {
      for (const y of [0, 1, 120, 400, 700, 799, 800]) {
        expect(liegtGanzAuf({ x, y }, GROSSE_KARTE)).toBe(true);
      }
    }
  });

  it("bleibt auch auf der schmalsten Karte des Planers ganz auf ihr", () => {
    // Der Planer verlangt mindestens 1180 px (lib/plan/viewport.ts); die
    // Karte bekommt davon den kleineren Teil. Ein Marker genau in ihrer Mitte
    // hat zu beiden Seiten gleich wenig Platz -- da muss das Flyout nachgeben.
    const karte: Groesse = { breite: 460, hoehe: 600 };

    expect(flyoutBreite(karte.breite)).toBeLessThan(FLYOUT_BREITE_PX);
    for (const x of [0, 100, 230, 360, 460]) {
      expect(liegtGanzAuf({ x, y: 300 }, karte)).toBe(true);
    }
  });
});

describe("flyoutBreite (req-070)", () => {
  it("laesst das Flyout auf einer breiten Karte in voller Breite", () => {
    expect(flyoutBreite(1000)).toBe(FLYOUT_BREITE_PX);
  });

  it("laesst es auf einer schmalen Karte nachgeben, statt ueber den Rand zu stehen", () => {
    // Regel 1 aus stack.md: nichts steht ueber den Rand.
    expect(flyoutBreite(460)).toBe(230 - FLYOUT_ABSTAND_PX);
  });

  it("wird nie negativ", () => {
    expect(flyoutBreite(0)).toBe(0);
  });
});

describe("flyoutKasten (req-070)", () => {
  it("setzt das Flyout rechts mit Abstand neben die Spitze", () => {
    const kasten = flyoutKasten(
      { seite: "rechts", hoehe: "oben" },
      {
        x: 100,
        y: 500,
      },
    );

    expect(kasten.links).toBe(100 + FLYOUT_ABSTAND_PX);
    expect(kasten.rechts).toBe(100 + FLYOUT_ABSTAND_PX + FLYOUT_BREITE_PX);
    // "oben" heisst: die Unterkante liegt auf der Spitze des Tropfens.
    expect(kasten.unten).toBe(500);
    expect(kasten.oben).toBe(500 - FLYOUT_HOEHE_PX);
  });

  it("setzt es links mit demselben Abstand", () => {
    const kasten = flyoutKasten(
      { seite: "links", hoehe: "unten" },
      {
        x: 900,
        y: 100,
      },
    );

    expect(kasten.rechts).toBe(900 - FLYOUT_ABSTAND_PX);
    expect(kasten.links).toBe(900 - FLYOUT_ABSTAND_PX - FLYOUT_BREITE_PX);
    // "unten" heisst: die Oberkante liegt auf der Spitze des Tropfens.
    expect(kasten.oben).toBe(100);
  });

  it("legt es bei „mitte“ mittig auf die Hoehe der Spitze", () => {
    const kasten = flyoutKasten(
      { seite: "rechts", hoehe: "mitte" },
      {
        x: 100,
        y: 500,
      },
    );

    expect(kasten.oben).toBe(500 - FLYOUT_HOEHE_PX / 2);
    expect(kasten.unten).toBe(500 + FLYOUT_HOEHE_PX / 2);
  });
});
