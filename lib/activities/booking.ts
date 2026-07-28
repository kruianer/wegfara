import type { Activity } from "./types";

export type BookingActionKind =
  | "unterlagen"
  | "buchen"
  | "anfragen"
  | "anrufen";

export interface BookingAction {
  kind: BookingActionKind;
  label: string;
  /** Ziel der Schaltflaeche; ungesetzt bei "unterlagen" (bewusst ohne Funktion). */
  href?: string;
}

const LABEL: Record<BookingActionKind, string> = {
  unterlagen: "Unterlagen",
  buchen: "Buchen",
  anfragen: "Anfragen",
  anrufen: "Anrufen",
};

/** Feste Farben nach Design Tokens, unabhaengig vom Theme (siehe type-meta.ts). */
export const BOOKING_ACTION_COLOR: Record<
  BookingActionKind,
  { color: string; background: string }
> = {
  unterlagen: { color: "var(--good)", background: "var(--good-soft)" },
  buchen: { color: "var(--acc)", background: "var(--acc-soft)" },
  anfragen: { color: "var(--acc)", background: "var(--acc-soft)" },
  anrufen: { color: "var(--acc)", background: "var(--acc-soft)" },
};

/**
 * Bestimmt Beschriftung und Ziel der Buchungs-Schaltflaeche eines
 * Programmpunkts (siehe req-005). Ist der Programmpunkt gebucht, gilt das
 * unabhaengig von hinterlegten Kontaktwegen. Sonst entscheidet die
 * Rangfolge Webadresse vor E-Mail vor Telefon. Ohne gebuchten Zustand und
 * ohne jeden Kontaktweg gibt es keine Schaltflaeche.
 */
export function resolveBookingAction(activity: Activity): BookingAction | null {
  if (activity.booked) {
    return { kind: "unterlagen", label: LABEL.unterlagen };
  }
  if (activity.bookingUrl) {
    return { kind: "buchen", label: LABEL.buchen, href: activity.bookingUrl };
  }
  if (activity.bookingEmail) {
    return {
      kind: "anfragen",
      label: LABEL.anfragen,
      href: `mailto:${activity.bookingEmail}`,
    };
  }
  if (activity.bookingPhone) {
    return {
      kind: "anrufen",
      label: LABEL.anrufen,
      href: `tel:${activity.bookingPhone}`,
    };
  }
  return null;
}
