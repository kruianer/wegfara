/**
 * Die Symbole der Oberflaeche, an einer Stelle -- die kleinen Zeichen auf den
 * Schaltflaechen des Planers und die groesseren der unteren Leiste des
 * Begleiters (bug-034).
 */

export function PencilIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M4 20h4l10-10-4-4L4 16v4Z M14.5 5.5l4 4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M5 7h14 M9 7V5h6v2 M7 7l1 12h8l1-12 M10 10v6 M14 10v6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Schiebt ein Bild eines POI eine Stelle nach vorn (req-035). */
export function ArrowUpIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 19V6 M6 12l6-6 6 6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * Schaltet die Pfeile zwischen den POIs der Tageskarte ein und aus
 * (req-075): ein Weg, der in einer Spitze endet -- eine Strecke mit
 * Richtung.
 */
export function RoutenPfeilIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M4 19c5 0 3-9 8-9h7 M15 6l4 4-4 4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 5v14 M5 12h14"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Startet eine Bewertungsrunde (req-054): der Stern, den ein Ort bekommt. */
export function StarIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 4.5l2.5 5.1 5.5.8-4 3.9.9 5.6-4.9-2.6-4.9 2.6.9-5.6-4-3.9 5.5-.8z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Beendet die laufende Bewertungsrunde (req-054): das gewohnte Halt-Zeichen. */
export function StopIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
      <rect
        x="6"
        y="6"
        width="12"
        height="12"
        rx="2.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Zeichnet das Suchgebiet auf der Karte (req-012, als Symbol seit bug-042):
 * eine Flaeche mit den Griffen an ihren Ecken.
 */
export function PolygonIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M6 6.5 17 5l2 11-12 3L6 6.5Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {[
        [6, 6.5],
        [17, 5],
        [19, 16],
        [7, 19],
      ].map(([cx, cy]) => (
        <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="2" fill="currentColor" />
      ))}
    </svg>
  );
}

/**
 * Blendet das Suchgebiet auf der Karte aus (req-102): ein offenes Auge -- das
 * Gebiet ist zu sehen.
 */
export function AugeIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle
        cx="12"
        cy="12"
        r="3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      />
    </svg>
  );
}

/** Das Gegenteil: das Auge durchgestrichen -- das Gebiet ist ausgeblendet. */
export function AugeZuIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z M4 20 20 4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle
        cx="12"
        cy="12"
        r="3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      />
    </svg>
  );
}

/**
 * Die Karte nimmt die ganze Breite (bug-042) -- die vier Ecken zeigen nach
 * aussen, wie beim Vollbild eines Videos.
 */
export function FullscreenIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M4 9V4h5 M15 4h5v5 M20 15v5h-5 M9 20H4v-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Das Gegenteil: die Liste kommt zurueck, die Ecken zeigen nach innen. */
export function FullscreenExitIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M9 4v5H4 M15 4v5h5 M20 15h-5v5 M4 15h5v5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * Die Symbole der Bereiche des Begleiters (bug-034). Sie stehen in der
 * unteren Leiste ueber ihrer Beschriftung und sind deshalb groesser als die
 * Schaltflaechen-Zeichen darueber -- ein Symbol findet man im Vorbeigehen,
 * Text muss man lesen.
 */
function BereichIcon({ d, size }: { d: string; size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path
        d={d}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Der Tagesplan: ein Kalenderblatt mit Eintraegen. */
export function PlanIcon({ size = 20 }: { size?: number }) {
  return (
    <BereichIcon
      size={size}
      d="M4 5h16v15H4V5Z M4 10h16 M8 3v4 M16 3v4 M7.5 14h9 M7.5 17h5"
    />
  );
}

/** Die Karte: ein gefaltetes Blatt. */
export function MapIcon({ size = 20 }: { size?: number }) {
  return (
    <BereichIcon
      size={size}
      d="M9 4 3 6.5v13.5L9 17.5l6 2.5 6-2.5V4l-6 2.5L9 4Z M9 4v13.5 M15 6.5V20"
    />
  );
}

/** Die Kosten: ein Geldschein. */
export function CostsIcon({ size = 20 }: { size?: number }) {
  return (
    <BereichIcon
      size={size}
      d="M2.5 6.5h19v11h-19v-11Z M14.5 12a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0Z M6 10.5v3 M18 10.5v3"
    />
  );
}

/** Die Dokumente: ein Blatt mit umgeknickter Ecke. */
export function DocumentsIcon({ size = 20 }: { size?: number }) {
  return (
    <BereichIcon
      size={size}
      d="M13.5 3H6v18h12V7.5L13.5 3Z M13.5 3v4.5H18 M9 13h6 M9 16.5h6"
    />
  );
}

/** Die Meldungen: eine Glocke. */
export function WarningsIcon({ size = 20 }: { size?: number }) {
  return (
    <BereichIcon
      size={size}
      d="M18 9a6 6 0 1 0-12 0c0 5-2.5 7-2.5 7h17S18 14 18 9Z M10.2 19.5a2.2 2.2 0 0 0 3.6 0"
    />
  );
}

/** Der Concierge: die Glocke am Empfangstresen. */
export function ConciergeIcon({ size = 20 }: { size?: number }) {
  return (
    <BereichIcon
      size={size}
      d="M2.5 18.5h19 M4.5 15.5a7.5 7.5 0 0 1 15 0H4.5Z M12 8V5.5 M10 5.5h4"
    />
  );
}

/** "Mehr": drei Punkte fuer die Eintraege, die unter diesem Menuepunkt stehen (bug-063). */
export function MoreIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="4.5" cy="12" r="1.8" fill="currentColor" />
      <circle cx="12" cy="12" r="1.8" fill="currentColor" />
      <circle cx="19.5" cy="12" r="1.8" fill="currentColor" />
    </svg>
  );
}

