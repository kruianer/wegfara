import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ICON_FARBEN_ANDERE_UMGEBUNG,
  ICON_FARBEN_PROD,
  iconFarben,
  iconFarbenFuer,
} from "./icon-farben";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("Farben des Icons je Umgebung (req-065)", () => {
  it("gibt prod den Indigo-Grund der Anmeldeseite", () => {
    expect(iconFarbenFuer(null)).toEqual(ICON_FARBEN_PROD);
    expect(ICON_FARBEN_PROD.grund).not.toBe("#000000");
  });

  it("kennzeichnet jede Umgebung, die nicht prod ist", () => {
    expect(iconFarbenFuer("dev")).toEqual(ICON_FARBEN_ANDERE_UMGEBUNG);
    expect(iconFarbenFuer("lokal")).toEqual(ICON_FARBEN_ANDERE_UMGEBUNG);
  });

  it("unterscheidet beide Umgebungen am Grund, nicht am Zeichen", () => {
    // Auf demselben Homescreen soll der Unterschied auffallen -- es bleibt
    // aber dieselbe App und damit dasselbe Zeichen.
    expect(ICON_FARBEN_ANDERE_UMGEBUNG.grund).not.toBe(ICON_FARBEN_PROD.grund);
    expect(ICON_FARBEN_ANDERE_UMGEBUNG.zeichen).toBe(ICON_FARBEN_PROD.zeichen);
  });

  it("nimmt die Umgebung aus APP_URL und nicht aus dem Quelltext", () => {
    // dev und prod bauen aus demselben Stand; unterschieden werden sie an
    // ihrer Adresse (siehe lib/auth/environment.ts).
    vi.stubEnv("APP_URL", "https://app.wegfara.com");
    expect(iconFarben()).toEqual(ICON_FARBEN_PROD);

    vi.stubEnv("APP_URL", "https://dev.wegfara.com");
    expect(iconFarben()).toEqual(ICON_FARBEN_ANDERE_UMGEBUNG);
  });
});
