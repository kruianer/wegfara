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

describe("GPS-Linie im Zeitstrahl (req-086)", () => {
  const VERSPAETET: Standortlage["verzug"] = {
    art: "verspaetet",
    minuten: 25,
  };

  it("liegt beim Programmpunkt am Ort der Position", () => {
    const { jetzt, gps } = linien([STRAND, MITTAG, ABEND], "14:10", undefined, {
      ort: "Positano",
      verzug: VERSPAETET,
      beiProgrammpunkt: STRAND.id,
    });

    expect(gps).toEqual({
      stelle: { art: "bei", index: 0 },
      text: "GPS · 25 Min zu spät",
    });
    expect(jetzt.text).toBe("Jetzt · 14:10");
  });

  it("liegt unterwegs auf der Wegzeile zum laufenden Programmpunkt", () => {
    const { gps } = linien([STRAND, MITTAG, ABEND], "14:10", undefined, {
      ort: "Praiano",
      verzug: VERSPAETET,
    });

    expect(gps).toEqual({
      stelle: { art: "weg", index: 1 },
      text: "unterwegs · 25 Min zu spät",
    });
  });

  it("liegt unterwegs direkt vor dem naechsten, wenn keine Wegzeile hinfuehrt", () => {
    const { gps } = linien([STRAND, MITTAG, ABEND], "16:00", undefined, {
      ort: "Praiano",
      verzug: { art: "ankunft_im_plan" },
    });

    // strand(0) fahrt(1) mittag(2) abend(3)
    expect(gps).toEqual({
      stelle: { art: "vor", index: 3 },
      text: "unterwegs · Ankunft im Plan",
    });
  });

  it("wird am Ort des laufenden Punkts eins mit der Jetzt-Linie", () => {
    const { jetzt, gps } = linien([STRAND, MITTAG], "14:10", undefined, {
      ort: "Positano",
      verzug: { art: "im_zeitplan" },
      beiProgrammpunkt: MITTAG.id,
    });

    expect(gps).toBeNull();
    expect(jetzt).toEqual({
      stelle: { art: "bei", index: 2 },
      text: "Jetzt · Im Zeitplan",
    });
  });

  it("sagt an der vereinten Linie dasselbe wie die Pille", () => {
    const { jetzt } = linien([STRAND, MITTAG], "14:10", undefined, {
      ort: "Positano",
      verzug: { art: "unbekannt" },
      beiProgrammpunkt: MITTAG.id,
    });

    expect(jetzt.text).toBe("Jetzt · Verzug gerade nicht ermittelbar");
  });

  it("nennt keinen Verzug, wenn heute nichts mehr ansteht", () => {
    const { gps } = linien([STRAND, MITTAG], "22:00", undefined, {
      ort: "Positano",
      verzug: { art: "keiner" },
      beiProgrammpunkt: MITTAG.id,
    });

    expect(gps?.text).toBe("GPS");
  });

  it("fehlt, wenn heute nichts mehr ansteht und die Position an keinem Ort ist", () => {
    const { gps } = linien([STRAND, MITTAG], "22:00", undefined, {
      ort: "Praiano",
      verzug: { art: "keiner" },
    });

    expect(gps).toBeNull();
  });
});
