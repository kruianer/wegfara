import { mkdir, rm, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { imageDir } from "./photo-store";

/**
 * Warum die Bildablage nicht nutzbar ist (bug-027).
 *
 * "nicht_beschreibbar" ist der Fall, der auf dev auffiel: das Verzeichnis
 * existierte, gehoerte aber auf dem Host einem anderen Benutzer als dem im
 * Container. Der `chown` im Dockerfile half nicht -- der Volume-Mount legt
 * sich beim Start darueber.
 */
export type BildablageProblem = "nicht_gesetzt" | "nicht_beschreibbar";

export interface BildablageZustand {
  ok: boolean;
  problem: BildablageProblem | null;
  /**
   * Was das Dateisystem dazu sagte (z.B. EACCES) -- fuer das Protokoll des
   * Betreibers, nicht fuer die Antwort nach aussen.
   */
  detail: string | null;
}

const GUT: BildablageZustand = { ok: true, problem: null, detail: null };

/**
 * Legt das Bildverzeichnis an und prueft, ob die Anwendung wirklich
 * hineinschreiben kann (bug-027).
 *
 * Geprueft wird mit einem echten Schreibversuch und nicht mit den Rechtebits:
 * ob geschrieben werden darf, haengt an Benutzer, Gruppe, Mount-Optionen und
 * dem freien Platz -- das laesst sich nur ausprobieren. Die Probe wird
 * danach wieder entfernt.
 */
export async function pruefeBildablage(
  dir?: string,
): Promise<BildablageZustand> {
  let ablage: string;
  try {
    ablage = dir ?? imageDir();
  } catch {
    return {
      ok: false,
      problem: "nicht_gesetzt",
      detail: "IMAGE_DIR ist nicht gesetzt",
    };
  }

  const probe = path.join(ablage, `.schreibprobe-${randomUUID()}`);
  try {
    await mkdir(ablage, { recursive: true });
    await writeFile(probe, "");
  } catch (error) {
    return {
      ok: false,
      problem: "nicht_beschreibbar",
      detail: fehlerText(error),
    };
  } finally {
    await rm(probe, { force: true }).catch(() => {});
  }

  return GUT;
}

function fehlerText(error: unknown): string {
  const code = (error as { code?: unknown })?.code;
  if (typeof code === "string") return code;
  return error instanceof Error ? error.message : String(error);
}

/**
 * Was der Betreiber im Protokoll lesen soll -- null, wenn alles in Ordnung
 * ist. Ein Bildverzeichnis, in das nicht geschrieben werden kann, ist ein
 * Fehlerzustand und kein Hinweis: ohne es entsteht kein einziges Bild.
 */
export function bildablageMeldung(zustand: BildablageZustand): string | null {
  if (zustand.ok) return null;
  if (zustand.problem === "nicht_gesetzt") {
    return "Bildablage: IMAGE_DIR ist nicht gesetzt — es lassen sich keine Bilder speichern.";
  }
  return `Bildablage: Das Bildverzeichnis ist nicht beschreibbar (${zustand.detail}) — es lassen sich keine Bilder speichern. Auf dem Host muss es dem Benutzer im Container gehoeren.`;
}
