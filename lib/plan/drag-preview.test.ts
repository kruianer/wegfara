import { describe, expect, it } from "vitest";
import type { Activity } from "@/lib/activities/types";
import { HOUR_HEIGHT_PX } from "./timeline-grid";
import { timelineDragPreview, timelineDragTimes } from "./drag-preview";

/** Das Raster beginnt um 08:00, wenn der Tag keine frueheren Punkte hat (req-011). */
const GRID = { startHour: 8, endHour: 22 };
const TAG = "2026-05-12";

/** Der Abstand einer Uhrzeit von der Rasteroberkante. */
function offsetFuer(hours: number, minutes = 0): number {
  return (hours - 8 + minutes / 60) * HOUR_HEIGHT_PX;
}

/** Der Programmpunkt der Akzeptanzkriterien: 12. Mai, 10:00 bis 12:30. */
function activity(overrides: Partial<Activity> = {}) {
  return { startAt: `${TAG}T10:00`, endAt: `${TAG}T12:30`, ...overrides };
}

/** Sehenswuerdigkeit: 2,5 h geschaetzte Dauer (req-011, GUI). */
const POI_DAUER = 150;

describe("Vorschau beim Ziehen eines POI (req-046)", () => {
  it("liegt an der Stelle, an der der POI einrasten wird, und traegt deren Uhrzeit", () => {
    const vorschau = timelineDragPreview(
      { kind: "poi", durationMinutes: POI_DAUER },
      TAG,
      offsetFuer(14),
      GRID,
    );

    expect(vorschau).toEqual({
      topPx: 6 * HOUR_HEIGHT_PX,
      heightPx: 2.5 * HOUR_HEIGHT_PX,
      label: "14:00",
    });
  });

  it("bleibt zwischen 14:00 und 14:15 auf 14:00 stehen", () => {
    const knappDanach = timelineDragPreview(
      { kind: "poi", durationMinutes: POI_DAUER },
      TAG,
      offsetFuer(14, 11),
      GRID,
    );

    expect(knappDanach?.label).toBe("14:00");
    expect(knappDanach?.topPx).toBe(6 * HOUR_HEIGHT_PX);
  });

  it("ist so hoch wie die geschaetzte Dauer des POI-Typs", () => {
    // Stadt/Dorf: 3 h.
    expect(
      timelineDragPreview(
        { kind: "poi", durationMinutes: 180 },
        TAG,
        offsetFuer(14),
        GRID,
      )?.heightPx,
    ).toBe(3 * HOUR_HEIGHT_PX);
  });
});

describe("Vorschau beim Ziehen eines Programmpunkts (req-046)", () => {
  it("liegt an der Stelle des Zeigers und behaelt die Dauer", () => {
    const vorschau = timelineDragPreview(
      { kind: "move", activity: activity() },
      TAG,
      offsetFuer(16),
      GRID,
    );

    expect(vorschau).toEqual({
      topPx: 8 * HOUR_HEIGHT_PX,
      heightPx: 2.5 * HOUR_HEIGHT_PX,
      label: "16:00",
    });
  });

  it("zeigt beim Ziehen der oberen Kante den neuen Beginn, das Ende bleibt", () => {
    const vorschau = timelineDragPreview(
      { kind: "resize-start", activity: activity() },
      TAG,
      offsetFuer(9),
      GRID,
    );

    expect(vorschau).toEqual({
      topPx: 1 * HOUR_HEIGHT_PX,
      // 09:00 bis 12:30 -- das Ende steht, die Dauer waechst.
      heightPx: 3.5 * HOUR_HEIGHT_PX,
      label: "09:00",
    });
  });

  it("zeigt beim Ziehen der unteren Kante das neue Ende, der Beginn bleibt", () => {
    const vorschau = timelineDragPreview(
      { kind: "resize-end", activity: activity() },
      TAG,
      offsetFuer(14),
      GRID,
    );

    expect(vorschau).toEqual({
      topPx: 2 * HOUR_HEIGHT_PX,
      heightPx: 4 * HOUR_HEIGHT_PX,
      label: "14:00",
    });
  });

  it("zeigt die kuerzeste Dauer, wenn eine Kante ueber die andere hinausgezogen wird", () => {
    // Obere Kante unter das Ende: 12:15 bis 12:30.
    expect(
      timelineDragPreview(
        { kind: "resize-start", activity: activity() },
        TAG,
        offsetFuer(14),
        GRID,
      ),
    ).toMatchObject({ label: "12:15", heightPx: 0.25 * HOUR_HEIGHT_PX });
    // Untere Kante ueber den Beginn: 10:00 bis 10:15.
    expect(
      timelineDragPreview(
        { kind: "resize-end", activity: activity() },
        TAG,
        offsetFuer(9),
        GRID,
      ),
    ).toMatchObject({ label: "10:15", heightPx: 0.25 * HOUR_HEIGHT_PX });
  });

  it("liefert nichts, wenn der Programmpunkt unbrauchbare Zeiten traegt", () => {
    expect(
      timelineDragPreview(
        { kind: "move", activity: activity({ endAt: "irgendwann" }) },
        TAG,
        offsetFuer(14),
        GRID,
      ),
    ).toBeNull();
  });
});

describe("timelineDragTimes (req-046)", () => {
  it("rechnet dieselben Zeiten aus, die beim Loslassen gespeichert werden", () => {
    // Genau das, was req-039 fuer einen POI und req-040 fuer das Verschieben
    // ergibt -- die Vorschau zeigt nie etwas anderes als das Ergebnis.
    expect(
      timelineDragTimes(
        { kind: "poi", durationMinutes: POI_DAUER },
        TAG,
        offsetFuer(14, 11),
        GRID,
      ),
    ).toEqual({ startAt: `${TAG}T14:00`, endAt: `${TAG}T16:30` });

    expect(
      timelineDragTimes(
        { kind: "move", activity: activity() },
        TAG,
        offsetFuer(14),
        GRID,
      ),
    ).toEqual({ startAt: `${TAG}T14:00`, endAt: `${TAG}T16:30` });
  });

  it("nimmt ein Ende nach Mitternacht auf den Folgetag mit", () => {
    expect(
      timelineDragTimes(
        { kind: "move", activity: activity() },
        TAG,
        offsetFuer(23),
        { startHour: 8, endHour: 26 },
      ),
    ).toEqual({ startAt: `${TAG}T23:00`, endAt: "2026-05-13T01:30" });
  });
});
