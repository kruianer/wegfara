import { describe, expect, it } from "vitest";
import type { Activity } from "@/lib/activities/types";
import { planEintragZu } from "./plan-eintrag";

function programmpunkt(
  title: string,
  startAt: string,
  endAt: string,
): Activity {
  return {
    id: title,
    tripId: "reise-1",
    type: "restaurant",
    title,
    shortText: "",
    longText: "",
    startAt,
    endAt,
  };
}

const FRUEHSTUECK = programmpunkt(
  "Frühstück im Hotel",
  "2026-07-20T09:00",
  "2026-07-20T10:00",
);
const MITTAGESSEN = programmpunkt(
  "Mittagessen Positano",
  "2026-07-20T13:30",
  "2026-07-20T15:00",
);
const MORGEN = programmpunkt(
  "Fähre nach Capri",
  "2026-07-21T08:00",
  "2026-07-21T09:00",
);

describe("planEintragZu (req-051)", () => {
  it("nennt den Programmpunkt, der zur aktuellen Uhrzeit laeuft", () => {
    const eintrag = planEintragZu(
      [FRUEHSTUECK, MITTAGESSEN],
      "2026-07-20T14:10",
    );

    expect(eintrag).toEqual({ art: "laufend", activity: MITTAGESSEN });
  });

  it("nennt den naechsten anstehenden, wenn gerade keiner laeuft", () => {
    const eintrag = planEintragZu(
      [MITTAGESSEN, FRUEHSTUECK],
      "2026-07-20T07:00",
    );

    expect(eintrag).toEqual({ art: "naechster", activity: FRUEHSTUECK });
  });

  it("zaehlt den Beginn als laufend und das Ende als vorbei", () => {
    expect(planEintragZu([MITTAGESSEN], "2026-07-20T13:30")?.art).toBe(
      "laufend",
    );
    expect(planEintragZu([MITTAGESSEN], "2026-07-20T15:00")?.art).not.toBe(
      "laufend",
    );
  });

  it("greift nicht auf den naechsten Tag vor", () => {
    expect(planEintragZu([MORGEN], "2026-07-20T20:00")).toBeNull();
  });

  it("nimmt bei zeitgleichen Programmpunkten den ersten", () => {
    const alternative = programmpunkt(
      "Mittagessen Amalfi",
      "2026-07-20T13:30",
      "2026-07-20T15:00",
    );

    const eintrag = planEintragZu(
      [MITTAGESSEN, alternative],
      "2026-07-20T14:10",
    );

    expect(eintrag?.activity).toBe(MITTAGESSEN);
  });

  it("hat ohne Programmpunkte keinen Eintrag", () => {
    expect(planEintragZu([], "2026-07-20T14:10")).toBeNull();
  });
});
