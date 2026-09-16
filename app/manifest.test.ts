// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { APP_GRUNDTON, APP_NAME } from "@/lib/marke";
import {
  ICON_APPLE_GROESSE,
  ICON_TAB_GROESSE,
  iconPfad,
} from "@/lib/icon/icon-pfade";
import { LOGIN_PATH, PASSKEY_LOGIN_API } from "@/lib/auth/paths";
import { appUrl, webAuthnConfig } from "@/lib/auth/webauthn-config";
import { config } from "@/middleware";
import manifest from "./manifest";

afterEach(() => {
  vi.unstubAllEnvs();
});

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

  it("laeuft vom Homescreen aus im eigenen Fenster statt im Browser", () => {
    expect(manifest().display).toBe("standalone");
  });

  it("zaehlt die ganze Anwendung zu diesem Fenster", () => {
    // Ein Weg aus dem scope heraus oeffnet den Browser samt Adresszeile --
    // der Planer, der Begleiter und die Anmeldung gehoeren alle hinein.
    const { scope } = manifest();

    expect(scope).toBe("/");
    for (const pfad of ["/go", "/plan", "/anmeldung", "/mein-bereich"]) {
      expect(pfad.startsWith(scope as string)).toBe(true);
    }
  });

  it("faerbt Startflaeche und Leisten im Grundton der Anwendung", () => {
    expect(manifest().background_color).toBe(APP_GRUNDTON);
    expect(manifest().theme_color).toBe(APP_GRUNDTON);
  });

  it("ist ohne Anmeldung zu holen -- der Browser liest es vorher", () => {
    // Die middleware nimmt ".webmanifest" von ihrem matcher aus; liefe sie
    // darueber, bekaeme der Browser statt des Manifests eine Weiterleitung
    // zur Anmeldeseite.
    const [muster] = config.matcher;

    expect(new RegExp(`^${muster}$`).test("/manifest.webmanifest")).toBe(false);
  });
});

describe("Anmeldung mit Passkey vom Homescreen (req-065)", () => {
  it("oeffnet das Fenster auf der Domain, an die der Passkey haengt", () => {
    // Ein Passkey gilt je Domain (req-037). Vom Homescreen aus muss deshalb
    // dieselbe gelten wie im Browser derselben Umgebung -- sonst fragte die
    // dev-App nach dem Passkey von prod.
    for (const adresse of [
      "https://app.wegfara.com",
      "https://dev.wegfara.com",
    ]) {
      vi.stubEnv("APP_URL", adresse);
      const start = new URL(manifest().start_url as string, appUrl());

      expect(start.hostname).toBe(webAuthnConfig().rpId);
      expect(start.origin).toBe(webAuthnConfig().origin);
    }
  });

  it("nennt ueberhaupt keine fremde Adresse", () => {
    // Jede absolute Adresse im Manifest waere im Quelltext festverdrahtet --
    // dev und prod bauen aus demselben Stand, und die App liefe dann auf der
    // falschen Domain, also mit dem falschen Passkey.
    const { start_url, scope, icons } = manifest();

    for (const wert of [start_url, scope, ...(icons ?? []).map((i) => i.src)]) {
      expect(wert).toMatch(/^\//);
    }
  });

  it("haelt Anmeldeseite und Passkey-Schnittstelle im Fenster der App", () => {
    // Was ausserhalb des scope liegt, oeffnet der Browser als eigene Seite --
    // die Anmeldung faende dann in einem anderen Fenster statt.
    const scope = manifest().scope as string;

    expect(LOGIN_PATH.startsWith(scope)).toBe(true);
    expect(PASSKEY_LOGIN_API.startsWith(scope)).toBe(true);
  });
});