/*
 * Die Symbole der Bereiche des Planers (req-077). Eingeklappt traegt die
 * Seitenleiste nur sie -- ein Symbol je Bereich, in derselben Strichstaerke
 * wie die des Begleiters darueber.
 */

/** Die gesammelten Orte: die Nadel auf der Karte. */
export function OrteIcon({ size = 20 }: { size?: number }) {
  return (
    <BereichIcon
      size={size}
      d="M12 21.5S19 14.2 19 9.5a7 7 0 1 0-14 0c0 4.7 7 12 7 12Z M14.5 9.2a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0Z"
    />
  );
}

/** Die Bewertungen: der Stern, den ein Ort von der Gruppe bekommt. */
export function BewertungenIcon({ size = 20 }: { size?: number }) {
  return (
    <BereichIcon
      size={size}
      d="M12 3.5l2.8 5.7 6.2.9-4.5 4.4 1 6.2-5.5-2.9-5.5 2.9 1-6.2L3 10.1l6.2-.9L12 3.5Z"
    />
  );
}

/** Die Reisedetails: das Merkzeichen zur geoeffneten Reise. */
export function DetailsIcon({ size = 20 }: { size?: number }) {
  return (
    <BereichIcon
      size={size}
      d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z M12 11.5v5 M12 7.5v.2"
    />
  );
}

/** "Mein Bereich": die angemeldete Person. */
export function PersonIcon({ size = 20 }: { size?: number }) {
  return (
    <BereichIcon
      size={size}
      d="M12 12.5a4.2 4.2 0 1 0 0-8.4 4.2 4.2 0 0 0 0 8.4Z M4.5 20.5c1.4-3.6 4.2-5.4 7.5-5.4s5.9 1.8 7.5 5.4"
    />
  );
}

/** "Wer faehrt mit": zwei Personen nebeneinander (req-087). */
export function MitreisendeIcon({ size = 20 }: { size?: number }) {
  return (
    <BereichIcon
      size={size}
      d="M9 11.5a3.6 3.6 0 1 0 0-7.2 3.6 3.6 0 0 0 0 7.2Z M2.5 20c1.2-3.2 3.6-4.8 6.5-4.8s5.3 1.6 6.5 4.8 M16 4.6a3.4 3.4 0 0 1 0 6.6 M18 15.6c1.6.7 2.8 2.2 3.5 4.4"
    />
  );
}

/** Die Verwaltung: das Schild ueber allen Accounts. */
export function VerwaltungIcon({ size = 20 }: { size?: number }) {
  return (
    <BereichIcon
      size={size}
      d="M12 3l7.5 3v5.6c0 4.4-3.2 8-7.5 9.9-4.3-1.9-7.5-5.5-7.5-9.9V6L12 3Z M9.2 12.1l2 2 3.6-3.8"
    />
  );
}

/** Die geoeffnete Reise: der Koffer, in dem sie steckt. */
export function ReiseIcon({ size = 20 }: { size?: number }) {
  return (
    <BereichIcon
      size={size}
      d="M3.5 7.5h17v12h-17v-12Z M9 7.5V5h6v2.5 M3.5 12.5h17"
    />
  );
}

/**
 * Das Chatfenster (req-081): eine Sprechblase mit drei Punkten darin -- das
 * Zeichen fuer "hier wird geredet".
 */
export function ChatIcon({ size = 20 }: { size?: number }) {
  return (
    <BereichIcon
      size={size}
      d="M4 5.5h16v11H12l-5 4v-4H4v-11Z M8.5 11h.01 M12 11h.01 M15.5 11h.01"
    />
  );
}

/** Der gedruckte Reiseplan (req-080): ein Drucker mit Blatt darin. */
export function DruckIcon({ size = 20 }: { size?: number }) {
  return (
    <BereichIcon
      size={size}
      d="M7 8.5V3.5h10v5 M4.5 8.5h15v8h-2.5 M7 16.5H4.5 M7 13h10v7.5H7V13Z"
    />
  );
}

