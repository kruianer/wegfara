// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  LOGIN_LINK_DURATION_MS,
  SESSION_DURATION_MS,
  isExpired,
  loginLinkExpiresAt,
  sessionExpiresAt,
  shouldRenewSession,
} from "./lifetime";

const NOW = new Date("2026-08-16T12:00:00Z");

describe("Anmeldelink", () => {
  it("ist 15 Minuten gueltig (req-016)", () => {
    expect(LOGIN_LINK_DURATION_MS).toBe(15 * 60 * 1000);
  });

  it("laeuft 15 Minuten nach der Anforderung ab", () => {
    expect(loginLinkExpiresAt(NOW).toISOString()).toBe(
      "2026-08-16T12:15:00.000Z",
    );
  });
});

describe("Sitzungsdauer", () => {
  it("betraegt 90 Tage, solange es keine Teilnehmer gibt (req-016)", () => {
    expect(SESSION_DURATION_MS).toBe(90 * 24 * 60 * 60 * 1000);
  });

  it("laeuft 90 Tage nach der Anmeldung ab", () => {
    expect(sessionExpiresAt(NOW).toISOString()).toBe(
      "2026-11-14T12:00:00.000Z",
    );
  });
});

describe("shouldRenewSession", () => {
  it("verlaengert nicht bei jedem Aufruf", () => {
    expect(shouldRenewSession(sessionExpiresAt(NOW), NOW)).toBe(false);
  });

  it("verlaengert, sobald ein Tag der Laufzeit verbraucht ist", () => {
    const einTagSpaeter = new Date(NOW.getTime() + 24 * 60 * 60 * 1000);

    expect(shouldRenewSession(sessionExpiresAt(NOW), einTagSpaeter)).toBe(true);
  });
});

describe("isExpired", () => {
  it("erkennt eine abgelaufene Frist", () => {
    expect(isExpired(new Date(NOW.getTime() - 1), NOW)).toBe(true);
  });

  it("erkennt eine laufende Frist", () => {
    expect(isExpired(new Date(NOW.getTime() + 1), NOW)).toBe(false);
  });
});
