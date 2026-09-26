"use client";

import { useCallback, useEffect, useState, type ReactElement } from "react";
import Link from "next/link";
import type { Trip } from "@/lib/trips/types";
import { ACCOUNTS_PATH } from "@/lib/accounts/paths";
import { MEIN_BEREICH_PATH } from "@/lib/auth/paths";
import { BEGLEITER_PATH } from "@/lib/einstieg/ziel";
import {
  PLAN_AREAS,
  isSwitchablePlanArea,
  type PlanArea,
  type PlanAreaId,
} from "@/lib/plan/areas";
import { NOCH_NICHT_HINWEIS } from "@/components/bereichsleiste";
import { AbmeldenButton } from "@/components/abmelden-button";
import { CompassIcon } from "@/components/compass-icon";
import {
  BewertungenIcon,
  ConciergeIcon,
  CostsIcon,
  DetailsIcon,
  DocumentsIcon,
  OrteIcon,
  PersonIcon,
  PlanIcon,
  VerwaltungIcon,
} from "@/components/icons";
import { Reisewahl } from "./reisewahl";
import styles from "./seitenleiste.module.css";

/**
 * Der Slogan, der aufgeklappt unter dem Namen steht (req-077) -- in
 * Handschrift und leicht schraeg, wie ein angehefteter Zettel. Er spielt auf
 * den Namen an (wegfara, althochdeutsch fuer "die Reise, das Fortziehen").
 *
 * Er tritt neben den Slogan "KI · Reiseplanung" der Anmeldeseite, ohne ihn zu
 * ersetzen: dort erklaert einer einem Fremden, was die App ist -- hier
 * spricht sie zu jemandem, der sie schon benutzt.
 */
export const LEISTEN_SLOGAN = "Wohin es euch zieht";

/** Ein Symbol aus components/icons.tsx -- die Groesse gibt die Leiste vor. */
type SymbolKomponente = (props: { size?: number }) => ReactElement;

/**
 * Die Kantenlaenge der Bereichs-Symbole in Pixeln (req-078) -- dieselbe wie
 * bei LivingGardenTwin, an dem sich die Leiste ausrichtet. Sie steht hier und
 * nicht am Vorgabewert der Symbole: die gelten fuer die untere Leiste des
 * Begleiters (bug-034), wo das Symbol ueber seiner Beschriftung steht und
 * nicht daneben.
 */
export const SYMBOL_GROESSE_PX = 22;

/**
 * Je Bereich ein Symbol (req-077): eingeklappt traegt die Leiste nur sie.
 * Planung, Kosten und Dokumente teilen ihr Zeichen mit der unteren Leiste des
 * Begleiters (bug-034) -- derselbe Bereich soll in beiden Modi gleich
 * aussehen.
 */
const BEREICHS_SYMBOLE: Record<PlanAreaId, SymbolKomponente> = {
  pois: OrteIcon,
  planung: PlanIcon,
  bewertungen: BewertungenIcon,
  kosten: CostsIcon,
  dokumente: DocumentsIcon,
  reisedetails: DetailsIcon,
};

/** Symbol links, Beschriftung daneben -- eingeklappt bleibt nur das Symbol. */
function EintragInhalt({
  Icon,
  label,
}: {
  Icon: SymbolKomponente;
  label: string;
}) {
  return (
    <>
      <span className={styles.symbol}>
        <Icon size={SYMBOL_GROESSE_PX} />
      </span>
      {/* Eingeklappt ist die Beschriftung nur fuer Vorleseprogramme da
          (siehe seitenleiste.module.css) -- zusammen mit dem Tooltip am
          Eintrag ist der Name des Bereichs damit auch ohne Text erreichbar
          (req-077, Constraints). */}
      <span className={styles.label}>{label}</span>
    </>
  );
}

