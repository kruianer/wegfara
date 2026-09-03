import type { Queryable } from "../db/queryable";
import { createAccount, emailTakenAnywhere } from "../db/accounts";
import { createParticipant } from "../db/participants";
import type { AccountOverview } from "./types";
import type { AccountInput } from "./validate";

/**
 * Legt einen Account samt seiner ersten Person an (req-025). Beides gehoert
 * zusammen: zu jedem neuen Account gehoert genau eine erste Person -- ohne
 * sie gaebe es niemanden, der ihn uebernehmen koennte.
 *
 * Die Person bekommt noch keinen Zugang; den erhaelt sie erst, wenn sie
 * ihren Zugangslink einloest (req-023). Bis dahin steht sie in der Liste
 * als "Nicht eingeladen".
 *
 * Account-Admin ist sie von Anfang an (req-027): sonst haette der neue
 * Account niemanden, der seine Personen verwalten darf.
 *
 * Liefert null, wenn die Adresse installationsweit schon vergeben ist.
 */
export async function createAccountWithFirstPerson(
  db: Queryable,
  input: AccountInput,
  now: Date,
): Promise<AccountOverview | null> {
  if (await emailTakenAnywhere(db, input.personEmail)) return null;

  const account = await createAccount(db, input.name, input.personEmail);
  const person = await createParticipant(
    db,
    account.id,
    {
      name: input.personName,
      nickname: null,
      email: input.personEmail,
      phone: null,
      iban: null,
    },
    now,
    true,
  );

  return {
    id: account.id,
    name: account.name,
    personCount: 1,
    firstPerson: { id: person.id, name: person.name, access: "offen" },
  };
}
