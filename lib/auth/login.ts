import type { Queryable } from "../db/queryable";
import type { Mailer } from "../mail/mailer";
import { loginLinkMail } from "../mail/login-link-mail";
import {
  consumeLoginLink,
  createLoginLink,
  invalidateLoginLinks,
} from "../db/login-links";
import { consumeAccessLink } from "../db/access-links";
import {
  enableLogin,
  findParticipantByEmail,
  findParticipantById,
} from "../db/participants";
import {
  createSession,
  deleteSessionByToken,
  deleteSessionsOfParticipant,
} from "../db/sessions";
import { createToken } from "./tokens";
import { isPlausibleEmail, normalizeEmail } from "./email";
import { environmentLabel } from "./environment";
import { absoluteUrl } from "./webauthn-config";
import { DEFAULT_AFTER_LOGIN, safeRedirectTarget } from "./redirect-target";
import { protokolliereErfolg, protokolliereFehlschlag } from "./protokoll";
import { LOGIN_LINK_PATH } from "./paths";
import type { Participant, Session } from "./types";

export interface LoginResult {
  session: Session;
  /** Gehoert ins Sitzungs-Cookie und wird nie gespeichert. */
  token: string;
}

/**
 * Legt eine Sitzung an (req-016). Gemeinsamer Abschluss aller
 * Anmeldewege -- Passkey, Anmeldelink und Zugangslink.
 *
 * Bis req-066 entstand hier bei der ersten Anmeldung eines Reiseleiters
 * ein Satz Notfallcodes. Den gibt es nicht mehr: er loeste dasselbe
 * Problem wie der Anmeldelink, und die Rueckfallebene ist jetzt allein das
 * hinterlegte Postfach.
 *
 * `credentialId` gibt nur der Passkey-Weg mit (req-037): die Sitzung endet
 * dann mit ihrem Passkey. Anmeldelink und Zugangslink lassen ihn null --
 * sie haengen an keinem Geraet.
 */
export async function beginSession(
  db: Queryable,
  participant: Participant,
  now: Date,
  credentialId: string | null = null,
): Promise<LoginResult> {
  const token = createToken();
  const session = await createSession(
    db,
    participant.id,
    token,
    now,
    credentialId,
  );
  return { session, token };
}

/**
 * Fordert einen Anmeldelink an. Liefert bewusst nichts zurueck, woraus
 * sich ablesen liesse, ob es die Adresse gibt: die Rueckmeldung an den
 * Browser ist bei bekannter und unbekannter Adresse dieselbe (req-016).
 */
export async function requestLoginLink(
  db: Queryable,
  mailer: Mailer,
  email: string,
  now: Date,
  weiter?: string | null,
): Promise<void> {
  // Nichts davon geht in die Antwort an den Browser -- sie bleibt fuer
  // bekannte und unbekannte Adressen wortgleich (req-016). Im Log steht es
  // trotzdem: sonst laesst sich nicht nachsehen, warum keine Mail ankam
  // (req-066).
  if (!isPlausibleEmail(email)) {
    protokolliereFehlschlag("anmeldelink", "adresse-unplausibel");
    return;
  }

  const participant = await findParticipantByEmail(db, normalizeEmail(email));
  if (!participant) {
    protokolliereFehlschlag("anmeldelink", "adresse-unbekannt");
    return;
  }

  // Ein neuer Link entwertet den vorherigen; sonst blieben mehrere
  // gueltige Zugaenge nebeneinander bestehen.
  await invalidateLoginLinks(db, participant.id, now);

  const token = createToken();
  await createLoginLink(db, participant.id, token, now);

  // Das gemerkte Ziel wandert mit in den Link, damit die Anmeldung dort
  // endet, wo sie unterbrochen wurde. Geprueft wird es beim Einloesen
  // erneut — der Link laeuft ueber das Postfach und ist damit veraenderbar.
  const ziel = safeRedirectTarget(weiter);
  const query =
    ziel === DEFAULT_AFTER_LOGIN
      ? `token=${encodeURIComponent(token)}`
      : `token=${encodeURIComponent(token)}&weiter=${encodeURIComponent(ziel)}`;

  // Verschickt wird ausschliesslich an die hinterlegte Adresse, nie an die
  // eingegebene (req-037): die dient allein dazu, das Konto zu finden.
  const empfaenger = participant.email ?? normalizeEmail(email);

  const versandt = await mailer.send(
    loginLinkMail(
      empfaenger,
      // Die Adresse stammt aus APP_URL und damit aus der Umgebung, in der die
      // Anfrage lief -- ein auf dev angeforderter Link zeigt auf dev. Aus
      // einem Kopf der Anfrage wird sie nie gebaut (req-037).
      absoluteUrl(`${LOGIN_LINK_PATH}?${query}`),
      environmentLabel(),
    ),
  );
  if (!versandt) {
    // Der Grund steht bereits im Log des Versands; hier nur, welcher Schritt
    // betroffen war. In die Antwort an den Browser gehoert er nie -- sie darf
    // nicht verraten, ob es die Adresse gibt (req-016).
    protokolliereFehlschlag("anmeldelink", "versand-fehlgeschlagen");
    return;
  }
  protokolliereErfolg("anmeldelink", participant.id);
}

/**
 * Loest einen Anmeldelink ein. Der Link wird dabei serverseitig entwertet
 * -- ein zweiter Aufruf meldet niemanden mehr an (req-016).
 */
export async function redeemLoginLink(
  db: Queryable,
  token: string,
  now: Date,
): Promise<LoginResult | null> {
  if (!token) return null;

  const participantId = await consumeLoginLink(db, token, now);
  if (!participantId) return null;

  const participant = await findParticipantById(db, participantId);
  if (!participant) return null;

  return beginSession(db, participant, now);
}

/**
 * Loest einen Zugangslink aus einer Einladung ein (req-023). Der Link ist
 * an genau eine Person gebunden: wer ihn einloest, wird zu ihr -- es
 * entsteht kein neuer, eigener Zugang.
 *
 * Er wird dabei serverseitig entwertet; ein zweiter Aufruf meldet
 * niemanden mehr an. Mit dem Einloesen erhaelt die Person ihren Zugang zur
 * Anwendung, gleich ob eine E-Mail-Adresse hinterlegt ist.
 */
export async function redeemAccessLink(
  db: Queryable,
  token: string,
  now: Date,
): Promise<LoginResult | null> {
  const participantId = await consumeAccessLink(db, token, now);
  if (!participantId) return null;

  await enableLogin(db, participantId);
  const participant = await findParticipantById(db, participantId);
  if (!participant) return null;

  return beginSession(db, participant, now);
}

/** Beendet die Sitzung sofort (req-016). */
export async function logout(db: Queryable, token: string): Promise<void> {
  if (!token) return;
  await deleteSessionByToken(db, token);
}

/**
 * "Ueberall abmelden" (req-037): beendet alle Sitzungen der Person auf allen
 * Geraeten, auch die gerade benutzte. Die Passkeys bleiben bestehen -- es ist
 * ein Abmelden, kein Aussperren.
 */
export async function logoutEverywhere(
  db: Queryable,
  participantId: string,
): Promise<void> {
  await deleteSessionsOfParticipant(db, participantId);
}