/**
 * Die Wege zu einem Ort: der Weg dorthin, seine Webseite, sein Telefon und
 * seine E-Mail. Sie stehen als Symbole auf der Kachel des Begleiters
 * (req-079) und, kleiner, auf ihren Buchungs-Schaltflaechen (req-005) --
 * dasselbe Zeichen an beiden Stellen.
 */
function WegIcon({ d, size }: { d: string; size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinejoin="round"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  );
}

/** Die Navigation: der Pfeil, der losfliegt. */
export function NavigationIcon({ size = 18 }: { size?: number }) {
  return <WegIcon size={size} d="M21 3 3 10.5l7.5 2.7L13.2 21 21 3Z" />;
}

/** Die Webseite: die Weltkugel. */
export function GlobeIcon({ size = 18 }: { size?: number }) {
  return (
    <WegIcon
      size={size}
      d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z M3 12h18 M12 3a14 14 0 0 1 0 18 M12 3a14 14 0 0 0 0 18"
    />
  );
}

/** Das Telefon: der Hoerer. */
export function PhoneIcon({ size = 18 }: { size?: number }) {
  return (
    <WegIcon
      size={size}
      d="M6.5 4h3l1.5 4.5-2 1.5a11 11 0 0 0 5.5 5.5l1.5-2 4.5 1.5v3a2 2 0 0 1-2 2A15.5 15.5 0 0 1 4.5 6a2 2 0 0 1 2-2Z"
    />
  );
}

/** Die E-Mail: der Umschlag. */
export function MailIcon({ size = 18 }: { size?: number }) {
  return <WegIcon size={size} d="M3 5.5h18v13H3v-13Z M4 6.5l8 6 8-6" />;
}

/**
 * Die Suche: die Lupe. In der POI-Liste steht sie an der Stelle der
 * Webseite, wenn keine hinterlegt ist (req-097) -- dann fuehrt das Symbol zur
 * Google-Suche.
 */
export function SucheIcon({ size = 18 }: { size?: number }) {
  return (
    <WegIcon
      size={size}
      d="M11 4.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13Z M20 20l-4.4-4.4"
    />
  );
}

/** Gebucht: der Haken (req-097, unter dem Bild der POI-Liste). */
export function HakenIcon({ size = 11 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 12.5l5 5L20 6.5" />
    </svg>
  );
}

/** Noch zu buchen: das Ausrufezeichen (req-097, unter dem Bild der POI-Liste). */
export function AusrufeIcon({ size = 11 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M12 4v10 M12 19.5v.5" />
    </svg>
  );
}

/** Filtern: drei kuerzer werdende Striche (req-098, Kopf der POI-Liste). */
export function FilterIcon({ size = 14 }: { size?: number }) {
  return <WegIcon size={size} d="M3 6h18 M6 12h12 M10 18h4" />;
}

/** Sortieren: der Pfeil nach unten neben gestaffelten Zeilen (req-098). */
export function SortierenIcon({ size = 14 }: { size?: number }) {
  return (
    <WegIcon
      size={size}
      d="M7 4v16 M7 20l-3-3 M7 20l3-3 M13 7h8 M13 12h6 M13 17h4"
    />
  );
}

/** Auswaehlen: das Kaestchen mit Haken (req-098). */
export function AuswaehlenIcon({ size = 14 }: { size?: number }) {
  return (
    <WegIcon
      size={size}
      d="M7 4h10a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3Z M8.5 12.5l2.5 2.5 5-5"
    />
  );
}

/** Der Status fuer mehrere: ein Kreis, wie der Farbpunkt (req-098). */
export function StatusIcon({ size = 14 }: { size?: number }) {
  return <WegIcon size={size} d="M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16Z" />;
}

/** Die Gegend fuer mehrere: zwei Ebenen uebereinander (req-098). */
export function GegendIcon({ size = 14 }: { size?: number }) {
  return <WegIcon size={size} d="M4 7l8-4 8 4-8 4z M4 13l8 4 8-4" />;
}

/** Wegnehmen: das Kreuz am Filter-Chip (req-098). */
export function KreuzIcon({ size = 13 }: { size?: number }) {
  return <WegIcon size={size} d="M6 6l12 12 M18 6L6 18" />;
}

/**
 * Die POI-Auswahl der Planung zuklappen (req-099): der Pfeil zeigt zur Kante,
 * an die sie sich legt.
 */
export function ZuklappenIcon({ size = 14 }: { size?: number }) {
  return <WegIcon size={size} d="M14 6l-6 6 6 6 M19 5v14" />;
}

/** Und wieder aufklappen (req-099): der Pfeil zeigt von der Kante weg. */
export function AufklappenIcon({ size = 14 }: { size?: number }) {
  return <WegIcon size={size} d="M10 6l6 6-6 6 M5 5v14" />;
}

/** Die Dauer eines POI (req-099): eine Uhr. */
export function UhrIcon({ size = 11 }: { size?: number }) {
  return (
    <WegIcon size={size} d="M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16Z M12 8v4l3 2" />
  );
}
