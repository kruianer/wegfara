import { currentSession } from "@/lib/auth/current-session";
import { unauthorized } from "@/lib/auth/api-guard";
import { searchPlaces } from "@/lib/osm/place-search";

/**
 * Die Ortssuche fuer den Hauptort einer Reise (siehe req-017). Sie laeuft
 * ueber den Server, damit die Anfrage an Nominatim den geforderten
 * User-Agent traegt und der Browser des Nutzers nicht selbst dort auftaucht.
 */
export async function GET(request: Request) {
  if (!(await currentSession())) return unauthorized();

  const query = new URL(request.url).searchParams.get("q") ?? "";
  const places = await searchPlaces(query);

  return Response.json({ places });
}
