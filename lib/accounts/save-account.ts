import { ACCOUNTS_API } from "./paths";
import type { AccountOverview } from "./types";
import type { AccountDraft, AccountFieldErrors } from "./validate";

/**
 * Das Ergebnis eines Anlegeversuchs (req-025). Bei `ok: false` benennen die
 * Rueckmeldungen die betroffene Stelle; ein leeres `errors` heisst, dass der
 * Versuch gar nicht bis zur Pruefung kam -- dann bleiben die Eingaben stehen
 * und die Oberflaeche weist darauf hin.
 */
export type AccountSaveResult =
  | { ok: true; account: AccountOverview }
  | { ok: false; errors: AccountFieldErrors };

/**
 * Legt einen Account samt erster Person an (req-025). Ein Vorgang, bei dem
 * der Nutzer eine Bestaetigung erwartet -- er wird sofort ausgefuehrt, nicht
 * verzoegert (siehe delivery/stack.md, Conventions).
 */
export async function saveNewAccount(
  draft: AccountDraft,
): Promise<AccountSaveResult> {
  let response: Response;
  try {
    response = await fetch(ACCOUNTS_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft),
    });
  } catch {
    return { ok: false, errors: {} };
  }

  try {
    const payload = (await response.json()) as {
      account?: AccountOverview;
      errors?: AccountFieldErrors;
    };
    if (response.ok && payload.account) {
      return { ok: true, account: payload.account };
    }
    return { ok: false, errors: payload.errors ?? {} };
  } catch {
    return { ok: false, errors: {} };
  }
}