/**
 * Die Seitenleiste des Planers (req-077). Sie tritt an die Stelle der
 * Kopfleiste (bis dahin `components/bereichsleiste.tsx` mit `header.tsx`
 * darum): quer ueber dem Kopf nahm diese Hoehe weg -- Hoehe, die Zeitstrahl
 * und Karte brauchen. Am linken Rand gibt sie sie zurueck, und alle Bereiche
 * sind zugleich sichtbar, ohne zu schieben.
 *
 * Eingeklappt zeigt sie nur Symbole, aufgeklappt die Beschriftungen daneben.
 * Aufgeklappt liegt sie ueber der Seite statt sie beiseitezuschieben -- der
 * Inhalt darunter springt nicht.
 *
 * Nur der Planer hat sie. Der Begleiter (`/go`) behaelt seine untere Leiste:
 * er ist die Sicht fuer unterwegs am Handy, wo eine Leiste am Rand zu viel
 * Breite kostet. "Mein Bereich" und die "Verwaltung" liegen auf eigenen
 * Seiten und behalten die Kopfleiste (bug-033).
 */
export function Seitenleiste({
  trips,
  selectedTrip,
  today,
  areas = PLAN_AREAS,
  activeArea,
  superAdmin = false,
  onSelectTrip,
  onSelectArea,
  onCreateTrip,
  onOpenTripDetails,
}: {
  trips: Trip[];
  selectedTrip: Trip;
  today: Date;
  /** Die Bereiche der geoeffneten Reise (req-009). */
  areas?: PlanArea[];
  activeArea: PlanAreaId;
  /**
   * Ob die angemeldete Person der Gesamt-Admin ist (req-025). Nur bei ihr
   * erscheint die "Verwaltung" (bis req-036 "Account-Verwaltung").
   */
  superAdmin?: boolean;
  onSelectTrip: (tripId: string) => void;
  onSelectArea: (area: PlanAreaId) => void;
  onCreateTrip: () => void;
  onOpenTripDetails: (trip: Trip) => void;
}) {
  // Die Leiste startet bei jedem Laden eingeklappt und merkt sich nichts
  // (req-077): sie ist der Weg irgendwohin, nicht der Ort, an dem man bleibt.
  // Deshalb ein reiner Zustand der Ansicht -- keine Ablage, kein Cookie.
  const [offen, setOffen] = useState(false);

  const schliesse = useCallback(() => setOffen(false), []);

  /**
   * Die Leiste klappt sich beim ersten Anzeichen zu, dass man fertig mit ihr
   * ist (req-077) -- ein gewaehlter Bereich, ein Tipp daneben, Escape. Sie
   * ist der Weg irgendwohin, nicht der Ort, an dem man bleibt.
   *
   * Escape gilt auch, wenn der Finger nirgends hinkommt (Tastatur am iPad,
   * Laptop).
   */
  useEffect(() => {
    if (!offen) return;

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") schliesse();
    }

    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [offen, schliesse]);

  /** Zuklappen und dann tun, wofuer man die Leiste geoeffnet hatte. */
  function mitZugeklappterLeiste<T>(action: (wert: T) => void) {
    return (wert: T) => {
      schliesse();
      action(wert);
    };
  }

  function eintragsKlasse(active: boolean) {
    return `${styles.eintrag} ${active ? styles.active : ""}`;
  }

  return (
    <>
      {/* Ein Tipp daneben klappt die Leiste zu -- und oeffnet nichts unter
          dem Finger (req-077): die Flaeche liegt ueber der Seite und faengt
          den Griff ab, statt ihn durchzulassen. Das ist der Unterschied zum
          Aufklappmenue der Reisen, das ihn bewusst weiterreicht (bug-018):
          dort trifft man einen Knopf, hier bloss "daneben". */}
      {offen && (
        <div
          className={styles.davor}
          data-testid="leiste-davor"
          aria-hidden="true"
          onPointerDown={schliesse}
        />
      )}
      {/* Die Spur haelt nur die Breite der eingeklappten Leiste frei; die
          Tafel darauf waechst beim Aufklappen darueber hinaus, ohne den
          Inhalt daneben zu verschieben (req-077). */}
      <div className={`${styles.spur} ${offen ? styles.offen : ""}`}>
        <header className={styles.tafel}>
          <div className={styles.kopf}>
            <button
              type="button"
              className={styles.schalter}
              aria-expanded={offen}
              aria-label={offen ? "Bereiche einklappen" : "Bereiche aufklappen"}
              title={offen ? "Bereiche einklappen" : "Bereiche aufklappen"}
              onClick={() => setOffen((auf) => !auf)}
            >
              <span className={styles.logo}>
                <CompassIcon size={22} />
              </span>
            </button>
            <div className={styles.marke}>
              <div className={styles.wordmark}>Wegfara</div>
              <div className={styles.slogan}>{LEISTEN_SLOGAN}</div>
            </div>
          </div>
          {/* Auch eine gewaehlte Reise heisst: fertig mit der Leiste. */}
          <Reisewahl
            trips={trips}
            selectedTrip={selectedTrip}
            today={today}
            offen={offen}
            onSelectTrip={mitZugeklappterLeiste(onSelectTrip)}
            onCreateTrip={() => {
              schliesse();
              onCreateTrip();
            }}
            onOpenTripDetails={mitZugeklappterLeiste(onOpenTripDetails)}
          />
          <nav className={styles.nav} aria-label="Bereiche">
            {areas.map((area) => {
              const active = area.id === activeArea;
              const Icon = BEREICHS_SYMBOLE[area.id];
              // Ein noch nicht gebauter Bereich steht sichtbar, aber
              // abgeschaltet in der Leiste, statt das Tippen wortlos zu
              // schlucken (bug-033). Derzeit gibt es keinen solchen; der
              // naechste neue steht wieder hier, bevor es ihn gibt.
              if (!isSwitchablePlanArea(area.id)) {
                return (
                  <button
                    key={area.id}
                    type="button"
                    className={styles.eintrag}
                    disabled
                    title={NOCH_NICHT_HINWEIS}
                  >
                    <EintragInhalt Icon={Icon} label={area.label} />
                  </button>
                );
              }
              return (
                <button
                  key={area.id}
                  type="button"
                  className={eintragsKlasse(active)}
                  aria-current={active ? "page" : undefined}
                  title={area.label}
                  onClick={() => {
                    schliesse();
                    onSelectArea(area.id);
                  }}
                >
                  <EintragInhalt Icon={Icon} label={area.label} />
                </button>
              );
            })}
            {/* Der Wechsel in den Begleiter (req-055). Er steht jedem offen:
              den Begleiter darf jeder -- und er ist der Alltag der App
              unterwegs, kein Ausstieg aus ihr. Deshalb steht er in der
              Liste und nicht am Fuss. */}
            <Link
              className={styles.eintrag}
              href={BEGLEITER_PATH}
              title="Begleiter"
            >
              <EintragInhalt Icon={ConciergeIcon} label="Begleiter" />
            </Link>
          </nav>
          {/* Die Einstellungen am Fuss, abgesetzt von der Liste (req-077):
            "Mein Bereich" (req-043) mit Geraeten, Personen, Einladungen und
            Zugangsschluesseln, beim Gesamt-Admin die "Verwaltung" (req-025)
            und das Abmelden. Sie sind der Ort, an dem man den Alltag der App
            verlaesst -- einen Bereich "Einstellungen" hat der Planer nicht
            (er heisst seit req-033 "Reisedetails" und gehoert der Reise). */}
          <nav className={styles.fuss} aria-label="Einstellungen">
            <Link
              className={styles.eintrag}
              href={MEIN_BEREICH_PATH}
              title="Mein Bereich"
            >
              <EintragInhalt Icon={PersonIcon} label="Mein Bereich" />
            </Link>
            {/* Die "Verwaltung" liegt auf einer eigenen Seite (req-025) und
              erscheint nur beim Gesamt-Admin; wer sie ohne die
              Kennzeichnung direkt aufruft, bekommt keinen Zugriff (siehe
              lib/auth/super-admin.ts). */}
            {superAdmin && (
              <Link
                className={styles.eintrag}
                href={ACCOUNTS_PATH}
                title="Verwaltung"
              >
                <EintragInhalt Icon={VerwaltungIcon} label="Verwaltung" />
              </Link>
            )}
            <div className={styles.abmelden}>
              <AbmeldenButton />
              {/* Der Knopf traegt seinen Namen selbst (aria-label); dieser
                Text ist allein zum Lesen da, damit aufgeklappt auch neben
                ihm eine Beschriftung steht. */}
              <span className={styles.label} aria-hidden="true">
                Abmelden
              </span>
            </div>
          </nav>
        </header>
      </div>
    </>
  );
}
