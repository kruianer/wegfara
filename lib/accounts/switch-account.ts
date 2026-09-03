import type { Queryable } from "../db/queryable";
import { accountExists } from "../db/accounts";
import { recordAccountSwitch } from "../db/account-switches";
import { setActingAccount } from "../db/sessions";
import type { Session } from "../auth/types";

/**
 * Wechselt den Account, in dem der Gesamt-Admin arbeitet (req-025). Er
 * arbeitet dort mit denselben Rechten wie dessen Personen und sieht immer
 * nur den Account, in dem er sich gerade befindet -- nie mehrere
 * gleichzeitig.
 *
 * Der Wechsel haengt an der Sitzung, nicht an der Anfrage: aus der Anfrage
 * kommt die Kennung genau einmal, hier, und danach nie wieder (req-024).
 *
 * Jeder Wechsel in einen fremden Account wird festgehalten: wer, in welchen
 * Account, wann. Die Rueckkehr in den eigenen ist kein solcher Wechsel und
 * erzeugt keinen Eintrag.
 *
 * Liefert false, wenn es den Account nicht gibt.
 */
export async function switchToAccount(
  db: Queryable,
  session: Session,
  accountId: string,
  now: Date,
): Promise<boolean> {
  // Der eigene Account ist kein fremder -- das ist die Rueckkehr.
  if (accountId === session.participant.accountId) {
    await returnToOwnAccount(db, session);
    return true;
  }

  if (!(await accountExists(db, accountId))) return false;

  await setActingAccount(db, session.id, accountId);
  await recordAccountSwitch(db, session.participant.id, accountId, now);
  return true;
}

/**
 * Bringt den Gesamt-Admin in seinen eigenen Account zurueck -- das, was die
 * Schaltflaeche im Hinweisbalken tut (req-025).
 */
export async function returnToOwnAccount(
  db: Queryable,
  session: Session,
): Promise<void> {
  await setActingAccount(db, session.id, null);
}
