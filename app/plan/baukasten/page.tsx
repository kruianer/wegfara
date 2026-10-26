import { requireSuperAdmin } from "@/lib/auth/super-admin";
import { KatalogView } from "./katalog-view";

// Haengt an der Sitzung des Aufrufers -- nie statisch vorrendern.
export const dynamic = "force-dynamic";

/**
 * Der Baukasten (req-089): jeder Baustein der Oberflaeche bei 375, 768 und
 * 1280 px zugleich. Die Seite ist fuer die Entwicklung, nicht fuer
 * Reisende -- sie sieht ausschliesslich der Gesamt-Admin. Wer sie ohne die
 * Kennzeichnung aufruft, bekommt dieselbe Antwort wie fuer eine Adresse, die
 * es nicht gibt (siehe lib/auth/super-admin.ts).
 *
 * Keine Reise, keine Daten aus der Datenbank: was die Bausteine zeigen, ist
 * ausgedacht.
 */
export default async function BaukastenPage() {
  await requireSuperAdmin();
  return <KatalogView />;
}
