import { afterEach, describe, expect, it } from "vitest";
import { loadThemeId, saveThemeId } from "./storage";

afterEach(() => {
  window.localStorage.clear();
});

describe("theme storage", () => {
  it('liefert "light", wenn noch nie gewaehlt wurde', () => {
    expect(loadThemeId()).toBe("light");
  });

  it("liefert die zuletzt gespeicherte Farbwelt", () => {
    saveThemeId("notte");
    expect(loadThemeId()).toBe("notte");
  });

  it("ignoriert einen ungueltigen gespeicherten Wert und faellt auf Hell zurueck", () => {
    window.localStorage.setItem("wegfara.go.theme", "irgendwas");
    expect(loadThemeId()).toBe("light");
  });
});
