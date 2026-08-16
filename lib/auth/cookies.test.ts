// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  challengeCookieOptions,
  connectionIsSecure,
  expiredCookieOptions,
  sessionCookieOptions,
} from "./cookies";
import { SESSION_DURATION_MS } from "./lifetime";

describe("connectionIsSecure", () => {
  it("folgt dem Kopf, den Cloudflare vor die Anwendung setzt", () => {
    expect(connectionIsSecure("https", "http://localhost:3000/go")).toBe(true);
    expect(connectionIsSecure("http", "http://localhost:3000/go")).toBe(false);
  });

  it("nimmt bei mehreren Werten den ersten", () => {
    expect(connectionIsSecure("https, http", "http://x/go")).toBe(true);
  });

  it("faellt ohne Kopf auf das Protokoll der Anfrage zurueck", () => {
    expect(connectionIsSecure(null, "https://dev.wegfara.com/go")).toBe(true);
    expect(connectionIsSecure(null, "http://localhost:3000/go")).toBe(false);
  });
});

describe("sessionCookieOptions", () => {
  it("ist fuer Skripte unlesbar und bleibt auf die eigene Seite beschraenkt", () => {
    const options = sessionCookieOptions(true);

    expect(options.httpOnly).toBe(true);
    expect(options.secure).toBe(true);
    expect(options.sameSite).toBe("lax");
    expect(options.path).toBe("/");
  });

  it("ueberdauert das Schliessen der App und einen Neustart (req-016)", () => {
    // Eine Laufzeit statt einer reinen Browser-Sitzung: nur so ueberlebt
    // das Cookie den Neustart des Geraets.
    expect(sessionCookieOptions(true).maxAge).toBe(SESSION_DURATION_MS / 1000);
  });

  it("verzichtet ohne HTTPS auf das Secure-Flag, sonst kaeme es nie an", () => {
    expect(sessionCookieOptions(false).secure).toBe(false);
  });
});

describe("challengeCookieOptions", () => {
  it("ist deutlich kurzlebiger als die Sitzung", () => {
    expect(challengeCookieOptions(true).maxAge).toBeLessThan(
      sessionCookieOptions(true).maxAge,
    );
  });
});

describe("expiredCookieOptions", () => {
  it("loescht das Cookie sofort", () => {
    expect(expiredCookieOptions(true).maxAge).toBe(0);
  });
});
