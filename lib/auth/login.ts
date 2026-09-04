import type { Queryable } from "../db/queryable";
import type { Mailer } from "../mail/mailer";
import { loginLinkMail } from "../mail/login-link-mail";
import {
  consumeLoginLink,
  createLoginLink,
  invalidateLoginLinks,
} from "../db/login-links";
import { consumeAccessLink } from "../db/access-links";
import { deleteGuestSessionByToken } from "../db/guest-access";
import {
  enableLogin,
  findParticipantByEmail,
  findParticipantById,
} from "../db/participants";
import { leadsAnyTrip } from "../db/trip-participants";
import {
  consumeRecoveryCode,
  hasRecoveryCodes,
  replaceRecoveryCodes,
} from "../db/recovery-codes";
import {
  createSession,
  deleteSessionByToken,
  deleteSessionsOfParticipant,
} from "../db/sessions";
import { createToken } from "./tokens";
import { isPlausibleEmail, normalizeEmail } from "./email";
import { environmentLabel } from "./environment";
import {
  generateRecoveryCodes,
  isPlausibleRecoveryCode,
} from "./recovery-codes";
import { absoluteUrl } from "./webauthn-config";
import { DEFAULT_AFTER_LOGIN, safeRedirectTarget } from "./redirect-target";
import { LOGIN_LINK_PATH } from "./paths";
import type { Participant, Session } from "./types";

export interface LoginResult {
  session: Session;
  /** Gehoert ins Sitzungs-Cookie und wird nie gespeichert. */
  token: string;
  /**
   * Der frisch erzeugte Satz Notfallcodes bei der ersten Anmeldung eines
   * Reiseleiters, sonst null. Nur an dieser Stelle liegen die Codes im
   * Klartext vor -- danach existieren nur noch ihre Pruefsummen.
   */
  recoveryCodes: string[] | null;
}

/**
 * Legt eine Sitzung an und erzeugt bei der allerersten Anmeldung den
 * Satz Notfallcodes (req-016). Gemeinsamer Abschluss aller Anmeldewege --
 * Passkey, Anmeldelink, Notfallcode und Zugangslink.
 *
 * Notfallcodes bekommt nur, wer eine Reise fuehrt (req-023): Teilnehmer
 * brauchen keine, weil sie immer jemanden haben, der sie mit einer neuen
 * Einladung wieder hereinholt -- jeder zusaetzliche Zugangsweg waere nur
 * Angriffsflaeche.
 *
 * `credentialId` gibt nur der Passkey-Weg mit (req-037): die Sitzung endet
 * dann mit ihrem Passkey. Anmeldelink, Notfallcode und Zugangslink lassen ihn
 * null -- sie haengen an keinem Geraet.
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
  const firstLogin = !(await hasRecoveryCodes(db, participant.id));
  const recoveryCodes =
    firstLogin && (await leadsAnyTrip(db, participant.id))
      ? await createRecoveryCodeSet(db, participant.id, now)
      : null;
  return { session, token, recoveryCodes };
}

/**
 * Erzeugt einen neuen Satz Notfallcodes, der den alten ersetzt. Die Codes
 * werden nur hier zurueckgegeben und danach nie wieder -- gespeichert
 * wird ausschliesslich ihre Pruefsumme.
 */
export async function createRecoveryCodeSet(
  db: Queryable,
  participantId: string,
  now: Date,
): Promise<string[]> {
  const codes = generateRecoveryCodes();
  await replaceRecoveryCodes(db, participantId, codes, now);
  return codes;
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
  if (!isPlausibleEmail(email)) return;

  const participant = await findParticipantByEmail(db, normalizeEmail(email));
  if (!participant) return;

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
    // Der Grund steht bereits im Log des Versands; hier nur, welcher Vorgang
    // betroffen war. In die Antwort an den Browser gehoert er nie -- sie darf
    // nicht verraten, ob es die Adresse gibt (req-016).
    console.error("Anmeldelink konnte nicht versandt werden.");
  }
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

/**
 * Meldet mit einem Notfallcode an. Der Code wird dabei verbraucht und
 * kann kein zweites Mal verwendet werden (req-016).
 */
export async function loginWithRecoveryCode(
  db: Queryable,
  email: string,
  code: string,
  now: Date,
): Promise<LoginResult | null> {
  if (!isPlausibleEmail(email) || !isPlausibleRecoveryCode(code)) return null;

  const participant = await findParticipantByEmail(db, normalizeEmail(email));
  if (!participant) return null;

  const accepted = await consumeRecoveryCode(db, participant.id, code, now);
  if (!accepted) return null;

  return beginSession(db, participant, now);
}

/** Beendet die Sitzung sofort (req-016). */
export async function logout(db: Queryable, token: string): Promise<void> {
  if (!token) return;
  await deleteSessionByToken(db, token);
  // Dasselbe Cookie kann eine Gast-Sitzung tragen (req-038) -- sie liegt in
  // einer eigenen Tabelle und muss hier ebenso enden. Ohne das bliebe ein
  // Gast angemeldet, waehrend das Cookie geloescht scheint.
  await deleteGuestSessionByToken(db, token);
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
