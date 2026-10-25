"use client";

import { useEffect, useState } from "react";
import { ladeStandortlage } from "@/lib/live-status/lade-standortlage";
import { OHNE_STANDORT, type Standortlage } from "@/lib/live-status/types";
import { lokaleZeit } from "@/lib/live-status/zeit";

/** Wie oft die Uhr weiterspringt -- fein genug fuer eine Anzeige in Minuten. */
const UHR_INTERVALL_MS = 20_000;

/** Wie oft Ort und Verzug neu beim Server erfragt werden. */
const LAGE_INTERVALL_MS = 60_000;

/**
 * Uhr und Lage des Live-Status (req-051) an einer Stelle: der Live-Status
 * und die Linien im Zeitstrahl (req-086) lesen beide von hier und koennen
 * deshalb nie Unterschiedliches sagen.
 *
 * `jetzt` ist die lokale Zeit "YYYY-MM-DDTHH:mm" beim Aufbau der Seite; sie
 * kommt vom Server, damit die erste Darstellung im Browser dieselbe ist,
 * danach laeuft die Uhr im Geraet weiter. Solange `aktiv` nicht gilt, wird
 * nichts abgefragt.
 */
export function useLiveLage(
  tripId: string,
  jetzt: string,
  aktiv = true,
): { zeit: string; lage: Standortlage } {
  const [zeit, setZeit] = useState(jetzt);
  const [lage, setLage] = useState<Standortlage>(OHNE_STANDORT);

  useEffect(() => {
    if (!aktiv) return;
    const uhr = setInterval(
      () => setZeit(lokaleZeit(new Date())),
      UHR_INTERVALL_MS,
    );
    return () => clearInterval(uhr);
  }, [aktiv]);

  useEffect(() => {
    if (!aktiv) return;
    const controller = new AbortController();
    let laufend = true;

    async function holen() {
      const geladen = await ladeStandortlage(tripId, controller.signal);
      if (laufend) setLage(geladen);
    }

    void holen();
    const takt = setInterval(() => void holen(), LAGE_INTERVALL_MS);
    return () => {
      laufend = false;
      controller.abort();
      clearInterval(takt);
    };
  }, [tripId, aktiv]);

  return { zeit, lage };
}
