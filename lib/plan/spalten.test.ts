import { describe, expect, it } from "vitest";
import { PLANNER_MIN_WIDTH_PX } from "./viewport";
import {
  SPALTEN_NEBENEINANDER_AB_PX,
  VORGEWAEHLTE_PLANUNG_SEITE,
  stehenSpaltenNebeneinander,
} from "./spalten";

/** Die Breiten, gegen die stack.md jede Oberflaeche prueft. */
const IPAD_HOCHKANT_PX = 768;
const LAPTOP_PX = 1280;

describe("Spalten des Planers nebeneinander (req-088)", () => {
  it("laesst ab 1180 px alles nebeneinander stehen, wie es war", () => {
    expect(SPALTEN_NEBENEINANDER_AB_PX).toBe(1180);
    expect(stehenSpaltenNebeneinander(1180)).toBe(true);
    expect(stehenSpaltenNebeneinander(LAPTOP_PX)).toBe(true);
  });

  it("zeigt darunter nur einen Teil der Spalten", () => {
    expect(stehenSpaltenNebeneinander(1179)).toBe(false);
    expect(stehenSpaltenNebeneinander(IPAD_HOCHKANT_PX)).toBe(false);
  });

  it("liegt zwischen der Mindestbreite des Planers und dem Laptop", () => {
    // Sonst gaebe es die schmale Ordnung gar nicht -- oder auch am Laptop.
    expect(SPALTEN_NEBENEINANDER_AB_PX).toBeGreaterThan(PLANNER_MIN_WIDTH_PX);
    expect(SPALTEN_NEBENEINANDER_AB_PX).toBeLessThanOrEqual(LAPTOP_PX);
  });

  it("stellt ohne Wahl die POI-Auswahl neben den Zeitstrahl", () => {
    expect(VORGEWAEHLTE_PLANUNG_SEITE).toBe("auswahl");
  });
});
