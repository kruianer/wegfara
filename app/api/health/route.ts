// Health-Endpunkt: sagt, ob die Anwendung wirklich arbeiten kann.
// Bewusst ohne Datenbankzugriff — er soll auch dann antworten,
// wenn die DB gerade nicht erreichbar ist.
//
// Seit bug-027 gehoert die Bildablage dazu: ein Bildverzeichnis, in das die
// Anwendung nicht schreiben kann, ist ein Fehlerzustand und soll hier
// stehen, statt erst beim ersten Foto aufzufallen. Der Pfad geht dabei
// nicht hinaus — der Endpunkt ist oeffentlich (siehe middleware.ts) und
// gibt nur preis, dass etwas nicht stimmt, nicht wo.

import { pruefeBildablage } from "@/lib/images/bildablage-pruefung";

export const dynamic = "force-dynamic";

export async function GET() {
  const bildablage = await pruefeBildablage();

  return Response.json(
    {
      status: bildablage.ok ? "ok" : "fehler",
      bildablage: { ok: bildablage.ok, problem: bildablage.problem },
    },
    { status: bildablage.ok ? 200 : 503 },
  );
}
