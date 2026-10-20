/**
 * Geraeteseitige Zwischenablage der zuletzt gewaehlten Alternative einer
 * Options-Gruppe (bug-060).
 *
 * Die Anzeige uebernimmt eine Wahl sofort, das Speichern laeuft daneben her
 * -- lud die Seite neu, bevor der Schreibvorgang angekommen war, las sie den
 * alten Stand aus der Datenbank, obwohl die Wahl schon getroffen war. Das
 * Echo liegt synchron im localStorage, bevor der Schreibvorgang ueberhaupt
 * losgeschickt wird: ein Neuladen findet es unabhaengig davon vor, wie weit
 * der Schreibvorgang gekommen ist.
 *
 * Stimmt das Echo beim naechsten Laden mit dem serverseitigen Stand ueberein,
 * ist der Schreibvorgang angekommen und das Echo faellt weg -- ab dann
 * entscheidet wieder allein der Server (auch fuer die Wahl anderer
 * Teilnehmer). Weicht es ab, war der Schreibvorgang vermutlich am Neuladen
 * vorbeigelaufen und wird nachgeholt.
 */
const STORAGE_KEY = "wegfara.go.option-selection-echo";

function ablage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function schreibe(echo: Record<string, string>): void {
  const store = ablage();
  if (!store) return;
  try {
    store.setItem(STORAGE_KEY, JSON.stringify(echo));
  } catch {
    // Volle oder gesperrte Ablage: ohne Echo entscheidet allein der Server.
  }
}

/** Das Echo, so wie es gerade auf diesem Geraet liegt. */
export function ladeOptionSelectionEcho(): Record<string, string> {
  const store = ablage();
  if (!store) return {};
  const roh = store.getItem(STORAGE_KEY);
  if (roh === null) return {};
  try {
    const parsed: unknown = JSON.parse(roh);
    if (typeof parsed !== "object" || parsed === null) return {};
    return Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>).filter(
        (eintrag): eintrag is [string, string] =>
          typeof eintrag[1] === "string",
      ),
    );
  } catch {
    // Ein beschaedigter Eintrag ist kein Grund fuer einen Fehler: dann
    // entscheidet eben allein der Server.
    return {};
  }
}

/** Die Wahl gilt ab sofort -- unabhaengig davon, ob der Server sie schon hat. */
export function merkeOptionSelectionEcho(
  gruppenSchluessel: string,
  activityId: string,
): void {
  const echo = ladeOptionSelectionEcho();
  echo[gruppenSchluessel] = activityId;
  schreibe(echo);
}

/**
 * Das Echo dieser Gruppe faellt weg -- der Server hat die Wahl bestaetigt
 * oder sie wurde nach einem Fehlschlag zurueckgenommen. Danach entscheidet
 * wieder allein der Server.
 */
export function vergissOptionSelectionEcho(gruppenSchluessel: string): void {
  const echo = ladeOptionSelectionEcho();
  if (!(gruppenSchluessel in echo)) return;
  delete echo[gruppenSchluessel];
  schreibe(echo);
}
