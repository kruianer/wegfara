import { describe, expect, it } from "vitest";
import { DEFAULT_THEME_ID, THEMES, findTheme } from "./themes";

describe("THEMES", () => {
  it("enthaelt genau zehn Farbwelten", () => {
    expect(THEMES).toHaveLength(10);
  });

  it("hat fuer jede Farbwelt eine eindeutige id", () => {
    const ids = THEMES.map((theme) => theme.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("nennt genau die im Requirement vorgegebenen Namen", () => {
    expect(THEMES.map((theme) => theme.name)).toEqual([
      "Hell",
      "Dunkel",
      "Notte · OLED",
      "Riviera · Petrol",
      "Aurora · Violett",
      "Magma · Rot",
      "Blau · dunkel",
      "Lila · dunkel",
      "Orange / Anthrazit",
      "Anthrazit / Gold",
    ]);
  });

  it("legt jede Farbwelt vollstaendig an, einschliesslich Warnfarben", () => {
    for (const theme of THEMES) {
      expect(theme.vars["--warn"]).toBeTruthy();
      expect(theme.vars["--warn-soft"]).toBeTruthy();
    }
  });

  it("gibt fuer jede Farbwelt genau drei Vorschau-Farben", () => {
    for (const theme of THEMES) {
      expect(theme.swatches).toHaveLength(3);
    }
  });

  it('setzt "Hell" als Standard-Farbwelt', () => {
    expect(DEFAULT_THEME_ID).toBe("light");
    expect(THEMES[0].id).toBe("light");
  });

  it('laesst "Hell" unveraendert gegenueber der bisherigen festen Farbgebung', () => {
    const light = findTheme("light");
    expect(light.vars["--bg"]).toBe("#f6f5f3");
    expect(light.vars["--sur"]).toBe("#ffffff");
    expect(light.vars["--acc"]).toBe("#d4502c");
  });

  it("setzt fuer Notte · OLED einen schwarzen Hintergrund", () => {
    expect(findTheme("notte").vars["--bg"]).toBe("#000000");
  });

  it("faellt bei unbekannter id auf die erste Farbwelt zurueck", () => {
    // @ts-expect-error absichtlich eine unbekannte id testen
    expect(findTheme("unbekannt").id).toBe(THEMES[0].id);
  });
});
