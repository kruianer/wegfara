import { describe, expect, it } from "vitest";
import type { Activity } from "@/lib/activities/types";
import { groupActivities } from "@/lib/activities/groups";
import type { Transfer } from "@/lib/transfers/types";
import { insertTransfers } from "@/lib/transfers/timeline";
import { planEintragZu } from "./plan-eintrag";
import { OHNE_STANDORT, type Standortlage } from "./types";
import { zeitstrahlLinien } from "./zeitstrahl-linien";

const TAG = "2026-07-20";

function programmpunkt(
  id: string,
  startAt: string,
  endAt: string,
  position = { lat: 40.6281, lng: 14.4842 },
): Activity {
  return {
    id,
    tripId: "reise-1",
    type: "restaurant",
    title: id,
    shortText: "",
    longText: "",
    startAt: `${TAG}T${startAt}`,
    endAt: `${TAG}T${endAt}`,
    position,
  };
}

const STRAND = programmpunkt("strand", "09:00", "11:00", {
  lat: 40.6262,
  lng: 14.4823,
});
const MITTAG = programmpunkt("mittag", "13:00", "15:00");
const ABEND = programmpunkt("abend", "19:00", "21:00");
const BOOT_A = programmpunkt("boot-a", "16:00", "18:00");
const BOOT_B = programmpunkt("boot-b", "16:00", "18:00");

const ZUM_MITTAG: Transfer = {
  id: "fahrt",
  tripId: "reise-1",
  fromActivityId: STRAND.id,
  toActivityId: MITTAG.id,
  mode: "auto",
  title: "Fahrt nach Positano",
  durationMin: 20,
  distanceKm: 3,
};

function linien(
  activities: Activity[],
  uhr: string,
  transfers: Transfer[] = [ZUM_MITTAG],
  lage: Standortlage = OHNE_STANDORT,
) {
  const entries = insertTransfers(
    groupActivities(activities),
    transfers,
    activities,
  );
  const zeit = `${TAG}T${uhr}`;
  return zeitstrahlLinien(entries, planEintragZu(activities, zeit), lage, zeit);
}

describe("Jetzt-Linie im Zeitstrahl (req-086)", () => {
  it("liegt beim laufenden Programmpunkt und nennt die Uhrzeit", () => {
    // strand(0) fahrt(1) mittag(2) abend(3)
    const { jetzt } = linien([STRAND, MITTAG, ABEND], "14:10");

    expect(jetzt.stelle).toEqual({ art: "bei", index: 2 });
    expect(jetzt.text).toBe("Jetzt · 14:10");
  });

  it("liegt bei zeitgleichen Optionen bei deren Gruppe", () => {
    // strand(0) fahrt(1) mittag(2) boote(3) abend(4)
    const { jetzt } = linien([STRAND, MITTAG, BOOT_A, BOOT_B, ABEND], "16:30");

    expect(jetzt.stelle).toEqual({ art: "bei", index: 3 });
  });

  it("liegt ohne laufenden Punkt auf der Wegzeile vor dem naechsten", () => {
    const { jetzt } = linien([STRAND, MITTAG, ABEND], "11:30");

    expect(jetzt.stelle).toEqual({ art: "weg", index: 1 });
  });

  it("liegt ohne Wegzeile direkt vor dem naechsten Programmpunkt", () => {
    const { jetzt } = linien([STRAND, MITTAG, ABEND], "11:30", []);

    expect(jetzt.stelle).toEqual({ art: "vor", index: 1 });
  });

  it("liegt am Ende, wenn heute nichts mehr ansteht", () => {
    const { jetzt } = linien([STRAND, MITTAG, ABEND], "22:00");

    expect(jetzt.stelle).toEqual({ art: "ende" });
  });

  it("zeigt ohne geteilte Position keine GPS-Linie", () => {
    expect(linien([STRAND, MITTAG], "14:10").gps).toBeNull();
  });
});
