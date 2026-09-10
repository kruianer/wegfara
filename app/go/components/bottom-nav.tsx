import type { ReactElement, ReactNode } from "react";
import {
  ConciergeIcon,
  CostsIcon,
  DocumentsIcon,
  MapIcon,
  PlanIcon,
  WarningsIcon,
} from "@/components/icons";
import styles from "./bottom-nav.module.css";

export type Tab = "plan" | "map" | "costs" | "documents";

/** Ein Symbol aus components/icons.tsx -- die Groesse gibt es vor. */
type SymbolKomponente = (props: { size?: number }) => ReactElement;

/**
 * Jeder Eintrag traegt sein Symbol ueber der Beschriftung (bug-034): auf dem
 * Smartphone ist diese Leiste das Hauptnavigationsmittel -- ein Symbol findet
 * man im Vorbeigehen, Text muss man lesen. Auch die noch abgeschalteten
 * Eintraege tragen eines, sonst faellt die Leiste beim Freischalten neu um.
 */
const ITEMS: Array<
  | { key: Tab; label: string; Icon: SymbolKomponente; enabled: true }
  | { key: string; label: string; Icon: SymbolKomponente; enabled: false }
> = [
  { key: "plan", label: "Plan", Icon: PlanIcon, enabled: true },
  { key: "map", label: "Karte", Icon: MapIcon, enabled: true },
  { key: "costs", label: "Kosten", Icon: CostsIcon, enabled: true },
  // Unterwegs abgelegte Tickets und Buchungen (req-034).
  { key: "documents", label: "Dokumente", Icon: DocumentsIcon, enabled: true },
  { key: "warnings", label: "Meldungen", Icon: WarningsIcon, enabled: false },
  { key: "concierge", label: "Concierge", Icon: ConciergeIcon, enabled: false },
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
}: {
  activeTab: Tab;
  onSelectTab: (tab: Tab) => void;
}) {
  return (
    <nav className={styles.nav} aria-label="Bereiche">
      {ITEMS.map((item) =>
        item.enabled ? (
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
        ) : (
          <button key={item.key} type="button" className={styles.item} disabled>
            <ItemInhalt Icon={item.Icon} label={item.label} />
          </button>
        ),
      )}
    </nav>
  );
}
