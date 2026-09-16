// @vitest-environment node
import { describe, expect, it } from "vitest";
import { APP_NAME } from "@/lib/marke";
import {
  ICON_APPLE_GROESSE,
  ICON_TAB_GROESSE,
  iconPfad,
} from "@/lib/icon/icon-pfade";
import { config } from "@/middleware";
import manifest from "./manifest";

describe("Web-App-Manifest (req-065)", () => {
  it("nennt den Namen, der unter dem Icon steht", () => {
    const { name, short_name } = manifest();

    expect(short_name).toBe("Wegfara");
    expect(name).toBe(APP_NAME);
  });

  it("zeigt auf dem Homescreen dieselbe Kompassrose wie im Browser-Tab", () => {
    const quellen = (manifest().icons ?? []).map((icon) => icon.src);

    expect(quellen).toContain(iconPfad(ICON_TAB_GROESSE));
    expect(quellen).toContain(iconPfad(ICON_APPLE_GROESSE));
  });

  it("nennt zu jedem Icon Kantenlaenge und Format", () => {
    for (const icon of manifest().icons ?? []) {
      expect(icon.type).toBe("image/png");
      expect(icon.sizes).toMatch(/^\d+x\d+$/);
    }
  });

  it("startet auf der Hauptadresse, die von dort weiterleitet (req-055)", () => {
    expect(manifest().start_url).toBe("/");
  });

  it("ist ohne Anmeldung zu holen -- der Browser liest es vorher", () => {
    // Die middleware nimmt ".webmanifest" von ihrem matcher aus; liefe sie
    // darueber, bekaeme der Browser statt des Manifests eine Weiterleitung
    // zur Anmeldeseite.
    const [muster] = config.matcher;

    expect(new RegExp(`^${muster}$`).test("/manifest.webmanifest")).toBe(false);
  });
});
