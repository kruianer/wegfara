import type { JSX } from "react";
import type { KachelLink, KachelLinkArt } from "@/lib/activities/kachel-links";
import {
  GlobeIcon,
  MailIcon,
  NavigationIcon,
  PhoneIcon,
} from "@/components/icons";
import styles from "./kachel-links.module.css";

const ZEICHEN: Record<
  KachelLinkArt,
  (props: { size?: number }) => JSX.Element
> = {
  navigation: NavigationIcon,
  webseite: GlobeIcon,
  telefon: PhoneIcon,
  email: MailIcon,
};

/**
 * Die Wege, die man unterwegs von der Kachel aus braucht (req-079) — der Weg
 * zum Ort, seine Webseite, sein Telefon, seine E-Mail.
 *
 * Auf der Kachel eines Smartphones ist fuer Beschriftungen kein Platz: sie
 * stehen als Symbole da und tragen jedes seinen Namen — fuer Vorleseprogramme
 * (`aria-label`) und als Tooltip (`title`). Was nicht hinterlegt ist, fehlt
 * hier ganz; ein Platzhalter oder ein Link ins Leere steht nie dabei.
 */
export function KachelLinks({
  links,
  activityId,
}: {
  links: KachelLink[];
  /** Nur zum Auffinden der Leiste in Tests — die Kacheln teilen sich ein Blatt. */
  activityId: string;
}) {
  if (links.length === 0) return null;

  return (
    <div
      className={styles.links}
      data-testid={`kachel-links-${activityId}`}
      role="group"
      aria-label="Wege zum Ort"
    >
      {links.map((link) => {
        const Zeichen = ZEICHEN[link.art];
        // Webseite und Navigation fuehren aus der App hinaus und oeffnen
        // deshalb ein eigenes Fenster; tel: und mailto: uebergibt das Geraet
        // an seine eigene App.
        const extern = link.art === "navigation" || link.art === "webseite";
        return (
          <a
            key={link.art}
            className={styles.link}
            href={link.href}
            aria-label={link.name}
            title={link.name}
            {...(extern
              ? { target: "_blank", rel: "noopener noreferrer" }
              : {})}
          >
            <Zeichen />
          </a>
        );
      })}
    </div>
  );
}
