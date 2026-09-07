import { describe, expect, it } from "vitest";
import {
  FUSS_MAX_KM,
  luftlinieKm,
  transferVorschlag,
  vorgeschlagenesVerkehrsmittel,
} from "./vorschlag";

const PRAIANO = { lat: 40.6114, lng: 14.6896 };
const POSITANO = { lat: 40.6281, lng: 14.4842 };

describe("vorgeschlagenesVerkehrsmittel (req-052)", () => {
  it("schlaegt bei 800 m „zu Fuß“ vor", () => {
    expect(vorgeschlagenesVerkehrsmittel(0.8)).toBe("fuss");
  });

  it("schlaegt bei 12 km „Auto“ vor", () => {
    expect(vorgeschlagenesVerkehrsmittel(12)).toBe("auto");
  });

  it("zieht die Grenze bei 1,5 km -- genau darauf noch zu Fuß", () => {
    expect(vorgeschlagenesVerkehrsmittel(FUSS_MAX_KM)).toBe("fuss");
    expect(vorgeschlagenesVerkehrsmittel(FUSS_MAX_KM + 0.1)).toBe("auto");
  });
});

describe("transferVorschlag (req-052)", () => {
  it("nimmt Dauer und Strecke des Autos aus der Route selbst", () => {
    const vorschlag = transferVorschlag(
      { distanzKm: 12.34, dauerMinuten: 21.6 },
      11,
    );

    expect(vorschlag.mode).toBe("auto");
    expect(vorschlag.proMittel.auto).toEqual({
      distanceKm: 12.3,
      durationMin: 22,
    });
  });

  it("rechnet zu Fuß aus der Streckenlaenge, nicht aus der Fahrzeit", () => {
    // 0,8 km bei 4,5 km/h sind rund 11 Minuten -- die 3 Minuten des Autos
    // waeren fuer einen Fussweg unbrauchbar.
    const vorschlag = transferVorschlag(
      { distanzKm: 0.8, dauerMinuten: 3 },
      0.7,
    );

    expect(vorschlag.mode).toBe("fuss");
    expect(vorschlag.proMittel.fuss).toEqual({
      distanceKm: 0.8,
      durationMin: 11,
    });
  });

  it("schlaegt fuer jedes der sieben Verkehrsmittel etwas vor", () => {
    const vorschlag = transferVorschlag(
      { distanzKm: 12, dauerMinuten: 20 },
      10,
    );

    for (const angaben of Object.values(vorschlag.proMittel)) {
      expect(angaben.durationMin).toBeGreaterThan(0);
      expect(angaben.distanceKm).toBeGreaterThan(0);
    }
  });

  it("schlaegt fuer die Fähre andere Werte vor als fuer das Auto", () => {
    const vorschlag = transferVorschlag({ distanzKm: 12, dauerMinuten: 20 }, 6);

    // Ueber Wasser zaehlt die Luftlinie, nicht die gefahrene Strasse.
    expect(vorschlag.proMittel.faehre).toEqual({
      distanceKm: 6,
      // 6 km bei 25 km/h sind rund 14 Minuten.
      durationMin: 14,
    });
    expect(vorschlag.proMittel.faehre).not.toEqual(vorschlag.proMittel.auto);
  });

  it("laesst weder Dauer noch Strecke auf null fallen", () => {
    const vorschlag = transferVorschlag(
      { distanzKm: 0.02, dauerMinuten: 0.1 },
      0.02,
    );

    expect(vorschlag.proMittel.flug.durationMin).toBe(1);
    expect(vorschlag.proMittel.flug.distanceKm).toBe(0.1);
  });
});

describe("luftlinieKm (req-052)", () => {
  it("misst den direkten Weg zwischen zwei Stellen", () => {
    // Praiano nach Positano sind rund 17 km Luftlinie.
    expect(luftlinieKm(PRAIANO, POSITANO)).toBeCloseTo(17.5, 0);
  });

  it("misst zwischen derselben Stelle nichts", () => {
    expect(luftlinieKm(PRAIANO, PRAIANO)).toBe(0);
  });
});
