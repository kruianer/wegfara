/**
 * "Meine Geraete" (req-037): die Regeln rund um die Passkeys eines Kontos,
 * ohne Datenbank und ohne Oberflaeche -- damit Anzeige und Schnittstelle
 * dieselben verwenden.
 */

/** Ein Passkey ohne eigene Bezeichnung heisst schlicht so. */
export const DEFAULT_CREDENTIAL_LABEL = "Passkey";

/**
 * Warum ein Passkey nicht entfernt werden konnte:
 * `unbekannt` -- er gehoert nicht zu dieser Person,
 * `letzterOhneAdresse` -- es waere der letzte, und ohne hinterlegte
 * E-Mail-Adresse bliebe kein Weg zurueck ins Konto.
 */
export type PasskeyRemovalRefusal = "unbekannt" | "letzterOhneAdresse";

export const PASSKEY_REMOVAL_MESSAGE: Record<PasskeyRemovalRefusal, string> = {
  unbekannt: "Dieses Gerät gehört nicht zu deinem Konto.",
  letzterOhneAdresse:
    "Das ist dein letztes Gerät. Ohne hinterlegte E-Mail-Adresse käme niemand mehr in dein Konto — hinterlege zuerst eine Adresse.",
};

/**
 * Prueft, ob ein Passkey entfernt werden darf. Liefert null, wenn ja, sonst
 * den Grund der Ablehnung.
 *
 * Der letzte Passkey geht nur mit hinterlegter E-Mail-Adresse: sonst sperrt
 * sich der Nutzer selbst aus. In wegfara traegt jeder Teilnehmer eine Adresse,
 * die Pruefung geht praktisch immer durch -- sie gehoert trotzdem hierher,
 * statt sich auf das Schema zu verlassen (req-037).
 */
export function passkeyRemovalRefusal(
  passkeys: { id: string }[],
  id: string,
  email: string | null,
): PasskeyRemovalRefusal | null {
  if (!passkeys.some((passkey) => passkey.id === id)) return "unbekannt";
  if (passkeys.length === 1 && !email?.trim()) return "letzterOhneAdresse";
  return null;
}

/**
 * Der Zeitpunkt, wie ihn "Meine Geraete" zeigt, z.B. "04.09.2026". Formatiert
 * wird auf dem Server und als fertiger Text weitergereicht: die Kontoseite
 * wird auch serverseitig gerendert, und eine hier gebildete Ortszeit muesste
 * dort und im Browser dieselbe sein.
 */
export function formatDeviceMoment(value: Date): string {
  const zweistellig = (zahl: number) => String(zahl).padStart(2, "0");
  return `${zweistellig(value.getDate())}.${zweistellig(value.getMonth() + 1)}.${value.getFullYear()}`;
}
