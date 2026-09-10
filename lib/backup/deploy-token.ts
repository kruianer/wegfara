import { timingSafeEqual } from "node:crypto";
import { envGeheimnis } from "@/lib/env/umgebung";

/**
 * Der prod-Deploy sichert ueber dieselbe Funktion wie die Oberflaeche und
 * nicht ueber einen eigenen Weg (req-053): der Workflow ruft
 * `POST /api/backups` auf dem laufenden Anwendungsserver auf. Weil dabei
 * niemand angemeldet ist, weist er sich mit dem Geheimnis der Umgebung aus.
 *
 * Genommen wird AUTH_SECRET aus `~/wegfara-env/<umgebung>.env` (siehe
 * delivery/devops.md) -- dasselbe Geheimnis, das die Anmeldung und die
 * Zugangsschluessel schuetzt. Ein zweites Geheimnis waere ein zweiter Ort,
 * an dem es verloren gehen kann.
 */
export const DEPLOY_TOKEN_HEADER = "x-wegfara-deploy";

export function deployTokenMatches(
  provided: string | null | undefined,
): boolean {
  // Leer zaehlt wie nicht gesetzt (bug-032): ein leeres Geheimnis darf nie
  // zu einem passenden Vergleich fuehren.
  const secret = envGeheimnis("AUTH_SECRET");
  if (!secret || !provided) return false;

  const angeboten = Buffer.from(provided, "utf8");
  const erwartet = Buffer.from(secret, "utf8");
  // Ohne gleiche Laenge vergleicht timingSafeEqual nicht; die Laenge selbst
  // verraet nichts, was nicht ohnehin an der Antwortzeit ablesbar waere.
  if (angeboten.length !== erwartet.length) return false;
  return timingSafeEqual(angeboten, erwartet);
}
