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

  it("laesst die Schnittstellen der Anmeldung offen", () => {
    expect(isPublicPath("/api/auth/anmeldelink")).toBe(true);
    expect(isPublicPath("/api/auth/passkey/anmeldung")).toBe(true);
  });

  it("laesst den Health-Endpunkt offen, den der Betrieb braucht", () => {
    expect(isPublicPath("/api/health")).toBe(true);
  });

  it.each([
    "/go",
    "/plan",
    "/konto",
    "/api/poi-search",
    "/api/poi-status",
    "/api/search-area",
    "/api/activity-option-selection",
  ])("schuetzt %s", (path) => {
    expect(isPublicPath(path)).toBe(false);
  });

  it("laesst sich nicht durch einen aehnlichen Pfad umgehen", () => {
    expect(isPublicPath("/anmeldung-fremd")).toBe(false);
    expect(isPublicPath("/api/authentisch")).toBe(false);
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

describe("config", () => {
  it("greift fuer alles ausser den Auslieferungspfaden", () => {
    const [muster] = config.matcher;
    const regex = new RegExp(`^${muster}$`);

    expect(regex.test("/go")).toBe(true);
    expect(regex.test("/api/poi-status")).toBe(true);
    expect(regex.test("/_next/static/chunk.js")).toBe(false);
    expect(regex.test("/logo.png")).toBe(false);
  });
});
