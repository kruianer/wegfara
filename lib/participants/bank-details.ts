const BANK_DETAILS_API = "/api/bankverbindung";

/**
 * Die Bankverbindung einer Person, geholt fuer den Ueberweisungscode
 * (req-031). `iban` ist null, solange fuer sie keine hinterlegt ist --
 * `ok: false` heisst dagegen, dass sich gar nichts holen liess.
 */
export type BankDetailsResult =
  | { ok: true; iban: string | null }
  | { ok: false };

/**
 * Holt die Bankverbindung einer Person -- erst auf Anforderung, nicht schon
 * beim Aufbau der Ausgleichsliste (req-031). Ob sie herausgegeben wird,
 * entscheidet der Server anhand der Sitzung.
 */
export async function fetchBankDetails(
  participantId: string,
): Promise<BankDetailsResult> {
  try {
    const response = await fetch(
      `${BANK_DETAILS_API}?teilnehmer=${encodeURIComponent(participantId)}`,
    );
    if (!response.ok) return { ok: false };

    const payload = (await response.json()) as { iban?: unknown };
    return {
      ok: true,
      iban: typeof payload.iban === "string" ? payload.iban : null,
    };
  } catch {
    return { ok: false };
  }
}
