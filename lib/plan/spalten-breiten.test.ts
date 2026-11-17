import { describe, expect, it } from "vitest";
import {
  KARTE_MIN_BREITE_PX,
  POI_AUSWAHL_BREITE_PX,
  TRENNER_BREITE_PX,
  ZEITSTRAHL_MIN_BREITE_PX,
} from "@/lib/design/stil";
import {
  spaltenBreiten,
  UNGEZOGENE_EINTEILUNG,
  zieheLinkenTrenner,
  zieheRechtenTrenner,
} from "./spalten-breiten";

/** Die Reihe der Planung bei 1920 px: das Fenster ohne die Seitenleiste. */
const PLATZ = 1860;
const OFFEN = { platz: PLATZ, zugeklappt: false };

/** Was der Karte bleibt -- sie hat keine eigene Breite. */
function karte(
  breiten: { auswahl: number; zeitstrahl: number },
  platz = PLATZ,
  zugeklappt = false,
) {
  return (
    platz -
    breiten.auswahl -
    breiten.zeitstrahl -
    (zugeklappt ? 1 : 2) * TRENNER_BREITE_PX
  );
}

describe("spaltenBreiten (req-109)", () => {
  it("stellt die Spalten ungezogen wie bisher: 340, 412, Rest", () => {
    expect(spaltenBreiten(UNGEZOGENE_EINTEILUNG, OFFEN)).toEqual({
      auswahl: 340,
      zeitstrahl: 412,
    });
  });

  it("stellt sie, wie sie gezogen wurden", () => {
    expect(spaltenBreiten({ auswahl: 500, zeitstrahl: 700 }, OFFEN)).toEqual({
      auswahl: 500,
      zeitstrahl: 700,
    });
  });

  it("geht nie unter die Untergrenzen, auch nicht mit einem fremden Eintrag", () => {
    expect(spaltenBreiten({ auswahl: 100, zeitstrahl: 50 }, OFFEN)).toEqual({
      auswahl: POI_AUSWAHL_BREITE_PX.offen,
      zeitstrahl: ZEITSTRAHL_MIN_BREITE_PX,
    });
  });

  it("zeigt zugeklappt den Streifen und behaelt die gezogene Breite fuers Aufklappen", () => {
    const einteilung = { auswahl: 500, zeitstrahl: 600 };

    expect(
      spaltenBreiten(einteilung, { platz: PLATZ, zugeklappt: true }).auswahl,
    ).toBe(POI_AUSWAHL_BREITE_PX.zu);
    expect(spaltenBreiten(einteilung, OFFEN).auswahl).toBe(500);
  });

  it("nimmt bei schmalerem Fenster zuerst dem Zeitstrahl, dann der Auswahl", () => {
    const einteilung = { auswahl: 600, zeitstrahl: 900 };
    const platz = 1220;

    const breiten = spaltenBreiten(einteilung, { platz, zugeklappt: false });

    expect(breiten.zeitstrahl).toBe(ZEITSTRAHL_MIN_BREITE_PX);
    expect(karte(breiten, platz)).toBe(KARTE_MIN_BREITE_PX);
    expect(breiten.auswahl).toBeGreaterThanOrEqual(POI_AUSWAHL_BREITE_PX.offen);
  });

  it("laesst ungemessen alles stehen", () => {
    expect(
      spaltenBreiten(
        { auswahl: 900, zeitstrahl: 900 },
        {
          platz: 0,
          zugeklappt: false,
        },
      ),
    ).toEqual({ auswahl: 900, zeitstrahl: 900 });
  });
});

describe("zieheRechtenTrenner (req-109)", () => {
  const start = { auswahl: 340, zeitstrahl: 412 };

  it("macht den Zeitstrahl breiter und die Karte schmaler", () => {
    const breiten = zieheRechtenTrenner(start, 200, OFFEN);

    expect(breiten).toEqual({ auswahl: 340, zeitstrahl: 612 });
    expect(karte(breiten)).toBe(karte(start) - 200);
  });

  it("laesst den Zeitstrahl nicht unter 412 px", () => {
    expect(zieheRechtenTrenner(start, -300, OFFEN).zeitstrahl).toBe(
      ZEITSTRAHL_MIN_BREITE_PX,
    );
  });

  it("laesst der Karte ihre Mindestbreite", () => {
    const breiten = zieheRechtenTrenner(start, 5000, OFFEN);

    expect(karte(breiten)).toBe(KARTE_MIN_BREITE_PX);
  });

  it("rechnet zugeklappt mit dem Streifen und nur einem Trenner", () => {
    const zu = { auswahl: POI_AUSWAHL_BREITE_PX.zu, zeitstrahl: 412 };

    const breiten = zieheRechtenTrenner(zu, 5000, {
      platz: PLATZ,
      zugeklappt: true,
    });

    expect(karte(breiten, PLATZ, true)).toBe(KARTE_MIN_BREITE_PX);
  });
});

describe("zieheLinkenTrenner (req-109)", () => {
  const start = { auswahl: 340, zeitstrahl: 800 };

  it("macht die Auswahl breiter und den Zeitstrahl schmaler", () => {
    expect(zieheLinkenTrenner(start, 160, OFFEN)).toEqual({
      auswahl: 500,
      zeitstrahl: 640,
    });
  });

  it("laesst dabei die Karte stehen", () => {
    const breiten = zieheLinkenTrenner(start, 123, OFFEN);

    expect(karte(breiten)).toBe(karte(start));
  });

  it("laesst die Auswahl nicht unter 340 px", () => {
    expect(zieheLinkenTrenner(start, -200, OFFEN)).toEqual(start);
  });

  it("laesst den Zeitstrahl nicht unter 412 px -- dann gibt die Karte her", () => {
    const breiten = zieheLinkenTrenner(start, 600, OFFEN);

    expect(breiten).toEqual({
      auswahl: 940,
      zeitstrahl: ZEITSTRAHL_MIN_BREITE_PX,
    });
    expect(karte(breiten)).toBe(karte(start) - 600 + (800 - 412));
  });

  it("laesst der Karte ihre Mindestbreite", () => {
    const breiten = zieheLinkenTrenner(start, 5000, OFFEN);

    expect(breiten.zeitstrahl).toBe(ZEITSTRAHL_MIN_BREITE_PX);
    expect(karte(breiten)).toBe(KARTE_MIN_BREITE_PX);
  });

  it("bewegt sich auch, wenn nie gezogen wurde", () => {
    const ungezogen = { auswahl: 340, zeitstrahl: 412 };

    expect(zieheLinkenTrenner(ungezogen, 160, OFFEN)).toEqual({
      auswahl: 500,
      zeitstrahl: 412,
    });
  });

  it("gibt dem Zeitstrahl auf dem Rueckweg zurueck, was er hergab", () => {
    expect(zieheLinkenTrenner(start, 0, OFFEN)).toEqual(start);
    expect(zieheLinkenTrenner(start, 100, OFFEN).zeitstrahl).toBe(700);
  });
});
