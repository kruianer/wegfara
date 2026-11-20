import { describe, expect, it } from "vitest";
import { HOUR_HEIGHT_PX } from "./timeline-grid";
import {
  LEERER_TAG_STUNDE,
  ersteSichtbareStunde,
  rollZielPx,
} from "./timeline-rollen";

/**
 * Seit req-112 reicht das Raster ueber den ganzen Tag. Ohne Rollen stuende
 * die Ansicht beim Oeffnen mitten in der Nacht.
 */
const GANZER_TAG = { startHour: 0, endHour: 24 };

describe("ersteSichtbareStunde (req-112)", () => {
  it("laesst eine Stunde Luft ueber dem ersten Programmpunkt", () => {
    const activities = [{ startAt: "2026-07-18T09:00" }];

    expect(ersteSichtbareStunde(activities, "2026-07-18", GANZER_TAG)).toBe(8);
  });

  it("nimmt den fruehesten Punkt, nicht den ersten der Liste", () => {
    const activities = [
      { startAt: "2026-07-18T17:00" },
      { startAt: "2026-07-18T10:30" },
    ];

    expect(ersteSichtbareStunde(activities, "2026-07-18", GANZER_TAG)).toBe(9);
  });

  it("rollt einen leeren Tag auf den Morgen", () => {
    expect(ersteSichtbareStunde([], "2026-07-18", GANZER_TAG)).toBe(
      LEERER_TAG_STUNDE - 1,
    );
  });

  it("geht nie vor den Rasterbeginn", () => {
    const activities = [{ startAt: "2026-07-18T00:15" }];

    expect(ersteSichtbareStunde(activities, "2026-07-18", GANZER_TAG)).toBe(0);
  });

  it("rechnet einen Punkt nach Mitternacht dem Folgetag zu", () => {
    // Er gehoert zum Vortag und liegt im Raster bei Stunde 25.
    const activities = [{ startAt: "2026-07-19T01:00" }];

    expect(
      ersteSichtbareStunde(activities, "2026-07-18", {
        startHour: 0,
        endHour: 26,
      }),
    ).toBe(24);
  });
});

describe("rollZielPx (req-112)", () => {
  it("rollt auf die Stunde vor dem ersten Programmpunkt", () => {
    const ziel = rollZielPx(
      [{ startAt: "2026-07-18T09:00" }],
      "2026-07-18",
      GANZER_TAG,
      600,
    );

    expect(ziel).toBe(8 * HOUR_HEIGHT_PX);
  });

  it("rechnet mit der Stundenhoehe des gewaehlten Zooms (req-076)", () => {
    const ziel = rollZielPx(
      [{ startAt: "2026-07-18T09:00" }],
      "2026-07-18",
      { ...GANZER_TAG, hourHeightPx: 96 },
      600,
    );

    expect(ziel).toBe(8 * 96);
  });

  it("rollt nicht weiter, als das Raster hergibt", () => {
    // 24 Stunden a 48 px sind 1152 px; bei 900 px Sicht bleiben 252 px.
    const ziel = rollZielPx(
      [{ startAt: "2026-07-18T22:00" }],
      "2026-07-18",
      GANZER_TAG,
      900,
    );

    expect(ziel).toBe(24 * HOUR_HEIGHT_PX - 900);
  });

  it("rollt gar nicht, wenn das ganze Raster ins Fenster passt", () => {
    const ziel = rollZielPx(
      [{ startAt: "2026-07-18T22:00" }],
      "2026-07-18",
      GANZER_TAG,
      2000,
    );

    expect(ziel).toBe(0);
  });

  it("bleibt bei einem Punkt am Morgen bei null", () => {
    const ziel = rollZielPx(
      [{ startAt: "2026-07-18T00:30" }],
      "2026-07-18",
      GANZER_TAG,
      600,
    );

    expect(ziel).toBe(0);
  });
});
