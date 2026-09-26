import type { Activity } from "./types";
import type { Poi } from "../pois/types";
import { poiMapsUrl } from "../pois/maps-link";

/**
 * Die Wege, die man unterwegs von einer Kachel des Begleiters aus braucht
 * (req-079): der Weg zum Ort, seine Webseite und die weiteren hinterlegten
 * Kontaktwege.
 *
 * Woher sie kommen:
 *
 * - Die Navigation aus der Position und, wenn der Ort aus Google stammt,
 *   seiner Kennung — gebaut wird sie von `poiMapsUrl` (lib/pois/maps-link.ts)
 *   und nicht hier nachgebaut.
 * - Webseite und Telefon stehen am POI (`web`, `phone`, req-026).
 * - Eine E-Mail fuehrt der POI nicht; sie kommt, wenn hinterlegt, vom
 *   Programmpunkt selbst (`bookingEmail`, req-005) — ebenso eine Nummer, die
 *   nur dort steht.
 *
 * Was nicht hinterlegt ist, ergibt keinen Eintrag: auf der Kachel steht kein
 * toter Link und kein Platzhalter.
 */
export type KachelLinkArt = "navigation" | "webseite" | "telefon" | "email";

export interface KachelLink {
  art: KachelLinkArt;
  /**
   * Der Name des Wegs — er steht als Beschriftung fuer Vorleseprogramme am
   * Symbol und erscheint als Tooltip. Er nennt den Ort, damit er auch ausserhalb
   * der Kachel verstaendlich bleibt.
   */
  name: string;
  href: string;
}

/** Die Reihenfolge, in der die Wege auf der Kachel stehen. */
const REIHENFOLGE: KachelLinkArt[] = [
  "navigation",
  "webseite",
  "telefon",
  "email",
];

function gefuellt(wert: string | undefined): string | null {
  const text = (wert ?? "").trim();
  return text.length > 0 ? text : null;
}

export function kachelLinks(
  activity: Pick<
    Activity,
    "title" | "position" | "bookingEmail" | "bookingPhone"
  >,
  poi?: Pick<Poi, "position" | "googlePlaceId" | "web" | "phone">,
): KachelLink[] {
  const links: Partial<Record<KachelLinkArt, KachelLink>> = {};

  // Die Position des Programmpunkts; hat er keine, die seines Ortes. Ohne
  // beides gibt es keinen Weg dorthin — und deshalb keinen Eintrag.
  const position = activity.position ?? poi?.position;
  if (position) {
    links.navigation = {
      art: "navigation",
      name: `Navigation zu ${activity.title}`,
      href: poiMapsUrl({ position, googlePlaceId: poi?.googlePlaceId }),
    };
  }

  const web = gefuellt(poi?.web);
  if (web) {
    links.webseite = {
      art: "webseite",
      name: `Webseite von ${activity.title}`,
      href: web,
    };
  }

  const telefon = gefuellt(poi?.phone) ?? gefuellt(activity.bookingPhone);
  if (telefon) {
    links.telefon = {
      art: "telefon",
      name: `${activity.title} anrufen`,
      href: `tel:${telefon}`,
    };
  }

  const email = gefuellt(activity.bookingEmail);
  if (email) {
    links.email = {
      art: "email",
      name: `E-Mail an ${activity.title}`,
      href: `mailto:${email}`,
    };
  }

  return REIHENFOLGE.map((art) => links[art]).filter(
    (link): link is KachelLink => link !== undefined,
  );
}
