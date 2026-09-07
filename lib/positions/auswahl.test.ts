import { describe, expect, it } from "vitest";
import type { TripParticipant } from "@/lib/trip-participants/types";
import { positionFuerLiveStatus } from "./auswahl";
import type { GeteiltePosition } from "./types";

const REISE = "reise-1";
const ICH = "person-ich";
const LEITER = "person-leiter";
const ANDERER = "person-anderer";

const ZUORDNUNGEN: TripParticipant[] = [
  { tripId: REISE, participantId: ICH, role: "teilnehmer" },
  { tripId: REISE, participantId: LEITER, role: "reiseleiter" },
  { tripId: REISE, participantId: ANDERER, role: "teilnehmer" },
];

const JETZT = new Date("2026-07-20T14:10:00.000Z");

function position(
  participantId: string,
  overrides: Partial<GeteiltePosition> = {},
): GeteiltePosition {
  return {
    tripId: REISE,
    participantId,
    lat: 40.611,
    lng: 14.69,
    ort: "Praiano",
    recordedAt: "2026-07-20T14:09:00.000Z",
    ...overrides,
  };
}

function wahl(positionen: GeteiltePosition[]) {
  return positionFuerLiveStatus(positionen, {
    tripId: REISE,
    selbstId: ICH,
    zuordnungen: ZUORDNUNGEN,
    jetzt: JETZT,
  });
}

describe("positionFuerLiveStatus (req-051)", () => {
  it("nimmt meine eigene Position, wenn ich sie teile", () => {
    const eigene = position(ICH);

    expect(wahl([position(LEITER), eigene])).toBe(eigene);
  });

  it("nimmt die des Reiseleiters, wenn ich nicht teile", () => {
    const seine = position(LEITER);

    expect(wahl([seine, position(ANDERER)])).toBe(seine);
  });

  it("hat keine, wenn weder ich noch der Reiseleiter teilen", () => {
    expect(wahl([position(ANDERER)])).toBeNull();
  });

  it("hat keine, wenn niemand teilt", () => {
    expect(wahl([])).toBeNull();
  });

  it("uebergeht Positionen, die aelter als 15 Minuten sind", () => {
    const alt = position(ICH, { recordedAt: "2026-07-20T13:54:00.000Z" });

    expect(wahl([alt])).toBeNull();
  });

  it("nimmt bei mehreren Reiseleitern die juengste Position", () => {
    const zweiterLeiter = "person-leiter-2";
    const positionen = [
      position(LEITER, { recordedAt: "2026-07-20T14:00:00.000Z" }),
      position(zweiterLeiter, { recordedAt: "2026-07-20T14:08:00.000Z" }),
    ];

    const gewaehlt = positionFuerLiveStatus(positionen, {
      tripId: REISE,
      selbstId: ICH,
      zuordnungen: [
        ...ZUORDNUNGEN,
        { tripId: REISE, participantId: zweiterLeiter, role: "reiseleiter" },
      ],
      jetzt: JETZT,
    });

    expect(gewaehlt?.participantId).toBe(zweiterLeiter);
  });

  it("uebergeht Positionen aus einer anderen Reise", () => {
    const fremde = position(ICH, { tripId: "reise-2" });

    expect(wahl([fremde])).toBeNull();
  });
});
