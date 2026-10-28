import { describe, expect, it } from "vitest";
import { STIMM_WAHL_LABEL } from "@/lib/bewertungen/types";
import {
  DEFAULT_MAP_VISIBLE_STATUSES,
  POI_STATUSES,
  POI_STATUS_COLOR,
  POI_STATUS_LABEL,
} from "./status-meta";

describe("POI_STATUS_LABEL (req-097, req-100)", () => {
  it("nennt jeden Status mit seinem kurzen Namen", () => {
    expect(POI_STATUS_LABEL).toEqual({
      gesetzt: "Fix",
      wahrscheinlich: "Alternative",
      weiss_nicht: "Offen",
      wenn_zeit: "Warteliste",
      auf_keinen_fall: "Nein",
    });
  });

  it("laesst Schluessel, Reihenfolge, Farben und Kartenvorgabe unveraendert", () => {
    expect(POI_STATUSES).toEqual([
      "gesetzt",
      "wahrscheinlich",
      "weiss_nicht",
      "wenn_zeit",
      "auf_keinen_fall",
    ]);
    expect(Object.keys(POI_STATUS_COLOR).sort()).toEqual(
      [...POI_STATUSES].sort(),
    );
    expect(DEFAULT_MAP_VISIBLE_STATUSES).toEqual(["gesetzt", "wahrscheinlich"]);
  });

  it("teilt keinen Namen mit einer Stimme der Bewertungsrunde", () => {
    const stimmen = Object.values(STIMM_WAHL_LABEL);
    for (const status of POI_STATUSES) {
      expect(stimmen).not.toContain(POI_STATUS_LABEL[status]);
    }
  });
});
