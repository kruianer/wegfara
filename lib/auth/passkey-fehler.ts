import { fehlerName } from "./entsperrung";

/**
 * Warum das Einrichten eines Passkeys oder eine Anmeldung damit
 * gescheitert ist (req-066).
 *
 * Bis dahin bildete ein `catch` jeden Grund auf denselben Satz ab. Genau
 * das hat die Fehlersuche an bug-046 so lange aufgehalten -- und dasselbe
 * Muster steckte schon hinter bug-021, bug-026, bug-027 und bug-032. Wer
 * auf den Bildschirm sieht, soll lesen koennen, woran es lag.
 */

/** Der Vorgang, in dem es schiefging -- er faerbt die Formulierung. */
export type PasskeyVorgang = "einrichten" | "anmelden";

/**
 * Ein Grund, den der Server genannt hat. Er ist bereits fertig
 * formuliert und wird unveraendert angezeigt: der Browser weiss an dieser
 * Stelle weniger als die Schnittstelle.
 */
export class PasskeyFehler extends Error {
  constructor(text: string) {
    super(text);
    this.name = "PasskeyFehler";
  }
}

const EINRICHTEN: Record<string, string> = {
  NotAllowedError:
    "Die Geräte-Entsperrung wurde abgebrochen oder hat zu lange gedauert.",
  TimeoutError: "Die Geräte-Entsperrung hat zu lange gedauert.",
  AbortError:
    "Der Vorgang wurde unterbrochen, bevor das Gerät antworten konnte.",
  InvalidStateError:
    "Auf diesem Gerät ist für dich bereits ein Passkey hinterlegt. Du kannst dich damit direkt anmelden.",
  ConstraintError:
    "Auf diesem Gerät ist keine Entsperrung eingerichtet. Richte Face ID, Touch ID, Windows Hello oder eine Bildschirmsperre ein und versuche es noch einmal.",
  NotSupportedError:
    "Dieses Gerät kann keinen Passkey anlegen, der die Geräte-Entsperrung verlangt.",
  SecurityError:
    "Die Adresse dieser Seite passt nicht zum Passkey. Öffne wegfara über die gewohnte Adresse.",
  UnknownError: "Das Gerät konnte den Passkey nicht erzeugen.",
};

const ANMELDEN: Record<string, string> = {
  NotAllowedError:
    "Die Geräte-Entsperrung wurde abgebrochen oder hat zu lange gedauert.",
  TimeoutError: "Die Geräte-Entsperrung hat zu lange gedauert.",
  AbortError:
    "Der Vorgang wurde unterbrochen, bevor das Gerät antworten konnte.",
  InvalidStateError: "Das Gerät hat den Passkey nicht freigegeben.",
  ConstraintError:
    "Auf diesem Gerät ist keine Entsperrung eingerichtet. Ohne Face ID, Touch ID oder Windows Hello lässt sich der Passkey nicht verwenden.",
  NotSupportedError: "Dieses Gerät kann keine Passkeys verwenden.",
  SecurityError:
    "Die Adresse dieser Seite passt nicht zum Passkey. Öffne wegfara über die gewohnte Adresse.",
  UnknownError: "Das Gerät konnte den Passkey nicht lesen.",
};

const VORSPANN: Record<PasskeyVorgang, string> = {
  einrichten: "Der Passkey konnte nicht eingerichtet werden",
  anmelden: "Die Anmeldung mit dem Passkey hat nicht geklappt",
};

/**
 * Der Grund im Klartext. Ein vom Server genannter Grund gilt unveraendert;
 * sonst entscheidet der Name der DOMException, die der Browser geworfen
 * hat. Bleibt auch der unbekannt, steht wenigstens er selbst da -- ein
 * Name, den man nachschlagen kann, ist mehr als "hat nicht geklappt".
 */
