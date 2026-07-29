import type { Theme, ThemeId } from "@/lib/theme/types";
import styles from "./theme-sheet.module.css";

export function ThemeSheet({
  themes,
  activeThemeId,
  onSelect,
  onClose,
}: {
  themes: Theme[];
  activeThemeId: ThemeId;
  onSelect: (id: ThemeId) => void;
  onClose: () => void;
}) {
  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.frame}>
        <div
          className={styles.sheet}
          role="dialog"
          aria-label="Farbwelt wählen"
          onClick={(e) => e.stopPropagation()}
        >
          <ul className={styles.list}>
            {themes.map((theme) => {
              const active = theme.id === activeThemeId;
              return (
                <li key={theme.id}>
                  <button
                    type="button"
                    className={styles.item}
                    aria-current={active}
                    onClick={() => onSelect(theme.id)}
                  >
                    <span className={styles.swatches} aria-hidden="true">
                      {theme.swatches.map((color, index) => (
                        <span
                          key={index}
                          data-testid="theme-swatch"
                          className={styles.swatch}
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </span>
                    <span className={styles.name}>{theme.name}</span>
                    {active && (
                      <span className={styles.check} aria-hidden="true">
                        ✓
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}
