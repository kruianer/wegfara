import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Activity } from "@/lib/activities/types";
import type { GeteiltePosition } from "@/lib/positions/types";
import type { RoutingClient } from "@/lib/routing/client";
import type { TripParticipant } from "@/lib/trip-participants/types";
import { clearOrtCache } from "./ort-cache";
import { ermittleStandortlage, type LageEingabe } from "./standortlage";

const REISE = "reise-1";
const ICH = "person-ich";
const LEITER = "person-leiter";

// Ortszeit, damit die Umrechnung nicht von der Zeitzone des Testlaufs
// abhaengt (siehe lib/live-status/zeit.ts).
const JETZT = new Date(2026, 6, 20, 14, 10);
const VOR_EINER_MINUTE = new Date(2026, 6, 20, 14, 9).toISOString();

const MITTAGESSEN: Activity = {
  id: "activity-1",
  tripId: REISE,
  type: "restaurant",
  title: "Mittagessen Positano",
  shortText: "",
  longText: "",
  startAt: "2026-07-20T13:30",
  endAt: "2026-07-20T15:00",
  position: { lat: 40.6281, lng: 14.4842 },
};

const FRUEHSTUECK: Activity = {
  ...MITTAGESSEN,
  id: "activity-2",
  title: "Frühstück im Hotel",
  startAt: "2026-07-20T09:00",
  endAt: "2026-07-20T10:00",
};

const ZUORDNUNGEN: TripParticipant[] = [
  { tripId: REISE, participantId: ICH, role: "teilnehmer" },
  { tripId: REISE, participantId: LEITER, role: "reiseleiter" },
];

function position(participantId: string, ort: string | null): GeteiltePosition {
  return {
    tripId: REISE,
    participantId,
    lat: 40.6114,
    lng: 14.6896,
    ort,
    recordedAt: VOR_EINER_MINUTE,
  };
}

function routing(fahrzeitMinuten: number | null): RoutingClient {
  return {
    fahrzeitMinuten: vi.fn(async () => fahrzeitMinuten),
    // Der Verzug fragt nur nach der Fahrzeit; die Laenge der Route braucht
    // der Transfer-Vorschlag (req-052).
    strecke: vi.fn(async () =>
      fahrzeitMinuten === null
        ? null
        : { dauerMinuten: fahrzeitMinuten, distanzKm: 12 },
    ),
    // Den Strassenverlauf braucht die Tageskarte (req-059).
    verlauf: vi.fn(async () => null),
  };
}

const ORT_LOOKUP = { fromPosition: vi.fn(async () => "Praiano") };

function eingabe(overrides: Partial<LageEingabe> = {}): LageEingabe {
  return {
    tripId: REISE,
    selbstId: ICH,
    zuordnungen: ZUORDNUNGEN,
    positionen: [position(ICH, "Praiano")],
    activities: [FRUEHSTUECK, MITTAGESSEN],
    jetzt: JETZT,
    ...overrides,
  };
}

beforeEach(() => {
  clearOrtCache();
  ORT_LOOKUP.fromPosition.mockClear();
});

describe("ermittleStandortlage (req-051)", () => {
  it("nennt den Ort meiner Position unter 'Laut GPS'", async () => {
    const lage = await ermittleStandortlage(eingabe(), {
      routing: routing(25),
      ortLookup: ORT_LOOKUP,
    });

    expect(lage.ort).toBe("Praiano");
  });

  it("meldet 25 Fahrminuten zum laufenden Programmpunkt als Verzug", async () => {
    const lage = await ermittleStandortlage(eingabe(), {
      routing: routing(25),
      ortLookup: ORT_LOOKUP,
    });

    expect(lage.verzug).toEqual({ art: "verspaetet", minuten: 25 });
  });

  it("rechnet die Fahrzeit von meiner Position zum geplanten Ort", async () => {
    const dienst = routing(25);

    await ermittleStandortlage(eingabe(), {
      routing: dienst,
      ortLookup: ORT_LOOKUP,
    });

    expect(dienst.fahrzeitMinuten).toHaveBeenCalledWith(
      expect.objectContaining({ lat: 40.6114, lng: 14.6896 }),
      MITTAGESSEN.position,
    );
  });

  it("ist am Ort des Programmpunkts im Zeitplan", async () => {
    const lage = await ermittleStandortlage(eingabe(), {
      routing: routing(0),
      ortLookup: ORT_LOOKUP,
    });

    expect(lage.verzug).toEqual({ art: "im_zeitplan" });
  });

  it("beruht ohne meine Position auf der des Reiseleiters", async () => {
    const dienst = routing(12);

    const lage = await ermittleStandortlage(
      eingabe({ positionen: [position(LEITER, "Amalfi")] }),
      { routing: dienst, ortLookup: ORT_LOOKUP },
    );

    expect(lage.ort).toBe("Amalfi");
    expect(lage.verzug).toEqual({ art: "verspaetet", minuten: 12 });
  });

  it("hat ohne jede geteilte Position weder Ort noch Verzug", async () => {
    const dienst = routing(25);

    const lage = await ermittleStandortlage(eingabe({ positionen: [] }), {
      routing: dienst,
      ortLookup: ORT_LOOKUP,
    });

    expect(lage).toEqual({ ort: null, verzug: { art: "keiner" } });
    expect(dienst.fahrzeitMinuten).not.toHaveBeenCalled();
  });

  it("rechnet keinen Verzug, wenn gerade kein Programmpunkt laeuft", async () => {
    const dienst = routing(25);

    const lage = await ermittleStandortlage(
      eingabe({ jetzt: new Date(2026, 6, 20, 7, 0) }),
      { routing: dienst, ortLookup: ORT_LOOKUP },
    );

    expect(lage.ort).toBe("Praiano");
    expect(lage.verzug).toEqual({ art: "keiner" });
    expect(dienst.fahrzeitMinuten).not.toHaveBeenCalled();
  });

  it("meldet den Verzug als unbekannt, wenn der Routing-Dienst schweigt", async () => {
    const lage = await ermittleStandortlage(eingabe(), {
      routing: routing(null),
      ortLookup: ORT_LOOKUP,
    });

    expect(lage.ort).toBe("Praiano");
    expect(lage.verzug).toEqual({ art: "unbekannt" });
  });

  it("schlaegt den Ort nach, wenn er nicht mitgespeichert wurde", async () => {
    const lage = await ermittleStandortlage(
      eingabe({ positionen: [position(ICH, null)] }),
      { routing: routing(25), ortLookup: ORT_LOOKUP },
    );

    expect(ORT_LOOKUP.fromPosition).toHaveBeenCalled();
    expect(lage.ort).toBe("Praiano");
  });

  it("nennt die Koordinaten, wenn die Ortssuche nichts hergibt", async () => {
    const lage = await ermittleStandortlage(
      eingabe({ positionen: [position(ICH, null)] }),
      {
        routing: routing(25),
        ortLookup: { fromPosition: async () => null },
      },
    );

    expect(lage.ort).toBe("40.611, 14.690");
  });

  it("uebergeht Programmpunkte einer anderen Reise", async () => {
    const dienst = routing(25);

    const lage = await ermittleStandortlage(
      eingabe({
        activities: [{ ...MITTAGESSEN, tripId: "reise-2" }],
      }),
      { routing: dienst, ortLookup: ORT_LOOKUP },
    );

    expect(lage.verzug).toEqual({ art: "keiner" });
    expect(dienst.fahrzeitMinuten).not.toHaveBeenCalled();
  });
});
