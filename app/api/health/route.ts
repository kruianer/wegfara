// Health-Endpunkt: bestaetigt, dass die Anwendung laeuft.
// Bewusst ohne Datenbankzugriff — er soll auch dann antworten,
// wenn die DB gerade nicht erreichbar ist.

export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({ status: "ok" });
}
