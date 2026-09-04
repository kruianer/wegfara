import { ACCOUNT_SWITCH_API } from "./paths";

/** Rueckmeldung, wenn sich der Account nicht wechseln liess. */
export const ACCOUNT_SWITCH_ERRORS = {
  /** In der Oberflaeche heisst der Account seit req-036 "Bereich". */
  failed: "Der Bereich konnte nicht gewechselt werden.",
} as const;

async function post(body: unknown): Promise<boolean> {
  try {
    const response = await fetch(ACCOUNT_SWITCH_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Wechselt in einen fremden Account (req-025). Danach laedt die Seite neu:
 * was zu sehen ist, entscheidet der Server anhand der Sitzung -- ein
 * Nachziehen im Browser wuerde nur eine zweite Wahrheit schaffen.
 */
export function requestAccountSwitch(accountId: string): Promise<boolean> {
  return post({ accountId });
}

/** Kehrt in den eigenen Account zurueck -- die Schaltflaeche im Hinweisbalken. */
export function requestReturnToOwnAccount(): Promise<boolean> {
  return post({});
}