export function passkeyFehlerText(
  fehler: unknown,
  vorgang: PasskeyVorgang,
): string {
  if (fehler instanceof PasskeyFehler) return fehler.message;

  const name = fehlerName(fehler);
  const bekannt = name
    ? (vorgang === "einrichten" ? EINRICHTEN : ANMELDEN)[name]
    : undefined;
  if (bekannt) return `${VORSPANN[vorgang]}: ${bekannt}`;

  return `${VORSPANN[vorgang]}: ${name ?? "unbekannter Fehler"}.`;
}

/**
 * Liest den Grund aus einer abweisenden Antwort der Passkey-Schnittstellen.
 * Nennt sie keinen, steht wenigstens ihr Status da -- auch das
 * unterscheidet einen Fall vom anderen.
 */
export async function serverFehler(
  response: Response,
  vorgang: PasskeyVorgang,
): Promise<PasskeyFehler> {
  try {
    const { error } = (await response.json()) as { error?: unknown };
    if (typeof error === "string" && error) return new PasskeyFehler(error);
  } catch {
    // Keine lesbare Antwort -- dann bleibt nur der Status.
  }
  return new PasskeyFehler(
    `${VORSPANN[vorgang]}: Die Schnittstelle antwortete mit ${response.status}.`,
  );
}

/**
 * Die Schritte, an denen die Schnittstellen scheitern koennen (req-066).
 * Derselbe Schluessel steht im Server-Log und traegt den Satz, den der
 * Browser zeigt -- so gehoert beides sichtbar zusammen.
 */
export const PASSKEY_GRUND = {
  nichtAngemeldet: "nicht-angemeldet",
  anfrageUnlesbar: "anfrage-unlesbar",
  aufforderungFehlt: "aufforderung-fehlt",
  antwortFehlt: "antwort-fehlt",
  pruefungFehlgeschlagen: "pruefung-fehlgeschlagen",
  nichtBestaetigt: "nicht-bestaetigt",
  passkeyUnbekannt: "passkey-unbekannt",
  personUnbekannt: "person-unbekannt",
  speichernFehlgeschlagen: "speichern-fehlgeschlagen",
} as const;

export type PasskeyGrund = (typeof PASSKEY_GRUND)[keyof typeof PASSKEY_GRUND];

/** Was zu einem Grund auf dem Bildschirm steht. */
export const PASSKEY_GRUND_TEXT: Record<PasskeyGrund, string> = {
  "nicht-angemeldet":
    "Deine Sitzung ist abgelaufen. Öffne den Link aus deiner Einladung noch einmal oder melde dich neu an.",
  "anfrage-unlesbar": "Der Browser hat eine unvollständige Anfrage geschickt.",
  "aufforderung-fehlt":
    "Die Aufforderung des Servers war abgelaufen. Versuche es noch einmal.",
  "antwort-fehlt": "Das Gerät hat keine Antwort geliefert.",
  "pruefung-fehlgeschlagen":
    "Die Antwort des Geräts ließ sich nicht prüfen — sie passt nicht zur Aufforderung dieser Umgebung.",
  "nicht-bestaetigt":
    "Das Gerät hat die Entsperrung nicht nachgewiesen. wegfara verlangt Face ID, Touch ID oder Windows Hello.",
  "passkey-unbekannt":
    "Dieser Passkey ist hier nicht hinterlegt. Nimm den Weg über „Zugang verloren“.",
  "person-unbekannt":
    "Zu diesem Passkey gibt es keine Person mehr. Wende dich an den Reiseleiter.",
  "speichern-fehlgeschlagen": "Der Passkey ließ sich nicht hinterlegen.",
};

/** Der fertige Satz zu einem Grund -- Schnittstelle und Bildschirm gleich. */
export function passkeyGrundText(
  grund: PasskeyGrund,
  vorgang: PasskeyVorgang,
): string {
  return `${VORSPANN[vorgang]}: ${PASSKEY_GRUND_TEXT[grund]}`;
}
