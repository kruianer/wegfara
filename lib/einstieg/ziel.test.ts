import { describe, expect, it } from "vitest";
import type { Bewertungsrunde } from "@/lib/bewertungen/types";
import type { TripParticipant } from "@/lib/trip-participants/types";
import type { Trip } from "@/lib/trips/types";
import {
  BEGLEITER_PATH,
  PLANER_PATH,
  darfPlanen,
  einstiegsZiel,
  laufendeReise,
  offeneAbstimmung,
} from "./ziel";
import { LEERE_PRAEFERENZEN } from "@/lib/trips/praeferenzen";

const HEUTE = "2026-07-20";

const UWE = "5e0cd230-3765-425b-be49-6a95028ba0b8";
const BERT = "8f2b1a55-0000-4000-8000-000000000009";

function reise(overrides: Partial<Trip> = {}): Trip {
  return {
    id: "d5fda5ea-65e7-4b47-8096-62618599a288",
    title: "Süditalien Rundreise",
    startDate: "2026-07-18",
    endDate: "2026-07-23",
    mainPlace: { name: "Amalfi", lat: 40.634, lng: 14.6027 },
    description: "",
    state: "freigegeben",
    tempo: "ausgewogen",
    praeferenzen: LEERE_PRAEFERENZEN,
    ...overrides,
  };
}

function runde(overrides: Partial<Bewertungsrunde> = {}): Bewertungsrunde {
  return {
    id: "runde-1",
    tripId: reise().id,
    status: "laeuft",
    poiIds: ["462f6811-13cc-4247-99aa-8b9693955ab7"],
    startedAt: "2026-07-19T10:00:00.000Z",
    endedAt: null,
    ...overrides,
  };
}

function zuordnung(
  participantId: string,
  role: TripParticipant["role"],
  tripId = reise().id,
): TripParticipant {
  return { tripId, participantId, role };
}

describe("laufendeReise (req-055)", () => {
  it("erkennt die freigegebene Reise, in deren Zeitraum heute liegt", () => {
    expect(laufendeReise([reise()], HEUTE)?.title).toBe("Süditalien Rundreise");
  });

  it("zaehlt den ersten und den letzten Reisetag mit", () => {
    expect(laufendeReise([reise()], "2026-07-18")).not.toBeNull();
    expect(laufendeReise([reise()], "2026-07-23")).not.toBeNull();
  });

  it("laesst eine Reise aus, die noch in Planung ist", () => {
    expect(laufendeReise([reise({ state: "in_planung" })], HEUTE)).toBeNull();
  });

  it("laesst eine abgeschlossene Reise aus", () => {
    expect(
      laufendeReise([reise({ state: "abgeschlossen" })], HEUTE),
    ).toBeNull();
  });

  it("laesst eine Reise aus, deren Zeitraum noch nicht begonnen hat", () => {
    expect(laufendeReise([reise()], "2026-07-17")).toBeNull();
  });

  it("laesst eine Reise aus, deren Zeitraum vorbei ist", () => {
    expect(laufendeReise([reise()], "2026-07-24")).toBeNull();
  });

  // req-055, Out of Scope: mehrere gleichzeitig laufende Reisen werden nicht
  // unterschieden -- es gilt die, die zuerst begonnen hat.
  it("nimmt bei zwei laufenden Reisen die zuerst begonnene", () => {
    const spaeter = reise({
      id: "4b5f95d6-5ad3-4049-b71c-0b90fef8e950",
      title: "Wien Städtereise",
      startDate: "2026-07-19",
      endDate: "2026-07-25",
    });

    expect(laufendeReise([spaeter, reise()], HEUTE)?.title).toBe(
      "Süditalien Rundreise",
    );
  });
});

