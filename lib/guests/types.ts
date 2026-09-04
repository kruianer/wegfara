import type { QrCode } from "../qr/qr-code";

/**
 * Der Zustand eines Gastzugangs (req-038). Er wird nie gespeichert, sondern
 * aus Ablauf und Widerruf gerechnet -- getrennt gefuehrt koennten beide
 * auseinanderlaufen.
 */
export type GuestAccessStatus = "aktiv" | "abgelaufen" | "widerrufen";

export const GUEST_ACCESS_STATUS_LABEL: Record<GuestAccessStatus, string> = {
  aktiv: "Aktiv",
  abgelaufen: "Abgelaufen",
  widerrufen: "Widerrufen",
};

/**
 * Ein Gastzugang, wie ihn die Liste zeigt (req-038): Zweck, Reise, Ablauf,
 * letzte Verwendung und Status. Das Geheimnis des Links steht hier nie --
 * gespeichert ist nur seine Pruefsumme, gezeigt wird er genau einmal.
 */
export interface GuestAccess {
  id: string;
  tripId: string;
  /** Zu welcher Reise der Zugang gehoert -- die Liste nennt sie beim Namen. */
  tripTitle: string;
  /** Kurzer Text, damit spaeter erkennbar ist, wem der Link gehoert. */
  purpose: string;
  createdAt: string;
  expiresAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
  status: GuestAccessStatus;
}

/**
 * Ein frisch erzeugter Gastzugang samt Link. Der Klartext liegt hier ein
 * einziges Mal vor und wird danach nie wieder ausgegeben (req-038) -- wer
 * ihn verliert, erzeugt einen neuen.
 */
export interface GuestLink {
  guestAccess: GuestAccess;
  /** Der Gastlink als absolute Adresse. */
  url: string;
  /** Derselbe Link als QR-Code. */
  qr: QrCode;
}

/**
 * Was eine laufende Gast-Sitzung freigibt: genau eine Reise, nur lesend.
 * Eine Person gehoert nicht dazu -- ein Gast hat kein Konto.
 */
export interface GuestSession {
  id: string;
  guestAccessId: string;
  accountId: string;
  tripId: string;
  purpose: string;
  expiresAt: Date;
}
