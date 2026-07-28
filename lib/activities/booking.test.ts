import { describe, expect, it } from "vitest";
import { resolveBookingAction } from "./booking";
import type { Activity } from "./types";

function activity(overrides: Partial<Activity> = {}): Activity {
  return {
    id: "a",
    tripId: "trip-1",
    type: "aktivitaet",
    title: "Programmpunkt",
    shortText: "Kurztext",
    longText: "Langtext",
    startAt: "2026-07-18T10:00",
    endAt: "2026-07-18T11:00",
    position: { lat: 0, lng: 0 },
    ...overrides,
  };
}

describe("resolveBookingAction", () => {
  it("liefert fuer einen gebuchten Programmpunkt Unterlagen ohne Ziel", () => {
    const action = resolveBookingAction(activity({ booked: true }));
    expect(action).toEqual({ kind: "unterlagen", label: "Unterlagen" });
  });

  it("liefert Buchen mit der hinterlegten Webadresse", () => {
    const action = resolveBookingAction(
      activity({ bookingUrl: "https://example.com/reservieren" }),
    );
    expect(action).toEqual({
      kind: "buchen",
      label: "Buchen",
      href: "https://example.com/reservieren",
    });
  });

  it("liefert Anfragen mit mailto-Ziel, wenn nur eine E-Mail-Adresse hinterlegt ist", () => {
    const action = resolveBookingAction(
      activity({ bookingEmail: "kontakt@example.com" }),
    );
    expect(action).toEqual({
      kind: "anfragen",
      label: "Anfragen",
      href: "mailto:kontakt@example.com",
    });
  });

  it("liefert Anrufen mit tel-Ziel, wenn nur eine Telefonnummer hinterlegt ist", () => {
    const action = resolveBookingAction(
      activity({ bookingPhone: "+39 089 871483" }),
    );
    expect(action).toEqual({
      kind: "anrufen",
      label: "Anrufen",
      href: "tel:+39 089 871483",
    });
  });

  it("bevorzugt die Webadresse vor der Telefonnummer, wenn beide hinterlegt sind", () => {
    const action = resolveBookingAction(
      activity({
        bookingUrl: "https://example.com/reservieren",
        bookingPhone: "+39 089 871483",
      }),
    );
    expect(action?.kind).toBe("buchen");
  });

  it("bevorzugt die Webadresse vor der E-Mail-Adresse, wenn beide hinterlegt sind", () => {
    const action = resolveBookingAction(
      activity({
        bookingUrl: "https://example.com/reservieren",
        bookingEmail: "kontakt@example.com",
      }),
    );
    expect(action?.kind).toBe("buchen");
  });

  it("bevorzugt die E-Mail-Adresse vor der Telefonnummer, wenn beide hinterlegt sind", () => {
    const action = resolveBookingAction(
      activity({
        bookingEmail: "kontakt@example.com",
        bookingPhone: "+39 089 871483",
      }),
    );
    expect(action?.kind).toBe("anfragen");
  });

  it("gilt als gebucht auch dann, wenn zusaetzlich Kontaktwege hinterlegt sind", () => {
    const action = resolveBookingAction(
      activity({
        booked: true,
        bookingUrl: "https://example.com/reservieren",
      }),
    );
    expect(action?.kind).toBe("unterlagen");
  });

  it("liefert nichts, wenn weder gebucht noch ein Kontaktweg hinterlegt ist", () => {
    const action = resolveBookingAction(activity());
    expect(action).toBeNull();
  });
});
