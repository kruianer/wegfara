import styles from "./bottom-nav.module.css";

export type Tab = "plan" | "map";

const ITEMS: Array<
  | { key: Tab; label: string; enabled: true }
  | { key: string; label: string; enabled: false }
> = [
  { key: "plan", label: "Plan", enabled: true },
  { key: "map", label: "Karte", enabled: true },
  { key: "costs", label: "Kosten", enabled: false },
  { key: "warnings", label: "Meldungen", enabled: false },
  { key: "concierge", label: "Concierge", enabled: false },
];

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
