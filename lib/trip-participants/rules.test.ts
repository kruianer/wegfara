// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  canRemoveFromTrip,
  canSetRole,
  isLastLeader,
  isTripRole,
  promoteLeadersWhereMissing,
  roleInTrip,
  tripAssignments,
  withAssignment,
  withoutAssignment,
  withoutParticipant,
} from "./rules";
import type { TripParticipant } from "./types";

const SUED = "trip-sueditalien";
const WIEN = "trip-wien";
const UWE = "person-uwe";
const CLARA = "person-clara";
const MAX = "person-max";

function zuordnung(
  tripId: string,
  participantId: string,
  role: TripParticipant["role"],
): TripParticipant {
  return { tripId, participantId, role };
}

/** Uwe fuehrt Sueditalien, Clara faehrt dort mit; Wien fuehrt Clara. */
const ZUORDNUNGEN: TripParticipant[] = [
  zuordnung(SUED, UWE, "reiseleiter"),
  zuordnung(SUED, CLARA, "teilnehmer"),
  zuordnung(WIEN, CLARA, "reiseleiter"),
];

describe("isTripRole (req-021)", () => {
  it("kennt genau zwei Rollen", () => {
    expect(isTripRole("reiseleiter")).toBe(true);
    expect(isTripRole("teilnehmer")).toBe(true);
    expect(isTripRole("kassenfuehrer")).toBe(false);
    expect(isTripRole(null)).toBe(false);
  });
});

describe("tripAssignments (req-021)", () => {
  it("liefert nur die Zuordnungen dieser Reise", () => {
    expect(tripAssignments(ZUORDNUNGEN, WIEN)).toEqual([
      zuordnung(WIEN, CLARA, "reiseleiter"),
    ]);
  });
});

describe("roleInTrip (req-021)", () => {
  it("liefert die Rolle je Reise -- dieselbe Person kann verschiedene tragen", () => {
    expect(roleInTrip(ZUORDNUNGEN, SUED, CLARA)).toBe("teilnehmer");
    expect(roleInTrip(ZUORDNUNGEN, WIEN, CLARA)).toBe("reiseleiter");
  });

  it("liefert null, wo die Person nicht mitfaehrt", () => {
    expect(roleInTrip(ZUORDNUNGEN, WIEN, UWE)).toBeNull();
  });
});

describe("isLastLeader (req-021)", () => {
  it("erkennt den einzigen Reiseleiter einer Reise", () => {
    expect(isLastLeader(ZUORDNUNGEN, SUED, UWE)).toBe(true);
  });

  it("erkennt einen von zwei Reiseleitern nicht als letzten", () => {
    const zweiLeiter = [...ZUORDNUNGEN, zuordnung(SUED, MAX, "reiseleiter")];

    expect(isLastLeader(zweiLeiter, SUED, UWE)).toBe(false);
  });

  it("erkennt einen Teilnehmer nicht als Reiseleiter", () => {
    expect(isLastLeader(ZUORDNUNGEN, SUED, CLARA)).toBe(false);
  });
});

describe("canSetRole (req-021)", () => {
  it("stuft den letzten Reiseleiter nicht herab", () => {
    expect(canSetRole(ZUORDNUNGEN, SUED, UWE, "teilnehmer")).toBe(false);
  });

  it("erhebt jederzeit zum Reiseleiter", () => {
    expect(canSetRole(ZUORDNUNGEN, SUED, UWE, "reiseleiter")).toBe(true);
    expect(canSetRole(ZUORDNUNGEN, SUED, CLARA, "reiseleiter")).toBe(true);
  });

  it("stuft einen von zwei Reiseleitern herab", () => {
    const zweiLeiter = [...ZUORDNUNGEN, zuordnung(SUED, MAX, "reiseleiter")];

    expect(canSetRole(zweiLeiter, SUED, UWE, "teilnehmer")).toBe(true);
  });
});

describe("canRemoveFromTrip (req-021)", () => {
  it("entfernt den letzten Reiseleiter nicht", () => {
    expect(canRemoveFromTrip(ZUORDNUNGEN, SUED, UWE)).toBe(false);
  });

  it("entfernt einen Teilnehmer", () => {
    expect(canRemoveFromTrip(ZUORDNUNGEN, SUED, CLARA)).toBe(true);
  });
});

describe("withAssignment (req-021)", () => {
  it("nimmt eine neue Person auf", () => {
    const next = withAssignment(ZUORDNUNGEN, SUED, MAX, "teilnehmer");

    expect(tripAssignments(next, SUED)).toHaveLength(3);
    expect(roleInTrip(next, SUED, MAX)).toBe("teilnehmer");
  });

  it("ordnet dieselbe Person derselben Reise nur einmal zu", () => {
    const next = withAssignment(ZUORDNUNGEN, SUED, CLARA, "reiseleiter");

    expect(tripAssignments(next, SUED)).toHaveLength(2);
    expect(roleInTrip(next, SUED, CLARA)).toBe("reiseleiter");
  });

  it("laesst die anderen Reisen unberuehrt", () => {
    const next = withAssignment(ZUORDNUNGEN, SUED, CLARA, "reiseleiter");

    expect(roleInTrip(next, WIEN, CLARA)).toBe("reiseleiter");
    expect(roleInTrip(next, WIEN, MAX)).toBeNull();
  });
});

describe("withoutAssignment (req-021)", () => {
  it("nimmt die Person nur aus dieser einen Reise", () => {
    const next = withoutAssignment(ZUORDNUNGEN, SUED, CLARA);

    expect(roleInTrip(next, SUED, CLARA)).toBeNull();
    expect(roleInTrip(next, WIEN, CLARA)).toBe("reiseleiter");
  });
});

describe("withoutParticipant (req-021)", () => {
  it("nimmt die Person aus allen Reisen", () => {
    const next = withoutParticipant(ZUORDNUNGEN, CLARA);

    expect(next).toEqual([zuordnung(SUED, UWE, "reiseleiter")]);
  });
});

describe("promoteLeadersWhereMissing (req-021)", () => {
  it("laesst in einer Reise ohne Reiseleiter die erste Person nachruecken", () => {
    const ohneLeiter = [
      zuordnung(WIEN, CLARA, "teilnehmer"),
      zuordnung(WIEN, MAX, "teilnehmer"),
    ];

    expect(promoteLeadersWhereMissing(ohneLeiter)).toEqual([
      zuordnung(WIEN, CLARA, "reiseleiter"),
      zuordnung(WIEN, MAX, "teilnehmer"),
    ]);
  });

  it("laesst Reisen mit Reiseleiter unveraendert", () => {
    expect(promoteLeadersWhereMissing(ZUORDNUNGEN)).toEqual(ZUORDNUNGEN);
  });

  it("behandelt jede Reise fuer sich", () => {
    const gemischt = [
      zuordnung(SUED, UWE, "reiseleiter"),
      zuordnung(SUED, CLARA, "teilnehmer"),
      zuordnung(WIEN, MAX, "teilnehmer"),
    ];

    expect(promoteLeadersWhereMissing(gemischt)).toEqual([
      zuordnung(SUED, UWE, "reiseleiter"),
      zuordnung(SUED, CLARA, "teilnehmer"),
      zuordnung(WIEN, MAX, "reiseleiter"),
    ]);
  });

  it("laesst eine Reise ohne jede Zuordnung leer", () => {
    expect(promoteLeadersWhereMissing([])).toEqual([]);
  });
});
