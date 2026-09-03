import { notFound } from "next/navigation";
import { requireSession } from "./current-session";
import type { Session } from "./types";

/**
 * Die Account-Verwaltung sieht ausschliesslich der Gesamt-Admin (req-025).
 * Wer die Adresse ohne die Kennzeichnung direkt aufruft, bekommt keinen
 * Zugriff -- und zwar dieselbe Antwort wie fuer eine Adresse, die es nicht
 * gibt: dass es diesen Bereich ueberhaupt gibt, geht sonst niemanden etwas
 * an.
 *
 * Die Kennzeichnung wird ausschliesslich direkt in der Datenbank gesetzt.
 * Es gibt keine Schaltflaeche und keine Schnittstelle, ueber die sich
 * jemand selbst oder andere dazu machen kann (req-025, Constraints).
 */
export async function requireSuperAdmin(): Promise<Session> {
  const session = await requireSession();
  if (!session.superAdmin) notFound();
  return session;
}
