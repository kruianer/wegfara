/**
 * Ein Account und was der Gesamt-Admin von ihm sieht (req-025). Die Liste
 * zeigt Namen, die Anzahl der Personen und den Zugangsstatus der ersten
 * Person -- Reisen, POIs und Kontaktdaten fremder Accounts bleiben auch fuer
 * ihn ausserhalb des Wechsels unsichtbar (siehe delivery/security.md).
 */
export interface AccountOverview {
  id: string;
  name: string;
  /** Wie viele Personen zu diesem Account gehoeren. */
  personCount: number;
  /** Die erste Person des Accounts; null, solange er keine hat. */
  firstPerson: AccountFirstPerson | null;
}

export interface AccountFirstPerson {
  id: string;
  name: string;
  access: AccessStatus;
}

/**
 * Wie weit die erste Person eines Accounts hereingekommen ist:
 * - `offen` — es gibt noch keine gueltige Einladung,
 * - `eingeladen` — ein Zugangslink ist erzeugt und noch nicht eingeloest,
 * - `eingeloest` — sie hat ihren Zugang eingeloest und einen Passkey.
 *
 * Zugang hat, wer tatsaechlich hereingekommen ist -- das blosse Erzeugen
 * einer Einladung reicht nicht (siehe req-023).
 */
export type AccessStatus = "offen" | "eingeladen" | "eingeloest";

export const ACCESS_STATUS_LABEL: Record<AccessStatus, string> = {
  offen: "Nicht eingeladen",
  eingeladen: "Eingeladen",
  eingeloest: "Zugang",
};
