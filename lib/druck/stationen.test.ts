import { describe, expect, it } from "vitest";
import {
  DRUCK_ACTIVITIES,
  DRUCK_POIS,
  DRUCK_TAG_1,
  DRUCK_TAG_2,
  DRUCK_TRIP,
  POI_DORNBIRN,
  ST_CAFFE,
  ST_DORNBIRN,
  ST_HOTEL,
  ST_NACHTWAECHTER,
} from "@/tests/fixtures/druck-reise";
import { druckStationen, druckTage, tagesUeberschrift } from "./stationen";

function tag1() {
  const tage = druckTage({
    trip: DRUCK_TRIP,
    activities: DRUCK_ACTIVITIES,
    pois: DRUCK_POIS,
  });
  return tage[0];
}

function station(activityId: string) {
  return tag1().stationen.find((s) => s.activityId === activityId)!;
}

describe("druckTage -- der Tagesteil (req-080)", () => {
  it("legt je Reisetag eine Seite an, auch fuer den offenen Tag", () => {
    const tage = druckTage({
      trip: DRUCK_TRIP,
      activities: DRUCK_ACTIVITIES,
      pois: DRUCK_POIS,
    });

    expect(tage).toHaveLength(2);
    expect(tage[0]).toMatchObject({ nummer: 1, datum: DRUCK_TAG_1 });
    expect(tage[1]).toMatchObject({
      nummer: 2,
      datum: DRUCK_TAG_2,
      stationen: [],
    });
  });

  it("schreibt das Datum des Tages aus", () => {
    expect(tag1().datumText).toBe("Sonntag, 25. Oktober 2026");
  });

  it("sortiert die Stationen nach ihrer Startzeit", () => {
    expect(tag1().stationen.map((s) => s.startzeit)).toEqual([
      "09:00",
      "10:15",
      "15:00",
      "19:00",
      "21:30",
    ]);
  });
});

describe("Eine Station im Heft (req-080)", () => {
  it("traegt ihre Startzeit -- und keine Dauer und keine Endzeit", () => {
    const dornbirn = station(ST_DORNBIRN.id);

    expect(dornbirn.startzeit).toBe("09:00");
    // Die Endzeit des Programmpunkts (10:00) kommt in der Station nicht vor.
    expect(JSON.stringify(dornbirn)).not.toContain("10:00");
    expect(Object.keys(dornbirn)).not.toContain("endzeit");
    expect(Object.keys(dornbirn)).not.toContain("dauer");
  });

  it("traegt den Langtext und nicht den Kurztext", () => {
    const dornbirn = station(ST_DORNBIRN.id);

    expect(dornbirn.langtext).toBe(ST_DORNBIRN.longText);
    expect(JSON.stringify(dornbirn)).not.toContain(ST_DORNBIRN.shortText);
  });

  it("nennt die Art des Programmpunkts", () => {
    expect(station(ST_DORNBIRN.id).art).toBe("Stadt & Dorf");
    expect(station(ST_HOTEL.id).art).toBe("Hotel");
  });

  it("nennt eine Nebenstation „Nebenstation“", () => {
    expect(station(ST_CAFFE.id).art).toBe("Nebenstation");
  });

  it("zeigt bei sieben Fotos ein grosses und zwei bis drei kleine", () => {
    const dornbirn = station(ST_DORNBIRN.id);

    expect(POI_DORNBIRN.photos).toHaveLength(7);
    expect(dornbirn.grossesFoto).toEqual({
      id: POI_DORNBIRN.photos![0].id,
      istKiBild: false,
    });
    expect(dornbirn.kleineFotos.length).toBeGreaterThanOrEqual(2);
    expect(dornbirn.kleineFotos.length).toBeLessThanOrEqual(3);
    // Die kleinen sind die naechsten in ihrer Reihenfolge -- nicht noch
    // einmal das grosse.
    expect(dornbirn.kleineFotos.map((f) => f.id)).toEqual(
      POI_DORNBIRN.photos!.slice(1, 1 + dornbirn.kleineFotos.length).map(
        (f) => f.id,
      ),
    );
  });

  it("laesst bei nur einem Foto die kleinen weg", () => {
    const nachtwaechter = station(ST_NACHTWAECHTER.id);

    expect(nachtwaechter.grossesFoto).not.toBeNull();
    expect(nachtwaechter.kleineFotos).toEqual([]);
  });

  it("bleibt ohne POI ohne Fotos -- geraten werden keine", () => {
    const [ohnePoi] = druckStationen({
      activities: [{ ...ST_DORNBIRN, poiId: undefined }],
      pois: DRUCK_POIS,
    });

    expect(ohnePoi.grossesFoto).toBeNull();
    expect(ohnePoi.kleineFotos).toEqual([]);
  });
});

describe("tagesUeberschrift (req-080)", () => {
  it("nennt die Orte der Stationen", () => {
    expect(
      tagesUeberschrift(
        [{ ort: "Dornbirn" }, { ort: "Rothenburg" }],
        "2026-10-25",
      ),
    ).toBe("Dornbirn und Rothenburg");
  });

  it("nennt jeden Ort nur einmal", () => {
    expect(
      tagesUeberschrift(
        [{ ort: "Rothenburg" }, { ort: "Rothenburg" }],
        "2026-10-25",
      ),
    ).toBe("Rothenburg");
  });

  it("nimmt bei einem Tag ohne Stationen seinen Wochentag", () => {
    expect(tagesUeberschrift([], "2026-10-26")).toBe("Montag");
  });
});
