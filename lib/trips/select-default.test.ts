// @vitest-environment node
import { describe, expect, it } from "vitest";
import { defaultTripId, defaultDay } from "./select-default";
import type { Trip } from "./types";

const suedItalien: Trip = {
  id: "sued",
  title: "Süditalien Rundreise",
  startDate: "2026-07-18",
  endDate: "2026-07-23",
  mainPlace: { name: "Amalfi", lat: 40.634, lng: 14.6027 },
  description: "",
  state: "in_planung",
};
const wien: Trip = {
  id: "wien",
  title: "Wien Städtereise",
  startDate: "2026-10-09",
  endDate: "2026-10-11",
  mainPlace: { name: "Wien", lat: 48.2082, lng: 16.3738 },
  description: "",
  state: "in_planung",
};
const alpenAdria: Trip = {
  id: "alpen",
  title: "Alpen-Adria-Radtour",
  startDate: "2026-05-25",
  endDate: "2026-05-31",
  mainPlace: { name: "Villach", lat: 46.6103, lng: 13.8558 },
  description: "",
  state: "in_planung",
};
const trips = [suedItalien, wien, alpenAdria];

describe("defaultTripId", () => {
  it("waehlt die aktive Reise am 20.07.2026", () => {
    expect(defaultTripId(trips, new Date(2026, 6, 20))).toBe("sued");
  });

  it("waehlt ohne aktive Reise die naechste geplante", () => {
    // 01.06.2026: Alpen-Adria ist beendet, Süditalien und Wien sind geplant -> Süditalien ist naeher
    expect(defaultTripId(trips, new Date(2026, 5, 1))).toBe("sued");
  });

  it("waehlt ohne aktive/geplante Reise die zuletzt beendete", () => {
    expect(defaultTripId(trips, new Date(2026, 11, 1))).toBe("wien");
  });
});

describe("defaultDay", () => {
  it("waehlt den heutigen Tag, wenn er im Reisezeitraum liegt", () => {
    expect(defaultDay(suedItalien, new Date(2026, 6, 20))).toBe("2026-07-20");
  });

  it("waehlt den Anreisetag, wenn heute ausserhalb des Zeitraums liegt", () => {
    expect(defaultDay(wien, new Date(2026, 6, 20))).toBe("2026-10-09");
  });
});
