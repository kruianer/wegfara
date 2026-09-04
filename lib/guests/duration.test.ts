// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  GUEST_ACCESS_DEFAULT_HOURS,
  GUEST_ACCESS_MAX_HOURS,
  GUEST_ACCESS_MIN_HOURS,
  guestAccessExpiresAt,
  readGuestDurationHours,
} from "./duration";

const NOW = new Date("2026-09-04T10:00:00Z");

describe("readGuestDurationHours (req-038)", () => {
  it("gilt ohne Angabe sieben Tage", () => {
    expect(readGuestDurationHours(undefined)).toEqual({
      ok: true,
      hours: GUEST_ACCESS_DEFAULT_HOURS,
    });
    expect(GUEST_ACCESS_DEFAULT_HOURS).toBe(7 * 24);
  });

  it("gilt auch bei leerer Angabe sieben Tage", () => {
    expect(readGuestDurationHours("")).toEqual({
      ok: true,
      hours: GUEST_ACCESS_DEFAULT_HOURS,
    });
    expect(readGuestDurationHours(null)).toEqual({
      ok: true,
      hours: GUEST_ACCESS_DEFAULT_HOURS,
    });
  });

  it("nimmt eine Stunde als kuerzeste Dauer an", () => {
    expect(readGuestDurationHours(GUEST_ACCESS_MIN_HOURS)).toEqual({
      ok: true,
      hours: 1,
    });
  });

  it("nimmt 90 Tage als laengste Dauer an", () => {
    expect(readGuestDurationHours(GUEST_ACCESS_MAX_HOURS)).toEqual({
      ok: true,
      hours: 90 * 24,
    });
  });

  it("lehnt mehr als 90 Tage ab, statt still zu kuerzen", () => {
    expect(readGuestDurationHours(GUEST_ACCESS_MAX_HOURS + 1).ok).toBe(false);
  });

  it("lehnt weniger als eine Stunde ab", () => {
    expect(readGuestDurationHours(0).ok).toBe(false);
    expect(readGuestDurationHours(-24).ok).toBe(false);
  });

  it("lehnt ab, was keine ganze Zahl von Stunden ist", () => {
    expect(readGuestDurationHours("unbegrenzt").ok).toBe(false);
    expect(readGuestDurationHours(1.5).ok).toBe(false);
    expect(readGuestDurationHours(Number.POSITIVE_INFINITY).ok).toBe(false);
  });

  it("nimmt eine Zahl auch als Text entgegen", () => {
    expect(readGuestDurationHours("24")).toEqual({ ok: true, hours: 24 });
  });
});

describe("guestAccessExpiresAt (req-038)", () => {
  it("rechnet die Stunden auf den Ablauf", () => {
    expect(guestAccessExpiresAt(NOW, 1).toISOString()).toBe(
      "2026-09-04T11:00:00.000Z",
    );
    expect(
      guestAccessExpiresAt(NOW, GUEST_ACCESS_DEFAULT_HOURS).toISOString(),
    ).toBe("2026-09-11T10:00:00.000Z");
  });
});
