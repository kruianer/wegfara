import { describe, expect, it } from "vitest";
import type { Activity } from "@/lib/activities/types";
import type { Transfer } from "@/lib/transfers/types";
import { parseUebernahmePunkte, transferLuecken } from "./uebernahme";

/** Das Uebernehmen eines Planvorschlags (req-056). */

const TAG = "2026-07-18";

function activity(
  id: string,
  von: string,
  bis: string,
  mitOrt = true,
): Activity {
  return {
    id,
    tripId: "trip-1",
    type: "sehenswuerdigkeit",
    title: `Punkt ${id}`,
    shortText: "",
    longText: "",
    startAt: `${TAG}T${von}`,
    endAt: `${TAG}T${bis}`,
    position: mitOrt ? { lat: 40.6, lng: 14.6 } : undefined,
  };
}

describe("parseUebernahmePunkte (req-056)", () => {
  it("uebergeht unveraenderte Programmpunkte -- an ihnen ist nichts zu tun", () => {
    const punkte = parseUebernahmePunkte([
      {
        activityId: "a1",
        poiId: null,
        startAt: `${TAG}T09:00`,
        unveraendert: true,
      },
      {
        activityId: null,
        poiId: "poi-1",
        startAt: `${TAG}T08:00`,
        unveraendert: false,
      },
    ]);

    expect(punkte).toEqual([
      { activityId: null, poiId: "poi-1", startAt: `${TAG}T08:00` },
    ]);
  });

  it("uebergeht Eintraege ohne Zeit und ohne Bezug", () => {
    const punkte = parseUebernahmePunkte([
      { activityId: null, poiId: null, startAt: `${TAG}T08:00` },
      { activityId: "a1", poiId: null, startAt: "" },
      "unsinn",
    ]);

    expect(punkte).toEqual([]);
  });

  it("liefert null, wenn die Anfrage keine Liste enthaelt", () => {
    expect(parseUebernahmePunkte(undefined)).toBeNull();
    expect(parseUebernahmePunkte({ punkte: [] })).toBeNull();
  });
});

describe("transferLuecken (req-056)", () => {
  it("nennt jedes aufeinanderfolgende Paar eines Tages mit einer Luecke", () => {
    const a = activity("a", "08:00", "10:30");
    const b = activity("b", "11:00", "13:00");
    const c = activity("c", "14:00", "16:00");

    const paare = transferLuecken([c, a, b], []);

    expect(paare.map(([von, nach]) => `${von.id}->${nach.id}`)).toEqual([
      "a->b",
      "b->c",
    ]);
  });

  it("laesst aus, wo bereits ein Transfer liegt", () => {
    const a = activity("a", "08:00", "10:30");
    const b = activity("b", "11:00", "13:00");
    const transfer: Transfer = {
      id: "t1",
      tripId: "trip-1",
      fromActivityId: "a",
      toActivityId: "b",
      mode: "auto",
      title: "Nach b",
      durationMin: 20,
      distanceKm: 12,
    };

    expect(transferLuecken([a, b], [transfer])).toEqual([]);
  });

  it("laesst aus, wo keine Luecke bleibt", () => {
    const a = activity("a", "08:00", "10:30");
    const b = activity("b", "10:30", "12:00");

    expect(transferLuecken([a, b], [])).toEqual([]);
  });

  it("laesst aus, wo einem der beiden die Position fehlt", () => {
    const a = activity("a", "08:00", "10:30");
    const b = activity("b", "11:00", "13:00", false);

    expect(transferLuecken([a, b], [])).toEqual([]);
  });

  it("verbindet keine Programmpunkte ueber zwei Reisetage hinweg", () => {
    const a = activity("a", "08:00", "10:30");
    const b = {
      ...activity("b", "08:00", "10:30"),
      startAt: "2026-07-19T08:00",
      endAt: "2026-07-19T10:30",
    };

    expect(transferLuecken([a, b], [])).toEqual([]);
  });
});
