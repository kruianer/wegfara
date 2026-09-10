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
