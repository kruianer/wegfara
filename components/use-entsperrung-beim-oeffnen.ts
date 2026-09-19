"use client";

import { useSyncExternalStore } from "react";
import { browserSupportsWebAuthn } from "@simplewebauthn/browser";
import { hatPasskeyAufDiesemGeraet } from "@/lib/auth/geraete-merker";

// Beides aendert sich waehrend einer Sitzung nicht, deshalb gibt es nichts
// zu abonnieren.
const subscribe = () => () => {};

const beimOeffnen = () =>
  browserSupportsWebAuthn() && hatPasskeyAufDiesemGeraet() ? "ja" : "nein";

// Serverseitig ist die Frage nicht zu beantworten: weder der Browser noch
// sein Speicher stehen dort zur Verfuegung. Die Anmeldeseite zeigt so
// lange nur die Marke -- niemals ein Formular, das gleich wieder
// verschwindet.
const nochUnbekannt = () => "unbekannt" as const;

/**
 * Ob die Anmeldeseite die Geraete-Entsperrung beim Oeffnen von selbst
 * starten darf (req-066): der Browser muss Passkeys beherrschen, und auf
 * diesem Geraet muss schon einmal einer eingerichtet oder benutzt worden
 * sein. Sonst saehe jeder Erstbesucher eine vergebliche Face-ID-Abfrage.
 */
export function useEntsperrungBeimOeffnen(): "unbekannt" | "ja" | "nein" {
  return useSyncExternalStore(subscribe, beimOeffnen, nochUnbekannt);
}
