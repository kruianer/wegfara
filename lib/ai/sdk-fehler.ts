import type { AiFehler, AiFehlerArt } from "./fehler";

/**
 * Wie ein Fehlschlag eines KI-SDKs auf einen benannten Grund abgebildet wird
 * (bug-032). Beide verwendeten SDKs -- OpenAI (req-014) und Anthropic
 * (req-081) -- werfen Fehler derselben Gestalt: ein HTTP-Status und, im
 * Koerper, die Worte des Dienstes selbst. Deshalb steht die Abbildung hier an
 * einer Stelle statt in jeder Anbindung erneut.
 */

/** Was der Dienst selbst zum Fehlschlag sagt — in seinen eigenen Worten. */
export function sdkFehlerDetail(error: unknown): string {
  const kandidat = error as {
    error?: { message?: unknown };
    message?: unknown;
  } | null;
  const ausDemKoerper = kandidat?.error?.message;
  if (typeof ausDemKoerper === "string" && ausDemKoerper.trim().length > 0) {
    return ausDemKoerper.trim();
  }
  if (typeof kandidat?.message === "string" && kandidat.message.trim()) {
    return kandidat.message.trim();
  }
  return String(error);
}

export function sdkFehlerStatus(error: unknown): number | null {
  const status = (error as { status?: unknown } | null)?.status;
  return typeof status === "number" ? status : null;
}

export function sdkFehlerArt(
  status: number | null,
  detail: string,
): AiFehlerArt {
  // Ohne Status kam nicht einmal eine Antwort zurueck.
  if (status === null) return "netz";
  if (status === 401 || status === 403) return "zugang";
  if (status === 429) return "kontingent";
  if (status === 404) return "modell";
  // Ein 400 sagt genau, was fehlt. Nennt es das Modell, ist es das Modell --
  // genau der Fall aus bug-032.
  if (status === 400) return /model/i.test(detail) ? "modell" : "anfrage";
  if (status >= 500) return "dienst";
  return "anfrage";
}

/** Bildet einen Fehlschlag eines KI-SDKs auf einen benannten Grund ab (bug-032). */
export function aiFehlerAusSdk(error: unknown): AiFehler {
  const detail = sdkFehlerDetail(error);
  return { art: sdkFehlerArt(sdkFehlerStatus(error), detail), detail };
}
