import { describe, expect, it } from "vitest";
import {
  BUCHUNGSZUSTAND_LABEL,
  buchungszustand,
  resolveBookingAction,
} from "./booking";
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

describe("buchungszustand (req-079)", () => {
  it("nennt einen gebuchten Programmpunkt gebucht", () => {
    expect(buchungszustand(activity({ booked: true }))).toBe("gebucht");
  });

  it("nennt einen nicht gebuchten Programmpunkt mit Kontaktweg offen", () => {
    expect(
      buchungszustand(
        activity({ booked: false, bookingUrl: "https://example.com" }),
      ),
    ).toBe("offen");
    expect(
      buchungszustand(activity({ bookingEmail: "kontakt@example.com" })),
    ).toBe("offen");
    expect(buchungszustand(activity({ bookingPhone: "+39 089 871483" }))).toBe(
      "offen",
    );
  });

  it("nennt keinen Zustand, wo nichts zu buchen ist", () => {
    // Ohne jeden Kontaktweg zum Buchen gibt es nichts zu buchen -- dann steht
    // auf der Kachel weder "gebucht" noch "offen".
    expect(buchungszustand(activity())).toBeNull();
  });

  it("gilt als gebucht auch dann, wenn noch Kontaktwege hinterlegt sind", () => {
    expect(
      buchungszustand(
        activity({ booked: true, bookingPhone: "+39 089 871483" }),
      ),
    ).toBe("gebucht");
  });

  it("benennt beide Zustaende, ohne einen zu verschweigen", () => {
    expect(BUCHUNGSZUSTAND_LABEL.gebucht).toBe("Gebucht");
    expect(BUCHUNGSZUSTAND_LABEL.offen).toBe("Noch nicht gebucht");
  });
});
