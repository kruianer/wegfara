"use client";

import { useEffect } from "react";
import Link from "next/link";
import type { Theme, ThemeId } from "@/lib/theme/types";
import { PLANER_PATH } from "@/lib/einstieg/ziel";
import { MEIN_BEREICH_PATH } from "@/lib/auth/paths";
import { NOCH_NICHT_HINWEIS } from "@/components/bereichsleiste";
import { AbmeldenButton } from "@/components/abmelden-button";
import {
  ConciergeIcon,
  MitreisendeIcon,
  PersonIcon,
  WarningsIcon,
} from "@/components/icons";
import styles from "./mehr-sheet.module.css";

function PlanerIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 9h18M9 9v11" />
    </svg>
  );
}

/**
 * Die Auswahl hinter "Mehr" (bug-063): die Wege, die vorher die Kopfzeile des
 * Begleiters ueberfuellten -- Wechsel in den Planer, Themenwahl, "Mein
 * Bereich" und "Abmelden" --, fuer Reiseleiter und Account-Admin "Wer faehrt
 * mit" (req-087), plus die noch nicht gebauten Bereiche
 * "Meldungen" und "Concierge", sichtbar aber abgeschaltet (bug-033).
 *
 * Die Themenwahl steht hier eingebettet statt in einem eigenen Blatt: ein
 * Blatt aus einem Blatt waere eine Ebene zu viel.
 *
 * Schliesst sich wie die Seitenleiste des Planers (req-077): beim Waehlen
 * eines Eintrags, bei einem Tipp daneben und mit Escape.
 */
export function MehrSheet({
  zeigtWechsel,
  mitreisendeHref = null,
  themes,
  activeThemeId,
  onSelectTheme,
  onClose,
}: {
  /** "Zum Planer" steht nur, wer den Planer darf und breit genug sieht (bug-035). */
  zeigtWechsel: boolean;
  /**
   * Wohin "Wer faehrt mit" fuehrt (req-087) -- null fuer alle, die die
   * Mitreisenden der geoeffneten Reise nicht bearbeiten duerfen: sie sehen
   * den Eintrag gar nicht.
   */
  mitreisendeHref?: string | null;
  themes: Theme[];
  activeThemeId: ThemeId;
  onSelectTheme: (id: ThemeId) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.frame}>
        <div
          className={styles.sheet}
          role="dialog"
          aria-label="Mehr"
          onClick={(e) => e.stopPropagation()}
        >
          <ul className={styles.list}>
            {zeigtWechsel && (
              <li>
                <Link
                  className={styles.item}
                  href={PLANER_PATH}
                  onClick={onClose}
                >
                  <span className={styles.icon}>
                    <PlanerIcon />
                  </span>
                  <span className={styles.label}>Zum Planer</span>
                </Link>
              </li>
            )}
            {mitreisendeHref && (
              <li>
                <Link
                  className={styles.item}
                  href={mitreisendeHref}
                  onClick={onClose}
                >
                  <span className={styles.icon}>
                    <MitreisendeIcon size={20} />
                  </span>
                  <span className={styles.label}>Wer fährt mit</span>
                </Link>
              </li>
            )}
            <li className={styles.themeEntry}>
              <span className={styles.sectionLabel}>Themenwahl</span>
              <ul className={styles.swatchList}>
                {themes.map((theme) => {
                  const active = theme.id === activeThemeId;
                  return (
                    <li key={theme.id}>
                      <button
                        type="button"
                        className={styles.themeItem}
                        aria-current={active}
                        onClick={() => {
                          onSelectTheme(theme.id);
                          onClose();
                        }}
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
                        <span className={styles.themeName}>{theme.name}</span>
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
            </li>
            <li>
              <Link
                className={styles.item}
                href={MEIN_BEREICH_PATH}
                onClick={onClose}
              >
                <span className={styles.icon}>
                  <PersonIcon size={20} />
                </span>
                <span className={styles.label}>Mein Bereich</span>
              </Link>
            </li>
            <li>
              {/* AbmeldenButton navigiert nach dem Abmelden selbst weg --
                  das Schliessen hier ist nur fuer den Fall, dass das nicht
                  sofort geschieht. */}
              <div className={styles.item} onClick={onClose}>
                <AbmeldenButton />
                <span className={styles.label}>Abmelden</span>
              </div>
            </li>
            <li>
              <button
                type="button"
                className={styles.item}
                disabled
                title={NOCH_NICHT_HINWEIS}
              >
                <span className={styles.icon}>
                  <WarningsIcon size={20} />
                </span>
                <span className={styles.label}>Meldungen</span>
              </button>
            </li>
            <li>
              <button
                type="button"
                className={styles.item}
                disabled
                title={NOCH_NICHT_HINWEIS}
              >
                <span className={styles.icon}>
                  <ConciergeIcon size={20} />
                </span>
                <span className={styles.label}>Concierge</span>
              </button>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
