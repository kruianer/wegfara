import { describe, expect, it } from "vitest";
import {
  DRUCK_DARSTELLUNGEN,
  DRUCK_DARSTELLUNG_LABEL,
  druckDarstellung,
  isDruckDarstellung,
  VORGEGEBENE_DRUCK_DARSTELLUNG,
} from "./druck-darstellung";

describe("druckDarstellung (req-080)", () => {
  it("gibt einem Programmpunkt ohne Angabe „Vollständig“", () => {
    expect(druckDarstellung({})).toBe("vollstaendig");
    expect(druckDarstellung({ druckDarstellung: undefined })).toBe(
      "vollstaendig",
    );
  });

  it("liefert das hinterlegte Kennzeichen", () => {
    expect(druckDarstellung({ druckDarstellung: "nebenstation" })).toBe(
      "nebenstation",
    );
    expect(druckDarstellung({ druckDarstellung: "nicht_anzeigen" })).toBe(
      "nicht_anzeigen",
    );
  });

  it("nennt „Vollständig“ als Vorgabe", () => {
    expect(VORGEGEBENE_DRUCK_DARSTELLUNG).toBe("vollstaendig");
  });
});

describe("isDruckDarstellung", () => {
  it("erkennt die drei Werte", () => {
    for (const wert of DRUCK_DARSTELLUNGEN) {
      expect(isDruckDarstellung(wert)).toBe(true);
    }
  });

  it("weist alles andere ab", () => {
    expect(isDruckDarstellung("gross")).toBe(false);
    expect(isDruckDarstellung("")).toBe(false);
    expect(isDruckDarstellung(undefined)).toBe(false);
    expect(isDruckDarstellung(null)).toBe(false);
    expect(isDruckDarstellung(1)).toBe(false);
  });
});

describe("DRUCK_DARSTELLUNG_LABEL", () => {
  it("benennt jeden Wert so, wie das Requirement ihn nennt", () => {
    expect(DRUCK_DARSTELLUNG_LABEL).toEqual({
      vollstaendig: "Vollständig",
      nebenstation: "Als Nebenstation",
      nicht_anzeigen: "Nicht anzeigen",
    });
  });
});
