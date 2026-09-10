"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ACCOUNTS_PATH } from "@/lib/accounts/paths";
import { MEIN_BEREICH_PATH } from "@/lib/auth/paths";
import { BEGLEITER_PATH } from "@/lib/einstieg/ziel";
import {
  PLAN_AREAS,
  isSwitchablePlanArea,
  planAreaPath,
  type PlanArea,
  type PlanAreaId,
} from "@/lib/plan/areas";
import { AbmeldenButton } from "./abmelden-button";
import { CompassIcon } from "./compass-icon";
import styles from "./bereichsleiste.module.css";

/**
 * Wo die Leiste gerade steht. Neben den Bereichen der Reise sind das die
 * drei Seiten, die keiner Reise gehoeren.
 */
export type LeistenZiel =
  | PlanAreaId
  | "begleiter"
  | "mein-bereich"
  | "verwaltung";

/** Was an einem noch nicht gebauten Bereich steht, statt ihn stumm zu schlucken. */
export const NOCH_NICHT_HINWEIS = "Dieser Bereich ist noch nicht fertig.";

/**
 * Die Bereichsleiste (bug-033): eine Kopfleiste, die auf jeder Seite gleich
 * aussieht und dieselben Ziele anbietet -- die Bereiche der geoeffneten
 * Reise, den Begleiter, "Mein Bereich" und beim Gesamt-Admin die
 * "Verwaltung".
 *
 * Vorher hatte jede Seite ihren eigenen Ausgang oder gar keinen: "Mein
 * Bereich" fuehrte allein auf die Hauptadresse, die seit req-055 je nach
 * Lage irgendwohin weiterleitet, und die "Verwaltung" allein zurueck in den
 * Planer. Aus beiden kam man nirgendwo gezielt hin.
 *
 * Im Planer wechseln die Bereiche den Zustand (`onSelectArea`) -- daneben
 * liegt kein Planer, deshalb fuehren sie dort als Verweis an die Adresse des
 * Planers, die den Bereich gleich vorwaehlt (siehe lib/plan/areas.ts).
 */
export function Bereichsleiste({
  aktiv,
  areas = PLAN_AREAS,
  planerBereiche = true,
  superAdmin = false,
  abmelden = true,
  onSelectArea,
  children,
}: {
  aktiv: LeistenZiel;
  /** Die Bereiche der geoeffneten Reise (req-009). */
  areas?: PlanArea[];
  /**
   * Ob die Bereiche des Planers ueberhaupt erscheinen. Wer den Planer nicht
   * darf (req-055), bekaeme sonst Wege angeboten, die ihn ohne Meldung
   * gleich wieder in den Begleiter zuruecklegen.
   */
  planerBereiche?: boolean;
  /** Nur der Gesamt-Admin sieht die "Verwaltung" (req-025, req-036). */
  superAdmin?: boolean;
  /**
   * Ob das Abmelden am rechten Rand steht. In "Mein Bereich" steht es schon
   * in der Karte "Meine Geraete" (req-043) -- zweimal braucht es niemand.
   */
  abmelden?: boolean;
  /**
   * Im Planer wechselt ein Bereich nur den Zustand. Fehlt der Rueckruf,
   * fuehren die Bereiche als Verweis in den Planer.
   */
  onSelectArea?: (area: PlanAreaId) => void;
  /** Was zwischen Bereichen und Abmelden steht -- im Planer die Reisewahl. */
  children?: ReactNode;
}) {
  function klasse(active: boolean) {
    return `${styles.navButton} ${active ? styles.active : ""}`;
  }

  return (
    <header className={styles.leiste}>
      <div className={styles.brand}>
        <span className={styles.logo}>
          <CompassIcon size={22} />
        </span>
        <div>
          <div className={styles.wordmark}>Wegfara</div>
          <div className={styles.tagline}>KI · Reiseplanung</div>
        </div>
      </div>
      <nav className={styles.nav} aria-label="Bereiche">
        {planerBereiche &&
          areas.map((area) => {
            const active = area.id === aktiv;
            // Bewertungen und Kosten gibt es im Planer noch nicht (siehe
            // SWITCHABLE_PLAN_AREAS). Sie stehen sichtbar, aber abgeschaltet
            // in der Leiste -- so wie die leeren Bereiche des Begleiters.
            if (!isSwitchablePlanArea(area.id)) {
              return (
                <button
                  key={area.id}
                  type="button"
                  className={styles.navButton}
                  disabled
                  title={NOCH_NICHT_HINWEIS}
                >
                  {area.label}
                </button>
              );
            }
            return onSelectArea ? (
              <button
                key={area.id}
                type="button"
                className={klasse(active)}
                aria-current={active ? "page" : undefined}
                onClick={() => onSelectArea(area.id)}
              >
                {area.label}
              </button>
            ) : (
              <Link
                key={area.id}
                className={klasse(active)}
                href={planAreaPath(area.id)}
                aria-current={active ? "page" : undefined}
              >
                {area.label}
              </Link>
            );
          })}
        {/* Der Wechsel in den Begleiter (req-055). Er steht jedem offen: den
            Begleiter darf jeder. */}
        <Link
          className={klasse(aktiv === "begleiter")}
          href={BEGLEITER_PATH}
          aria-current={aktiv === "begleiter" ? "page" : undefined}
        >
          Begleiter
        </Link>
        {/* "Mein Bereich" steht neben den Bereichen der Reise, ist aber
            keiner von ihnen (req-043): er gehoert der angemeldeten Person
            und ihrem Account und liegt auf einer eigenen Seite. Jede
            angemeldete Person sieht ihn -- was sie darin zu sehen bekommt,
            entscheidet die Seite selbst. */}
        <Link
          className={klasse(aktiv === "mein-bereich")}
          href={MEIN_BEREICH_PATH}
          aria-current={aktiv === "mein-bereich" ? "page" : undefined}
        >
          Mein Bereich
        </Link>
        {/* Die "Verwaltung" ist ein eigener Bereich mit eigener Adresse
            (req-025) -- sie liegt nicht im Planer-Zustand, sondern auf einer
            eigenen Seite. Sie erscheint nur beim Gesamt-Admin; wer sie ohne
            die Kennzeichnung direkt aufruft, bekommt keinen Zugriff (siehe
            lib/auth/super-admin.ts). Die Adresse traegt weiterhin
            "accounts" -- umbenannt wurde mit req-036 nur die Beschriftung. */}
        {superAdmin && (
          <Link
            className={klasse(aktiv === "verwaltung")}
            href={ACCOUNTS_PATH}
            aria-current={aktiv === "verwaltung" ? "page" : undefined}
          >
            Verwaltung
          </Link>
        )}
      </nav>
      {children}
      {abmelden && <AbmeldenButton />}
    </header>
  );
}
