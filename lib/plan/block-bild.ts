import { TYP_ZEICHEN_PX, ZEITSTRAHL_BILD_PX } from "@/lib/design/stil";

/** Die gemessene Groesse eines Blocks im Zeitstrahl, samt Rahmen. */
export type BlockMass = { breitePx: number; hoehePx: number };

/**
 * Was ein Programmpunkt mit Teaserbild davon zeigt (req-111): das Bild nur,
 * wenn der Block breit genug ist -- sonst braucht der Titel den Platz --, und
 * das Zeichen mit dem Typ darauf nur, wenn er hoch genug ist.
 *
 * Entschieden wird am gemessenen Block und nicht an der Zahl der Spuren oder
 * der Dauer: die Spalte laesst sich breiter ziehen (req-109), und der Zoom
 * aendert die Hoehe (req-076). Ohne Messung -- der Block liegt noch nicht im
 * Layout -- steht beides da; ein Block ohne Groesse ist ohnehin nicht zu
 * sehen.
 */
export function blockBild(mass: BlockMass | undefined): {
  bild: boolean;
  zeichen: boolean;
} {
  if (!mass) return { bild: true, zeichen: true };
  const bild = mass.breitePx >= ZEITSTRAHL_BILD_PX.minBlockBreite;
  return {
    bild,
    zeichen: bild && mass.hoehePx >= TYP_ZEICHEN_PX.minBlockHoehe,
  };
}
