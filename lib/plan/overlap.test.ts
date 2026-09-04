import { describe, expect, it } from "vitest";
import { assignLanes } from "./overlap";

function block(startAt: string, endAt: string) {
  return { startAt: `2026-07-20T${startAt}`, endAt: `2026-07-20T${endAt}` };
}

describe("assignLanes (req-039)", () => {
  it("gibt einem einzelnen Programmpunkt die volle Breite", () => {
    expect(assignLanes([block("10:00", "12:30")])).toEqual([
      { lane: 0, lanes: 1 },
    ]);
  });

  it("stellt zwei ueberlappende Programmpunkte nebeneinander", () => {
    const lanes = assignLanes([
      block("10:00", "12:30"),
      block("11:00", "13:30"),
    ]);

    expect(lanes).toEqual([
      { lane: 0, lanes: 2 },
      { lane: 1, lanes: 2 },
    ]);
  });

  it("laesst aufeinanderfolgende Programmpunkte in derselben Spur", () => {
    const lanes = assignLanes([
      block("10:00", "12:00"),
      block("12:00", "13:00"),
    ]);

    expect(lanes).toEqual([
      { lane: 0, lanes: 1 },
      { lane: 0, lanes: 1 },
    ]);
  });

  it("schmaelert nur die betroffene Traube, nicht den ganzen Tag", () => {
    const lanes = assignLanes([
      block("10:00", "12:00"),
      block("11:00", "13:00"),
      block("18:00", "19:00"),
    ]);

    expect(lanes).toEqual([
      { lane: 0, lanes: 2 },
      { lane: 1, lanes: 2 },
      { lane: 0, lanes: 1 },
    ]);
  });

  it("teilt die Breite unter drei sich ueberlappenden Programmpunkten", () => {
    const lanes = assignLanes([
      block("10:00", "13:00"),
      block("10:30", "12:00"),
      block("11:00", "11:30"),
    ]);

    expect(lanes).toEqual([
      { lane: 0, lanes: 3 },
      { lane: 1, lanes: 3 },
      { lane: 2, lanes: 3 },
    ]);
  });

  it("gibt eine frei gewordene Spur wieder her", () => {
    const lanes = assignLanes([
      block("10:00", "14:00"),
      block("10:30", "11:00"),
      block("11:30", "12:00"),
    ]);

    expect(lanes).toEqual([
      { lane: 0, lanes: 2 },
      { lane: 1, lanes: 2 },
      { lane: 1, lanes: 2 },
    ]);
  });

  it("behaelt die Reihenfolge der uebergebenen Bloecke bei", () => {
    const lanes = assignLanes([
      block("18:00", "19:00"),
      block("10:00", "11:00"),
    ]);

    expect(lanes).toEqual([
      { lane: 0, lanes: 1 },
      { lane: 0, lanes: 1 },
    ]);
  });

  it("kommt mit einem Programmpunkt ueber Mitternacht zurecht", () => {
    const lanes = assignLanes([
      { startAt: "2026-07-20T23:00", endAt: "2026-07-21T01:00" },
      { startAt: "2026-07-20T23:30", endAt: "2026-07-21T00:30" },
    ]);

    expect(lanes).toEqual([
      { lane: 0, lanes: 2 },
      { lane: 1, lanes: 2 },
    ]);
  });
});
