import { describe, expect, it } from "vitest";
import {
  ICON_BASIS_PFAD,
  ICON_GROESSEN,
  ICON_TAB_GROESSE,
  iconGroesseAus,
  iconPfad,
} from "./icon-pfade";

describe("Adressen des Icons (req-065)", () => {
  it("liegt unterhalb des gemeinsamen Anfangs", () => {
    expect(iconPfad(ICON_TAB_GROESSE)).toBe(
      `${ICON_BASIS_PFAD}/${ICON_TAB_GROESSE}`,
    );
  });

  it("kennt die Kantenlaenge fuer den Browser-Tab", () => {
    expect(ICON_GROESSEN).toContain(ICON_TAB_GROESSE);
    expect(iconGroesseAus(String(ICON_TAB_GROESSE))).toBe(ICON_TAB_GROESSE);
  });

  it("liefert keine frei waehlbare Groesse aus", () => {
    expect(iconGroesseAus("4096")).toBeNull();
    expect(iconGroesseAus("33")).toBeNull();
    expect(iconGroesseAus("")).toBeNull();
    expect(iconGroesseAus("keine-zahl")).toBeNull();
  });
});
