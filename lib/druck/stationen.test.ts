import { describe, expect, it } from "vitest";
import { groupKey } from "@/lib/activities/groups";
import {
  DRUCK_ACTIVITIES,
  DRUCK_POIS,
  DRUCK_TAG_1,
  DRUCK_TAG_2,
  DRUCK_TRIP,
  POI_DORNBIRN,
  ST_CAFFE,
  ST_DORNBIRN,
  ST_HERR,
  ST_HOTEL,
  ST_NACHTWAECHTER,
  ST_ZUNFTHAUS,
} from "@/tests/fixtures/druck-reise";
import {
  alternativenSatz,
  druckStationen,
  druckTage,
  tagesUeberschrift,
} from "./stationen";

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

/**
 * req-004/req-080: Eine Options-Gruppe -- zwei Programmpunkte zur gleichen
 * Zeit -- bekommt im Heft nur mit ihrer Hauptoption Raum; die Alternative
 * wird in einem Satz erwaehnt.
 */
describe("Options-Gruppe im Heft (req-080)", () => {
  it("gibt nur der Hauptoption eine Station", () => {
    const ids = tag1().stationen.map((s) => s.activityId);

    expect(ids).toContain(ST_ZUNFTHAUS.id);
    expect(ids).not.toContain(ST_HERR.id);
  });

  it("erwaehnt die Alternative in einem Satz", () => {
    expect(station(ST_ZUNFTHAUS.id).alternative).toBe(
      "Als Alternative steht „HerR Restaurant“ zur gleichen Zeit im Plan — entschieden wird vor Ort.",
    );
  });

  it("folgt der gewaehlten Alternative, wenn eine gewaehlt ist", () => {
    const stationen = druckStationen({
      activities: [ST_ZUNFTHAUS, ST_HERR],
      pois: DRUCK_POIS,
      optionSelections: {
        [groupKey({
          tripId: DRUCK_TRIP.id,
          startAt: ST_HERR.startAt,
          endAt: ST_HERR.endAt,
        })]: ST_HERR.id,
      },
    });

    expect(stationen).toHaveLength(1);
    expect(stationen[0].activityId).toBe(ST_HERR.id);
    expect(stationen[0].alternative).toContain("Gaststuben im Zunfthaus");
  });

  it("laesst eine Station ohne Alternative ohne Nebensatz", () => {
    expect(station(ST_DORNBIRN.id).alternative).toBeNull();
  });

  it("nennt mehrere Alternativen in einem Satz", () => {
    expect(alternativenSatz(["HerR Restaurant", "Zur Höll"])).toBe(
      "Als Alternativen stehen „HerR Restaurant“ und „Zur Höll“ zur gleichen Zeit im Plan — entschieden wird vor Ort.",
    );
  });
});

/**
 * req-080: Im Tagesteil steht nichts von Buchung und Preis -- beides
 * gesammelt auf der letzten Seite. Eine Station traegt die Felder dafuer gar
 * nicht erst.
 */
describe("Was eine Station nicht traegt (req-080)", () => {
  it("traegt weder Buchungszustand noch Preis", () => {
    const hotel = station(ST_HOTEL.id);

    expect(Object.keys(hotel)).not.toContain("buchung");
    expect(Object.keys(hotel)).not.toContain("preisCent");
    expect(Object.keys(hotel)).not.toContain("betrag");
    // Der Preis des POI (220 €) und sein Zustand ("gebucht") kommen in der
    // Station nicht vor.
    expect(JSON.stringify(hotel)).not.toContain("220");
    expect(JSON.stringify(hotel)).not.toContain("gebucht");
  });
});
