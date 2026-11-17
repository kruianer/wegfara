// Health-Endpunkt: sagt, ob die Anwendung wirklich arbeiten kann.
// Bewusst ohne Datenbankzugriff — er soll auch dann antworten,
// wenn die DB gerade nicht erreichbar ist.
//
// Seit bug-027 gehoert die Bildablage dazu: ein Bildverzeichnis, in das die
// Anwendung nicht schreiben kann, ist ein Fehlerzustand und soll hier
// stehen, statt erst beim ersten Foto aufzufallen. Der Pfad geht dabei
// nicht hinaus — der Endpunkt ist oeffentlich (siehe middleware.ts) und
// gibt nur preis, dass etwas nicht stimmt, nicht wo.
//
// Seit req-108 meldet er auch ein eingestelltes KI-Modell, das der Dienst
// nicht mehr nennt — der Fall von bug-076, der drei Wochen unbemerkt blieb.
// Gefragt wird dafuer weder die Datenbank noch der Dienst: was hier steht,
// haben die Karte "KI-Modelle" und die KI-Anfragen beim Abgleich mit dem
// gemerkten Katalog hinterlassen (lib/ki-modelle/verschwunden.ts). Nach
// aussen gehen nur Zweck und Modell, kein Account. Die Anwendung laeuft
// dann weiter, nur diese eine Funktion nicht — deshalb "warnung" mit 200,
// nicht 503.

import { pruefeBildablage } from "@/lib/images/bildablage-pruefung";
import { verschwundeneModelle } from "@/lib/ki-modelle/verschwunden";

export const dynamic = "force-dynamic";

export async function GET() {
  const bildablage = await pruefeBildablage();
  const verschwunden = verschwundeneModelle();
  const kiModelleOk = verschwunden.length === 0;

  return Response.json(
    {
      status: !bildablage.ok ? "fehler" : kiModelleOk ? "ok" : "warnung",
      bildablage: { ok: bildablage.ok, problem: bildablage.problem },
      kiModelle: { ok: kiModelleOk, verschwunden },
    },
    { status: bildablage.ok ? 200 : 503 },
  );
}
