const HOUR_MS = 60 * 60 * 1000;

/**
 * Wie lange ein Gastzugang gilt (req-038). Waehlbar zwischen einer Stunde
 * und hoechstens 90 Tagen, voreingestellt sieben Tage -- nie unbegrenzt.
 * Ein Gastlink laeuft ueber unsichere Kanaele und ist bewusst schwaecher
 * als ein Passkey; ohne Frist waere aus einem kurzen Blick ein dauerhafter
 * Zugang geworden.
 */
export const GUEST_ACCESS_MIN_HOURS = 1;
export const GUEST_ACCESS_MAX_HOURS = 90 * 24;
export const GUEST_ACCESS_DEFAULT_HOURS = 7 * 24;

/** Die Dauern, die der Reiseleiter zur Auswahl bekommt. */
export const GUEST_ACCESS_DURATIONS: { hours: number; label: string }[] = [
  { hours: 1, label: "1 Stunde" },
  { hours: 24, label: "1 Tag" },
  { hours: 3 * 24, label: "3 Tage" },
  { hours: GUEST_ACCESS_DEFAULT_HOURS, label: "7 Tage" },
  { hours: 30 * 24, label: "30 Tage" },
  { hours: GUEST_ACCESS_MAX_HOURS, label: "90 Tage" },
];

export const GUEST_DURATION_ERROR =
  "Ein Gastzugang gilt zwischen einer Stunde und höchstens 90 Tagen.";

export type GuestDurationResult =
  | { ok: true; hours: number }
  | { ok: false; error: string };

/**
 * Liest die gewuenschte Dauer aus einer Anfrage. Fehlt sie, gelten sieben
 * Tage; liegt sie ausserhalb der Grenzen, wird sie abgelehnt statt still
 * zurechtgebogen (req-038).
 */
export function readGuestDurationHours(value: unknown): GuestDurationResult {
  if (value === undefined || value === null || value === "") {
    return { ok: true, hours: GUEST_ACCESS_DEFAULT_HOURS };
  }

  const hours =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value.trim())
        : Number.NaN;

  if (!Number.isInteger(hours))
    return { ok: false, error: GUEST_DURATION_ERROR };
  if (hours < GUEST_ACCESS_MIN_HOURS || hours > GUEST_ACCESS_MAX_HOURS) {
    return { ok: false, error: GUEST_DURATION_ERROR };
  }
  return { ok: true, hours };
}

/** Wann ein jetzt erzeugter Gastzugang verfaellt. */
export function guestAccessExpiresAt(now: Date, hours: number): Date {
  return new Date(now.getTime() + hours * HOUR_MS);
}
