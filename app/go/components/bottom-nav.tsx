import styles from "./bottom-nav.module.css";

const ITEMS = [
  { key: "plan", label: "Plan", active: true },
  { key: "map", label: "Karte", active: false },
  { key: "costs", label: "Kosten", active: false },
  { key: "warnings", label: "Meldungen", active: false },
  { key: "concierge", label: "Concierge", active: false },
] as const;

export function BottomNav() {
  return (
    <nav className={styles.nav} aria-label="Bereiche">
      {ITEMS.map((item) =>
        item.active ? (
          <button
            key={item.key}
            type="button"
            className={`${styles.item} ${styles.active}`}
            aria-current="page"
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
