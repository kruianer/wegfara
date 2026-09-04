// @vitest-environment node
import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/cookies";
import { config, isPublicPath, middleware } from "./middleware";

function request(path: string, options: { angemeldet?: boolean } = {}) {
  const url = `https://dev.wegfara.com${path}`;
  const headers = new Headers({ "x-forwarded-proto": "https" });
  if (options.angemeldet) {
    headers.set("cookie", `${SESSION_COOKIE}=token-1`);
  }
  return new NextRequest(new Request(url, { headers }));
}

describe("isPublicPath", () => {
  it("laesst die Startseite offen (req-016)", () => {
    expect(isPublicPath("/")).toBe(true);
  });

  it("laesst die Anmeldeseite und das Einloesen des Links offen", () => {
    expect(isPublicPath("/anmeldung")).toBe(true);
    expect(isPublicPath("/anmeldung/link")).toBe(true);
    expect(isPublicPath("/anmeldung/notfallcodes")).toBe(true);
  });

  // req-023: wer den Zugangslink aufruft, ist noch nicht angemeldet -- erst
  // das Einloesen legt die Sitzung an. Der Weg danach bleibt geschuetzt.
  it("laesst das Einloesen einer Einladung offen (req-023)", () => {
    expect(isPublicPath("/einladung")).toBe(true);
    expect(isPublicPath("/einladung/passkey")).toBe(false);
  });

  // req-042: den Gastzugang gibt es nicht mehr. Ein Gastlink, der vor der
  // Umstellung erzeugt wurde, ist damit kein offener Pfad mehr -- wer ihn
  // aufruft, landet auf der Anmeldeseite.
  it("schuetzt den Weg des alten Gastlinks (req-042)", () => {
    expect(isPublicPath("/gast")).toBe(false);
    expect(isPublicPath("/api/gastzugaenge")).toBe(false);
    expect(isPublicPath("/plan")).toBe(false);
    expect(isPublicPath("/api/nutzer")).toBe(false);
  });

  it("weist einen alten Gastlink zur Anmeldeseite (req-042)", () => {
    const response = middleware(request("/gast?token=alter-gastlink"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/anmeldung");
  });

  it("laesst die Schnittstellen der Anmeldung offen", () => {
    expect(isPublicPath("/api/auth/anmeldelink")).toBe(true);
    expect(isPublicPath("/api/auth/passkey/anmeldung")).toBe(true);
  });

  it("laesst den Worker der Kartenbibliothek offen (bug-013)", () => {
    expect(isPublicPath("/maplibre/maplibre-gl-worker.mjs")).toBe(true);
    expect(isPublicPath("/maplibre/maplibre-gl-shared.mjs")).toBe(true);
  });

  it("laesst den Health-Endpunkt offen, den der Betrieb braucht", () => {
    expect(isPublicPath("/api/health")).toBe(true);
  });

  it.each([
    "/go",
    "/plan",
    "/mein-bereich",
    "/api/poi-search",
    "/api/poi-status",
    "/api/search-area",
    "/api/activity-option-selection",
  ])("schuetzt %s", (path) => {
    expect(isPublicPath(path)).toBe(false);
  });

  // req-037: die Ersteinrichtung ruft auf, wer noch keine Sitzung haben kann.
  // Ob es sie ueberhaupt gibt, entscheidet die Seite selbst -- die middleware
  // kennt die Datenbank nicht.
  it("laesst die Ersteinrichtung offen (req-037)", () => {
    expect(isPublicPath("/ersteinrichtung")).toBe(true);
    expect(isPublicPath("/api/auth/ersteinrichtung")).toBe(true);
  });

  // req-037: geschuetzt ist, was nicht ausdruecklich offen ist -- eine neu
  // hinzugefuegte Seite ist damit von selbst geschuetzt und nicht
  // versehentlich offen.
  it("schuetzt eine Seite, die es heute noch gar nicht gibt (req-037)", () => {
    expect(isPublicPath("/eine-ganz-neue-seite")).toBe(false);
    expect(isPublicPath("/plan/etwas-neues")).toBe(false);
    expect(isPublicPath("/api/etwas-neues")).toBe(false);
  });

  it("laesst sich nicht durch einen aehnlichen Pfad umgehen", () => {
    expect(isPublicPath("/anmeldung-fremd")).toBe(false);
    expect(isPublicPath("/api/authentisch")).toBe(false);
    expect(isPublicPath("/ersteinrichtung-fremd")).toBe(false);
  });
});

describe("middleware", () => {
  it("fuehrt ohne Anmeldung zur Anmeldeseite (req-016)", () => {
    const response = middleware(request("/go"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://dev.wegfara.com/anmeldung?weiter=%2Fgo",
    );
  });

  it("fuehrt auch den Planer ohne Anmeldung zur Anmeldeseite (req-016)", () => {
    const response = middleware(request("/plan"));

    expect(response.headers.get("location")).toContain("/anmeldung");
  });

  it("laesst die Startseite ohne Anmeldung stehen (req-016)", () => {
    const response = middleware(request("/"));

    expect(response.headers.get("location")).toBeNull();
    expect(response.status).toBe(200);
  });

  it("weist einen Zugriff auf eine Schnittstelle ohne Anmeldung ab (req-016)", async () => {
    const response = middleware(request("/api/poi-status"));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "nicht angemeldet" });
  });

  it("laesst eine angemeldete Person durch", () => {
    const response = middleware(request("/go", { angemeldet: true }));

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });

  it("verlaengert die Laufzeit des Sitzungs-Cookies bei Nutzung (req-016)", () => {
    const response = middleware(request("/go", { angemeldet: true }));

    const cookie = response.cookies.get(SESSION_COOKIE);
    expect(cookie?.value).toBe("token-1");
    expect(cookie?.maxAge).toBe(90 * 24 * 60 * 60);
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.secure).toBe(true);
  });
});

describe("Zwischenspeicherung (bug-012)", () => {
  it("verbietet das Ablegen der Seiten im Zwischenspeicher", () => {
    // Ohne diese Vorgabe legt Cloudflare die HTML-Antworten ein Jahr ab
    // und liefert nach einem Deploy weiter den alten Stand aus.
    const angemeldet = middleware(request("/plan", { angemeldet: true }));
    const abgemeldet = middleware(request("/plan"));
    const oeffentlich = middleware(request("/"));

    for (const antwort of [angemeldet, abgemeldet, oeffentlich]) {
      expect(antwort.headers.get("Cache-Control")).toContain("no-store");
    }
  });
});

describe("config", () => {
  it("greift fuer alles ausser den Auslieferungspfaden", () => {
    const [muster] = config.matcher;
    const regex = new RegExp(`^${muster}$`);

    expect(regex.test("/go")).toBe(true);
    expect(regex.test("/api/poi-status")).toBe(true);
    expect(regex.test("/_next/static/chunk.js")).toBe(false);
    expect(regex.test("/logo.png")).toBe(false);
    // Der Worker der Kartenbibliothek wird als statische Datei
    // ausgeliefert und darf zwischengespeichert werden (bug-013).
    expect(regex.test("/maplibre/maplibre-gl-worker.mjs")).toBe(false);
    expect(regex.test("/maplibre/maplibre-gl-shared.mjs")).toBe(false);
  });
});
