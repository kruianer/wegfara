"use client";

/**
 * Der Merker, ob auf diesem Geraet schon einmal ein Passkey dieser App
 * eingerichtet oder benutzt wurde (req-066).
 *
 * WebAuthn beantwortet die Frage "gibt es hier einen Passkey?" bewusst
 * nicht -- die Antwort waere ein Erkennungsmerkmal des Geraets. Ohne sie
 * bliebe nur, die Entsperrung bei jedem Oeffnen blind zu starten; wer hier
 * noch keinen Passkey hat, saehe dann jedes Mal eine vergebliche
 * Face-ID-Abfrage. Deshalb merkt sich die Anwendung es selbst.
 *
 * Der Merker ist kein Zugangsnachweis: er entscheidet allein, ob die
 * Anmeldeseite die Entsperrung von sich aus startet. Wer ihn faelscht,
 * bekommt eine Entsperrung, die niemanden kennt -- und danach den
 * Anmeldedialog.
 */
export const PASSKEY_MERKER = "wegfara.passkey-auf-diesem-geraet";

/**
 * Der Speicher des Browsers, sofern er zugaenglich ist. Safari wirft im
 * privaten Modus schon beim Zugriff; das darf die Anmeldeseite nicht
 * zerlegen -- ohne Merker geht es eben ueber den Anmeldedialog.
 */
function speicher(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function hatPasskeyAufDiesemGeraet(): boolean {
  try {
    return speicher()?.getItem(PASSKEY_MERKER) === "ja";
  } catch {
    return false;
  }
}

export function merkePasskeyAufDiesemGeraet(): void {
  try {
    speicher()?.setItem(PASSKEY_MERKER, "ja");
  } catch {
    // Ohne Speicher bleibt es beim Anmeldedialog -- kein Grund zu scheitern.
  }
}

export function vergissPasskeyAufDiesemGeraet(): void {
  try {
    speicher()?.removeItem(PASSKEY_MERKER);
  } catch {
    // Siehe oben.
  }
}
