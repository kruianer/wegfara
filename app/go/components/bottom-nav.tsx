import styles from "./bottom-nav.module.css";

export type Tab = "plan" | "map" | "costs" | "documents";

const ITEMS: Array<
  | { key: Tab; label: string; enabled: true }
  | { key: string; label: string; enabled: false }
> = [
  { key: "plan", label: "Plan", enabled: true },
  { key: "map", label: "Karte", enabled: true },
  { key: "costs", label: "Kosten", enabled: true },
  // Unterwegs abgelegte Tickets und Buchungen (req-034).
  { key: "documents", label: "Dokumente", enabled: true },
  { key: "warnings", label: "Meldungen", enabled: false },
  { key: "concierge", label: "Concierge", enabled: false },
];

/**
 * Ein Gast sieht nur, was er sehen darf (req-038): Plan und Karte. Kosten
 * und Dokumente erscheinen bei ihm gar nicht -- und die Schnittstellen
 * dahinter weisen ihn ohnehin ab.
 */
const GUEST_TABS: string[] = ["plan", "map"];

export function BottomNav({
  activeTab,
  onSelectTab,
  guest = false,
}: {
  activeTab: Tab;
  onSelectTab: (tab: Tab) => void;
  guest?: boolean;
}) {
  const items = guest
    ? ITEMS.filter((item) => GUEST_TABS.includes(item.key))
    : ITEMS;

  return (
    <nav className={styles.nav} aria-label="Bereiche">
      {items.map((item) =>
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
            {item.label}
          </button>
        ) : (
          <button key={item.key} type="button" className={styles.item} disabled>
            {item.label}
          </button>
        ),
      )}
    </nav>
  );
}
