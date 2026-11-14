import { readdir } from "node:fs/promises";
import { fileSystemFileStore } from "@/lib/images/photo-store";
import {
  istMiniaturName,
  miniaturName,
  protokolliereMiniaturFehler,
  verkleinere,
} from "@/lib/images/miniatur";
import type { MiniaturenSchritt, MiniaturenStand } from "./types";

/**
 * Wie viele Originale ein Schritt hoechstens anfasst. Klein genug, dass ein
 * Schritt in gut einer Sekunde durch ist -- so laesst sich der Lauf
 * zwischen zwei Schritten jederzeit abbrechen, und der Fortschritt
 * bewegt sich sichtbar.
 */
export const MINIATUREN_JE_SCHRITT = 20;

/**
 * Die Namen im Bildverzeichnis, sortiert: die Originale und, getrennt
 * davon, die vorhandenen Miniaturen. Nur Dateien der obersten Ebene -- die
 * Dokumente in ihrem Unterverzeichnis bekommen keine Miniatur. Eine Datei,
 * die mit einem Punkt beginnt, ist eine Schreibprobe (bug-027) und kein
 * Bild.
 */
async function inhalt(
  dir: string,
): Promise<{ originale: string[]; miniaturen: Set<string> }> {
  let namen: string[];
  try {
    namen = (await readdir(dir, { withFileTypes: true }))
      .filter((eintrag) => eintrag.isFile())
      .map((eintrag) => eintrag.name);
  } catch {
    // Noch kein Bild abgelegt: das Verzeichnis entsteht mit dem ersten.
    namen = [];
  }
  return {
    originale: namen
      .filter((name) => !name.startsWith(".") && !istMiniaturName(name))
      .sort(),
    miniaturen: new Set(namen.filter(istMiniaturName)),
  };
}

function standAus(
  originale: string[],
  miniaturen: Set<string>,
): MiniaturenStand {
  return {
    bilder: originale.length,
    mitMiniatur: originale.filter((name) => miniaturen.has(miniaturName(name)))
      .length,
  };
}

export async function miniaturenStand(dir: string): Promise<MiniaturenStand> {
  const { originale, miniaturen } = await inhalt(dir);
  return standAus(originale, miniaturen);
}

/**
 * Ein Schritt des nachtraeglichen Laufs (req-105): die naechsten Originale
 * hinter `nach`, in der Reihenfolge ihrer Namen. Was schon eine Miniatur
 * hat, wird uebersprungen -- ein zweiter Lauf verkleinert nichts doppelt.
 *
 * Der Lauf fasst nur das Bildverzeichnis an, nie die Datensaetze: die
 * Miniatur hat keinen. Er haelt keinen Zustand auf dem Server; wo er steht,
 * traegt der Aufrufer von Schritt zu Schritt (`weiter`). Hoert er auf zu
 * fragen, ist der Lauf abgebrochen, und nichts bleibt halb.
 *
 * Ein Bild, das sich nicht verkleinern laesst, zaehlt als fehlgeschlagen und
 * haelt den Lauf nicht auf -- die Listen zeigen dafuer das Original.
 */
export async function holeMiniaturenNach(
  dir: string,
  nach: string | null,
  anzahl: number = MINIATUREN_JE_SCHRITT,
): Promise<MiniaturenSchritt> {
  const { originale, miniaturen } = await inhalt(dir);
  const offen = originale.filter((name) => nach === null || name > nach);
  const schritt = offen.slice(0, anzahl);
  const files = fileSystemFileStore(dir);

  let erzeugt = 0;
  let fehlgeschlagen = 0;
  for (const name of schritt) {
    const ziel = miniaturName(name);
    if (miniaturen.has(ziel)) continue;
    const data = await files.read(name);
    if (!data) continue;
    try {
      const miniatur = await verkleinere(data);
      // Kein Bild (etwa eine abgelegte Datei anderer Art): nichts zu tun.
      if (!miniatur) continue;
      await files.save(ziel, miniatur);
      miniaturen.add(ziel);
      erzeugt++;
    } catch (error) {
      protokolliereMiniaturFehler(name, error);
      fehlgeschlagen++;
    }
  }

  const letzter = schritt.at(-1) ?? nach;
  return {
    ...standAus(originale, miniaturen),
    geprueft:
      letzter === null ? 0 : originale.filter((n) => n <= letzter).length,
    erzeugt,
    fehlgeschlagen,
    weiter: offen.length > schritt.length ? (schritt.at(-1) ?? null) : null,
  };
}
