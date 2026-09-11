import type { Kostenzeile } from "./types";

/**
 * Die beiden Summen unter der Tabelle (req-062): was die Reise insgesamt
 * kostet und was davon auf eine Person entfaellt.
 *
 * Die Kosten je Person sind die Gesamtkosten geteilt durch die
 * Teilnehmerzahl -- damit sich ein Mietauto auf alle verteilt. Sie sind
 * deshalb etwas anderes als der Preis je Person einer einzelnen Zeile.
 */
export interface KostenSummen {
  gesamtCent: number;
  /** Null, wenn der Reise noch niemand zugeordnet ist -- geteilt wird dann durch nichts. */
  jePersonCent: number | null;
}

export function kostenSummen(
  zeilen: Kostenzeile[],
  teilnehmerzahl: number,
): KostenSummen {
  // Eine Zeile ohne eingetragenen Preis zaehlt mit null Euro: "nicht
  // eingetragen" ist kein Betrag, den man raten koennte.
  const gesamtCent = zeilen.reduce(
    (summe, zeile) => summe + (zeile.gesamtCent ?? 0),
    0,
  );
  return {
    gesamtCent,
    jePersonCent:
      teilnehmerzahl > 0 ? Math.round(gesamtCent / teilnehmerzahl) : null,
  };
}
