import type { QrCode } from "../qr/qr-code";

/**
 * Eine erzeugte Einladung (req-023). Der Zugangslink liegt hier ein
 * einziges Mal im Klartext vor -- in der Datenbank steht nur seine
 * Pruefsumme. QR-Code und Link fuehren an dieselbe Stelle: der Reiseleiter
 * laesst den Code abscannen oder verschickt den Link ueber einen
 * beliebigen Kanal.
 */
export interface Invitation {
  /** Die Person, an die der Link gebunden ist. */
  participantId: string;
  /** Der Zugangslink als absolute Adresse. */
  url: string;
  /** Derselbe Link als QR-Code. */
  qr: QrCode;
  /** Wann der Link verfaellt -- sieben Tage nach dem Erzeugen. */
  expiresAt: string;
}
