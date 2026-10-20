import type { ReactElement, ReactNode } from "react";
import {
  CostsIcon,
  DocumentsIcon,
  MapIcon,
  MoreIcon,
  PlanIcon,
} from "@/components/icons";
import styles from "./bottom-nav.module.css";

export type Tab = "plan" | "map" | "costs" | "documents";

/** Ein Symbol aus components/icons.tsx -- die Groesse gibt es vor. */
type SymbolKomponente = (props: { size?: number }) => ReactElement;

/**
 * Jeder Eintrag traegt sein Symbol ueber der Beschriftung (bug-034): auf dem
 * Smartphone ist diese Leiste das Hauptnavigationsmittel -- ein Symbol findet
 * man im Vorbeigehen, Text muss man lesen.
 *
 * "Meldungen" und "Concierge" stehen seit bug-063 nicht mehr hier, sondern
 * unter "Mehr": die Leiste hatte mit ihnen sechs Eintraege und damit zu wenig
 * Trefferflaeche je Eintrag auf 375 px.
 */
const ITEMS: Array<{ key: Tab; label: string; Icon: SymbolKomponente }> = [
  { key: "plan", label: "Plan", Icon: PlanIcon },
  { key: "map", label: "Karte", Icon: MapIcon },
  { key: "costs", label: "Kosten", Icon: CostsIcon },
  // Unterwegs abgelegte Tickets und Buchungen (req-034).
  { key: "documents", label: "Dokumente", Icon: DocumentsIcon },
];

/**
 * Symbol ueber Beschriftung. Das Symbol ist aria-hidden (siehe
 * components/icons.tsx) -- der Knopf heisst weiterhin schlicht nach seinem
 * Bereich.
 */
function ItemInhalt({
  Icon,
  label,
}: {
  Icon: SymbolKomponente;
  label: string;
}): ReactNode {
  return (
    <>
      <span className={styles.icon}>
        <Icon />
      </span>
      <span className={styles.label}>{label}</span>
    </>
  );
}

export function BottomNav({
  activeTab,
  onSelectTab,
  onOpenMore,
}: {
  activeTab: Tab;
  onSelectTab: (tab: Tab) => void;
  /** Oeffnet die Auswahl mit den Wegen, die hier keinen Platz mehr haben (bug-063). */
  onOpenMore: () => void;
}) {
  return (
    <nav className={styles.nav} aria-label="Bereiche">
      {ITEMS.map((item) => (
        <button
          key={item.key}
          type="button"
          className={`${styles.item} ${
            item.key === activeTab ? styles.active : ""
          }`}
          aria-current={item.key === activeTab ? "page" : undefined}
          onClick={() => onSelectTab(item.key)}
        >
          <ItemInhalt Icon={item.Icon} label={item.label} />
        </button>
      ))}
      <button type="button" className={styles.item} onClick={onOpenMore}>
        <ItemInhalt Icon={MoreIcon} label="Mehr" />
      </button>
    </nav>
  );
}
