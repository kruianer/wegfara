import { describe, expect, it, vi } from "vitest";
import {
  ermittleRouten,
  FUSS_MAX_KM,
  luftlinieKm,
  transferVorschlag,
  vorgeschlagenesVerkehrsmittel,
  type Routen,
} from "./vorschlag";
import type { Routenprofil, RoutingClient } from "@/lib/routing/client";

const PRAIANO = { lat: 40.6114, lng: 14.6896 };
const POSITANO = { lat: 40.6281, lng: 14.4842 };

/** Die Routen, wie sie der Dienst zu einer Strecke von 3 km meldet. */
const DREI_KM: Routen = {
  auto: { distanzKm: 3.2, dauerMinuten: 7 },
  rad: { distanzKm: 3.1, dauerMinuten: 13 },
  fuss: { distanzKm: 2.9, dauerMinuten: 38 },
};

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

describe("transferVorschlag (req-052, req-059)", () => {
  it("nimmt Dauer und Strecke des Autos aus dessen eigener Route", () => {
    const vorschlag = transferVorschlag({
      auto: { distanzKm: 12.34, dauerMinuten: 21.6 },
    });

    expect(vorschlag?.mode).toBe("auto");
    expect(vorschlag?.proMittel.auto).toEqual({
      distanceKm: 12.3,
      durationMin: 22,
    });
  });

  it("rechnet zu Fuß laenger als mit dem Auto (req-059)", () => {
    const vorschlag = transferVorschlag(DREI_KM);

    expect(vorschlag?.proMittel.fuss?.durationMin).toBe(38);
    expect(vorschlag?.proMittel.fuss?.durationMin).toBeGreaterThan(
      vorschlag!.proMittel.auto!.durationMin,
    );
  });

  it("rechnet das Rad mit dem Rad-Profil (req-059)", () => {
    const vorschlag = transferVorschlag(DREI_KM);

    expect(vorschlag?.proMittel.rad).toEqual({
      distanceKm: 3.1,
      durationMin: 13,
    });
  });

  it("rechnet den Bus wie das Auto (req-059)", () => {
    const vorschlag = transferVorschlag(DREI_KM);

    expect(vorschlag?.proMittel.bus).toEqual(vorschlag?.proMittel.auto);
  });

  it("schlaegt fuer Boot, Flug, Bahn und Fähre nichts vor (req-059)", () => {
    const vorschlag = transferVorschlag(DREI_KM);

    expect(Object.keys(vorschlag?.proMittel ?? {})).toEqual([
      "fuss",
      "rad",
      "auto",
      "bus",
    ]);
  });

  it("liefert nichts, wenn kein Profil eine Route hergibt", () => {
    expect(transferVorschlag({})).toBeNull();
  });

  it("schlaegt ein Verkehrsmittel vor, zu dem es Angaben gibt", () => {
    // Nur die Fussgaenger-Route steht -- dann faellt die Wahl auf sie,
    // obwohl die Strecke ueber 1,5 km lang ist.
    const vorschlag = transferVorschlag({
      fuss: { distanzKm: 3, dauerMinuten: 40 },
    });

    expect(vorschlag?.mode).toBe("fuss");
  });

  it("laesst weder Dauer noch Strecke auf null fallen", () => {
    const vorschlag = transferVorschlag({
      auto: { distanzKm: 0.02, dauerMinuten: 0.1 },
    });

    expect(vorschlag?.proMittel.auto?.durationMin).toBe(1);
    expect(vorschlag?.proMittel.auto?.distanceKm).toBe(0.1);
  });
});

describe("ermittleRouten (req-059)", () => {
  /** Ein Dienst, der jedem Profil eine eigene Route meldet. */
  function dienst(stumm: Routenprofil[] = []): RoutingClient {
    return {
      fahrzeitMinuten: vi.fn(async () => 20),
      strecke: vi.fn(async (_von, _nach, profil: Routenprofil = "auto") =>
        stumm.includes(profil)
          ? null
          : { distanzKm: 3, dauerMinuten: profil === "fuss" ? 40 : 10 },
      ),
    };
  }

  it("fragt alle drei Profile", async () => {
    const client = dienst();

    const routen = await ermittleRouten(client, PRAIANO, POSITANO);

    expect(Object.keys(routen).sort()).toEqual(["auto", "fuss", "rad"]);
    expect(client.strecke).toHaveBeenCalledTimes(3);
  });

  it("laesst ein Profil aus, zu dem der Dienst nichts meldet", async () => {
    const routen = await ermittleRouten(dienst(["rad"]), PRAIANO, POSITANO);

    expect(routen.rad).toBeUndefined();
    expect(routen.auto).toEqual({ distanzKm: 3, dauerMinuten: 10 });
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
