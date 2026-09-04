import { describe, expect, it } from "vitest";
import type { Activity } from "@/lib/activities/types";
import type { Trip } from "@/lib/trips/types";
import { HOUR_HEIGHT_PX } from "./timeline-grid";
import {
  dropEndAt,
  durationMinutes,
  movedActivityTimes,
  resizedActivityTimes,
  sameTimeOnDay,
} from "./move-activity";

const TRIP: Trip = {
  id: "trip-1",
  title: "Süditalien Rundreise",
  startDate: "2026-05-11",
  endDate: "2026-05-16",
  mainPlace: { name: "Amalfi", lat: 40.634, lng: 14.6027 },
  description: "",
  state: "in_planung",
};

/** Das Raster beginnt um 08:00, wenn der Tag keine frueheren Punkte hat (req-011). */
const GRID = { startHour: 8, endHour: 22 };

/** Der Programmpunkt der Akzeptanzkriterien: 12. Mai, 10:00 bis 12:30. */
function activity(overrides: Partial<Activity> = {}): Activity {
  return {
    id: "activity-1",
    tripId: TRIP.id,
    type: "sehenswuerdigkeit",
    title: "Ausgrabungsstätte Pompeji",
    shortText: "",
    longText: "",
    startAt: "2026-05-12T10:00",
    endAt: "2026-05-12T12:30",
    ...overrides,
  };
}

describe("durationMinutes (req-040)", () => {
  it("misst die Dauer, auch ueber Mitternacht hinweg", () => {
    expect(durationMinutes(activity())).toBe(150);
    expect(
      durationMinutes({
        startAt: "2026-05-12T23:00",
        endAt: "2026-05-13T01:30",
      }),
    ).toBe(150);
  });

  it("weist unbrauchbare Zeitangaben ab", () => {
    expect(
      durationMinutes({ startAt: "2026-05-12", endAt: "2026-05-12T12:30" }),
    ).toBeNull();
  });
});

describe("movedActivityTimes (req-040)", () => {
  it("behaelt die Dauer beim Verschieben auf eine andere Uhrzeit", () => {
    // Von 10:00–12:30 auf 14:00 gezogen: 14:00–16:30.
    expect(movedActivityTimes(activity(), TRIP, "2026-05-12T14:00")).toEqual({
      startAt: "2026-05-12T14:00",
      endAt: "2026-05-12T16:30",
    });
  });

  it("behaelt Uhrzeit und Dauer beim Wechsel auf einen anderen Reisetag", () => {
    const gezogen = activity();

    expect(
      movedActivityTimes(gezogen, TRIP, sameTimeOnDay(gezogen, "2026-05-13")),
    ).toEqual({ startAt: "2026-05-13T10:00", endAt: "2026-05-13T12:30" });
  });

  it("rastet die neue Startzeit auf 15 Minuten ein", () => {
    expect(movedActivityTimes(activity(), TRIP, "2026-05-12T14:11")).toEqual({
      startAt: "2026-05-12T14:00",
      endAt: "2026-05-12T16:30",
    });
  });

  it("nimmt ein Ende nach Mitternacht auf den Folgetag mit", () => {
    expect(movedActivityTimes(activity(), TRIP, "2026-05-12T23:00")).toEqual({
      startAt: "2026-05-12T23:00",
      endAt: "2026-05-13T01:30",
    });
  });

  it("laesst sich nicht auf einen Tag ausserhalb des Reisezeitraums ziehen", () => {
    expect(movedActivityTimes(activity(), TRIP, "2026-05-10T10:00")).toBeNull();
    expect(movedActivityTimes(activity(), TRIP, "2026-05-17T10:00")).toBeNull();
    // Die Raender des Zeitraums selbst bleiben erlaubt.
    expect(
      movedActivityTimes(activity(), TRIP, "2026-05-11T10:00"),
    ).not.toBeNull();
    expect(
      movedActivityTimes(activity(), TRIP, "2026-05-16T10:00"),
    ).not.toBeNull();
  });

  it("weist eine unbrauchbare Zeitangabe ab", () => {
    expect(movedActivityTimes(activity(), TRIP, "2026-05-12")).toBeNull();
    expect(movedActivityTimes(activity(), TRIP, "nachmittags")).toBeNull();
  });
});

describe("resizedActivityTimes (req-040)", () => {
  it("zieht das Ende an die gezogene Stelle, der Beginn bleibt", () => {
    expect(resizedActivityTimes(activity(), "2026-05-12T14:00")).toEqual({
      startAt: "2026-05-12T10:00",
      endAt: "2026-05-12T14:00",
    });
  });

  it("verkuerzt den Programmpunkt", () => {
    expect(resizedActivityTimes(activity(), "2026-05-12T11:00")).toEqual({
      startAt: "2026-05-12T10:00",
      endAt: "2026-05-12T11:00",
    });
  });

  it("rastet das neue Ende auf 15 Minuten ein", () => {
    expect(resizedActivityTimes(activity(), "2026-05-12T14:11")?.endAt).toBe(
      "2026-05-12T14:00",
    );
  });

  it("bleibt bei 15 Minuten, wenn ueber den Beginn hinaus nach oben gezogen wird", () => {
    // Ueber den Beginn hinaus: der Programmpunkt endet um 10:15 und nicht frueher.
    expect(resizedActivityTimes(activity(), "2026-05-12T09:00")?.endAt).toBe(
      "2026-05-12T10:15",
    );
    expect(resizedActivityTimes(activity(), "2026-05-12T10:00")?.endAt).toBe(
      "2026-05-12T10:15",
    );
  });

  it("legt ein Ende nach Mitternacht auf den Folgetag", () => {
    const spaet = activity({
      startAt: "2026-05-12T22:00",
      endAt: "2026-05-12T23:00",
    });

    expect(resizedActivityTimes(spaet, "2026-05-13T01:00")).toEqual({
      startAt: "2026-05-12T22:00",
      endAt: "2026-05-13T01:00",
    });
  });

  it("weist eine unbrauchbare Zeitangabe ab", () => {
    expect(resizedActivityTimes(activity(), "2026-05-12")).toBeNull();
    expect(
      resizedActivityTimes(
        activity({ startAt: "spaeter" }),
        "2026-05-12T14:00",
      ),
    ).toBeNull();
  });
});

describe("dropEndAt (req-040)", () => {
  it("endet dort, wo der untere Rand losgelassen wurde", () => {
    // Sechs Stunden unter dem Rasterbeginn 08:00.
    expect(dropEndAt("2026-05-12", 6 * HOUR_HEIGHT_PX, GRID)).toBe(
      "2026-05-12T14:00",
    );
  });

  it("rastet auf die zuletzt erreichte Viertelstunde ein", () => {
    const knappVorViertel = 6 * HOUR_HEIGHT_PX + (14 / 60) * HOUR_HEIGHT_PX;

    expect(dropEndAt("2026-05-12", knappVorViertel, GRID)).toBe(
      "2026-05-12T14:00",
    );
  });

  it("darf ueber Mitternacht hinausreichen -- anders als ein Beginn", () => {
    const nachMitternacht = { startHour: 8, endHour: 26 };

    expect(dropEndAt("2026-05-12", 17 * HOUR_HEIGHT_PX, nachMitternacht)).toBe(
      "2026-05-13T01:00",
    );
  });
});