describe("offeneAbstimmung (req-055)", () => {
  it("findet die laufende Runde einer sichtbaren Reise", () => {
    expect(offeneAbstimmung([runde()], [reise()])?.id).toBe("runde-1");
  });

  it("uebergeht eine beendete Runde", () => {
    const beendet = runde({
      status: "beendet",
      endedAt: "2026-07-20T10:00:00.000Z",
    });

    expect(offeneAbstimmung([beendet], [reise()])).toBeNull();
  });

  it("uebergeht eine Runde zu einer Reise, die diese Person nicht sieht", () => {
    expect(
      offeneAbstimmung([runde({ tripId: "fremde-reise" })], [reise()]),
    ).toBeNull();
  });
});

describe("darfPlanen (req-055)", () => {
  it("laesst den Reiseleiter in den Planer", () => {
    expect(
      darfPlanen({
        tripParticipants: [zuordnung(UWE, "reiseleiter")],
        participantId: UWE,
      }),
    ).toBe(true);
  });

  it("laesst den Account-Admin in den Planer, auch ohne gefuehrte Reise", () => {
    expect(
      darfPlanen({
        tripParticipants: [zuordnung(BERT, "teilnehmer")],
        participantId: BERT,
        accountAdmin: true,
      }),
    ).toBe(true);
  });

  it("laesst einen Teilnehmer ohne Rolle nicht in den Planer", () => {
    expect(
      darfPlanen({
        tripParticipants: [
          zuordnung(UWE, "reiseleiter"),
          zuordnung(BERT, "teilnehmer"),
        ],
        participantId: BERT,
      }),
    ).toBe(false);
  });

  it("zaehlt eine Reiseleitung bei irgendeiner Reise", () => {
    expect(
      darfPlanen({
        tripParticipants: [
          zuordnung(BERT, "teilnehmer"),
          zuordnung(
            BERT,
            "reiseleiter",
            "4b5f95d6-5ad3-4049-b71c-0b90fef8e950",
          ),
        ],
        participantId: BERT,
      }),
    ).toBe(true);
  });
});

describe("einstiegsZiel (req-055)", () => {
  it("fuehrt bei laufender Reise in den Begleiter", () => {
    expect(
      einstiegsZiel({
        trips: [reise()],
        tripParticipants: [zuordnung(BERT, "teilnehmer")],
        participantId: BERT,
        today: HEUTE,
      }),
    ).toBe(BEGLEITER_PATH);
  });

  // Die laufende Reise geht vor -- auch beim Reiseleiter.
  it("fuehrt den Reiseleiter bei laufender Reise ebenfalls in den Begleiter", () => {
    expect(
      einstiegsZiel({
        trips: [reise()],
        tripParticipants: [zuordnung(UWE, "reiseleiter")],
        participantId: UWE,
        today: HEUTE,
      }),
    ).toBe(BEGLEITER_PATH);
  });

  it("fuehrt ohne laufende Reise, aber mit offener Abstimmung in den Begleiter", () => {
    expect(
      einstiegsZiel({
        trips: [reise({ state: "in_planung" })],
        runden: [runde()],
        tripParticipants: [zuordnung(UWE, "reiseleiter")],
        participantId: UWE,
        today: HEUTE,
      }),
    ).toBe(BEGLEITER_PATH);
  });

  it("fuehrt den Reiseleiter sonst in den Planer", () => {
    expect(
      einstiegsZiel({
        trips: [reise({ state: "in_planung" })],
        tripParticipants: [zuordnung(UWE, "reiseleiter")],
        participantId: UWE,
        today: HEUTE,
      }),
    ).toBe(PLANER_PATH);
  });

  it("fuehrt den Account-Admin sonst in den Planer", () => {
    expect(
      einstiegsZiel({
        trips: [],
        participantId: BERT,
        accountAdmin: true,
        today: HEUTE,
      }),
    ).toBe(PLANER_PATH);
  });

  it("fuehrt einen Teilnehmer ohne Rolle sonst in den Begleiter", () => {
    expect(
      einstiegsZiel({
        trips: [reise({ state: "in_planung" })],
        tripParticipants: [zuordnung(BERT, "teilnehmer")],
        participantId: BERT,
        today: HEUTE,
      }),
    ).toBe(BEGLEITER_PATH);
  });
});
