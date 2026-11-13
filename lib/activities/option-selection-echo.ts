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
/**
 * Wahlen, die der Server bestaetigt hat, mit seiner Uhrzeit des Speicherns
 * (bug-073). Sie leben nur bis zum naechsten Laden: Las der Server die neue
 * Seite, bevor er die Wahl gespeichert hatte, ist ihr Stand aelter als die
 * Wahl -- dann gilt diese. Las er sie danach, entscheidet er allein.
 */
const BESTAETIGT_KEY = "wegfara.go.option-selection-bestaetigt";

export interface BestaetigteWahl {
  activityId: string;
  /** Server-Uhrzeit (ms seit 1970), zu der die Wahl gespeichert war. */
  um: number;
}

function ablage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function schreibe(
  echo: Record<string, unknown>,
  schluessel: string = STORAGE_KEY,
): void {
  const store = ablage();
  if (!store) return;
  try {
    store.setItem(schluessel, JSON.stringify(echo));
  } catch {
    // Volle oder gesperrte Ablage: ohne Echo entscheidet allein der Server.
  }
}

/** Das Echo, so wie es gerade auf diesem Geraet liegt. */
export function ladeOptionSelectionEcho(): Record<string, string> {
  return Object.fromEntries(
    Object.entries(lies(STORAGE_KEY)).filter(
      (eintrag): eintrag is [string, string] => typeof eintrag[1] === "string",
    ),
  );
}

/** Die vom Server bestaetigten Wahlen, die das naechste Laden noch braucht (bug-073). */
export function ladeBestaetigteOptionSelections(): Record<
  string,
  BestaetigteWahl
> {
  return Object.fromEntries(
    Object.entries(lies(BESTAETIGT_KEY)).filter(
      (eintrag): eintrag is [string, BestaetigteWahl] => {
        const wert = eintrag[1] as Partial<BestaetigteWahl> | null;
        return (
          typeof wert === "object" &&
          wert !== null &&
          typeof wert.activityId === "string" &&
          typeof wert.um === "number"
        );
      },
    ),
  );
}

function lies(schluessel: string): Record<string, unknown> {
  const store = ablage();
  if (!store) return {};
  const roh = store.getItem(schluessel);
  if (roh === null) return {};
  try {
    const parsed: unknown = JSON.parse(roh);
    if (typeof parsed !== "object" || parsed === null) return {};
    return parsed as Record<string, unknown>;
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
  vergissBestaetigung(gruppenSchluessel);
}

/**
 * Der Server hat die Wahl gespeichert (bug-073). Das Echo faellt weg, aber
 * nicht spurlos: Kam die Bestaetigung waehrend eines Neuladens an, hat der
 * Server die neue Seite womoeglich schon vorher gelesen -- mit dem alten
 * Stand. Die Bestaetigung samt Uhrzeit sagt der neuen Seite, dass ihr Stand
 * dann veraltet ist.
 *
 * Steht im Echo inzwischen eine andere Wahl derselben Gruppe, ist diese
 * Bestaetigung ueberholt und aendert nichts. Ohne Uhrzeit des Servers faellt
 * das Echo einfach weg.
 */
export function bestaetigeOptionSelectionEcho(
  gruppenSchluessel: string,
  activityId: string,
  um: number | null,
): void {
  const echo = ladeOptionSelectionEcho();
  if (echo[gruppenSchluessel] !== activityId) return;
  delete echo[gruppenSchluessel];
  schreibe(echo);
  if (um === null) return;
  const bestaetigt = ladeBestaetigteOptionSelections();
  bestaetigt[gruppenSchluessel] = { activityId, um };
  schreibe(bestaetigt, BESTAETIGT_KEY);
}

/**
 * Das Echo dieser Gruppe faellt weg -- der Server hat die Wahl bestaetigt
 * oder sie wurde nach einem Fehlschlag zurueckgenommen. Danach entscheidet
 * wieder allein der Server.
 */
export function vergissOptionSelectionEcho(gruppenSchluessel: string): void {
  vergissBestaetigung(gruppenSchluessel);
  const echo = ladeOptionSelectionEcho();
  if (!(gruppenSchluessel in echo)) return;
  delete echo[gruppenSchluessel];
  schreibe(echo);
}

function vergissBestaetigung(gruppenSchluessel: string): void {
  const bestaetigt = ladeBestaetigteOptionSelections();
  if (!(gruppenSchluessel in bestaetigt)) return;
  delete bestaetigt[gruppenSchluessel];
  schreibe(bestaetigt, BESTAETIGT_KEY);
}
