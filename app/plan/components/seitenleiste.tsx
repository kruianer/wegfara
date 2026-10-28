"use client";

import type { ReactElement } from "react";
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
  ChatIcon,
  ConciergeIcon,
  CostsIcon,
  DetailsIcon,
  DocumentsIcon,
  DruckIcon,
  OrteIcon,
  PersonIcon,
  PlanIcon,
  VerwaltungIcon,
} from "@/components/icons";
import { Reisewahl } from "./reisewahl";
import styles from "./seitenleiste.module.css";

/**
 * Der Slogan, der unter dem Namen steht (req-077) -- in Handschrift, wie ein
 * angehefteter Zettel. Er spielt auf den Namen an (wegfara, althochdeutsch
 * fuer "die Reise, das Fortziehen"). Seit req-094 steht er sehr klein unter
 * der Kompassrose und bricht auf zwei Zeilen um.
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
 * Begleiters (bug-034). Dort wie hier steht das Symbol seit req-094 ueber
 * seiner Beschriftung -- nur die Groesse ist eine andere.
 */
export const SYMBOL_GROESSE_PX = 22;

/**
 * Je Bereich ein Symbol (req-077), darunter sein kurzer Name (req-094).
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
  chat: ChatIcon,
  drucken: DruckIcon,
};

/**
 * Symbol oben, Name klein darunter (req-094) -- wie in der unteren Leiste des
 * Begleiters (bug-034).
 *
 * Zu sehen ist der kurze Name. Der volle bleibt der Name des Eintrags: er
 * steht am Eintrag als Tooltip und als `aria-label` fuer Vorleseprogramme --
 * "Stimmen" ist nur die Kurzform in der Leiste, der Bereich heisst weiterhin
 * "Bewertungen".
 */
function EintragInhalt({
  Icon,
  kurz,
}: {
  Icon: SymbolKomponente;
  kurz: string;
}) {
  return (
    <>
      <span className={styles.symbol}>
        <Icon size={SYMBOL_GROESSE_PX} />
      </span>
      <span className={styles.label}>{kurz}</span>
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
 * Sie hat seit req-094 nur eine Form: schmal, mit dem Namen jedes Eintrags
 * klein unter seinem Symbol. Bis dahin klappte sie fuer die Namen auf 320 px
 * auf (req-077, req-078) -- auf dem iPad hochkant (req-088) deckte das fast
 * die halbe Flaeche.
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
  abmelden = true,
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
  /**
   * Der Bereich, der gerade offen ist -- er steht hervorgehoben in der Liste.
   * null heisst: keiner, weil die Seite kein Bereich des Planers ist
   * ("Mein Bereich", "Verwaltung", req-096). Dann ist kein Eintrag
   * hervorgehoben.
   */
  activeArea: PlanAreaId | null;
  /**
   * Ob die angemeldete Person der Gesamt-Admin ist (req-025). Nur bei ihr
   * erscheint die "Verwaltung" (bis req-036 "Account-Verwaltung").
   */
  superAdmin?: boolean;
  /**
   * Ob das Abmelden im Fuss steht. false auf Seiten, die es schon selbst
   * zeigen -- "Mein Bereich" hat es in der Karte "Meine Geraete" (req-096).
   */
  abmelden?: boolean;
  onSelectTrip: (tripId: string) => void;
  onSelectArea: (area: PlanAreaId) => void;
  onCreateTrip: () => void;
  onOpenTripDetails: (trip: Trip) => void;
}) {
  function eintragsKlasse(active: boolean) {
    return `${styles.eintrag} ${active ? styles.active : ""}`;
  }

  return (
    <header className={styles.leiste}>
      {/* Die Marke ist Beschriftung, kein Bedienelement (req-094): Name
          und Slogan stehen sehr klein unter der Kompassrose und duerfen
          unter 44 px bleiben. */}
      <div className={styles.kopf}>
        <span className={styles.logo}>
          <CompassIcon size={22} />
        </span>
        <div className={styles.wordmark}>Wegfara</div>
        <div className={styles.slogan}>{LEISTEN_SLOGAN}</div>
      </div>
      <Reisewahl
        trips={trips}
        selectedTrip={selectedTrip}
        today={today}
        symbolGroesse={SYMBOL_GROESSE_PX}
        onSelectTrip={onSelectTrip}
        onCreateTrip={onCreateTrip}
        onOpenTripDetails={onOpenTripDetails}
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
                aria-label={area.label}
                title={NOCH_NICHT_HINWEIS}
              >
                <EintragInhalt Icon={Icon} kurz={area.kurz} />
              </button>
            );
          }
          return (
            <button
              key={area.id}
              type="button"
              className={eintragsKlasse(active)}
              aria-current={active ? "page" : undefined}
              aria-label={area.label}
              title={area.label}
              onClick={() => onSelectArea(area.id)}
            >
              <EintragInhalt Icon={Icon} kurz={area.kurz} />
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
          aria-label="Begleiter"
          title="Begleiter"
        >
          <EintragInhalt Icon={ConciergeIcon} kurz="Begleiter" />
        </Link>
        {/* Der Reiseplan zum Ausdrucken ist seit req-103 ein Bereich wie
            die uebrigen ("drucken" in PLAN_AREAS) und steht oben in der
            Liste -- der eigene Verweis, der ihn in einem neuen Tab
            oeffnete (req-080), entfaellt; er stuende sonst zweimal da. */}
      </nav>
      {/* Die Einstellungen am Fuss, abgesetzt von der Liste (req-077):
          "Mein Bereich" (req-043) mit Geraeten, Personen, Einladungen und
          Zugangsschluesseln, beim Gesamt-Admin die "Verwaltung" (req-025)
          und das Abmelden. Sie sind der Ort, an dem man den Alltag der App
          verlaesst -- einen Bereich "Einstellungen" hat der Planer nicht
          (er heisst seit req-033 "Reisedetails" und gehoert der Reise). */}
      <nav className={styles.fuss} aria-label="Einstellungen">
        {/* "Mein Bereich" bricht unter dem Symbol auf zwei Zeilen um
            (req-094) -- jedes Wort fuer sich passt in die Leiste. */}
        <Link
          className={styles.eintrag}
          href={MEIN_BEREICH_PATH}
          aria-label="Mein Bereich"
          title="Mein Bereich"
        >
          <EintragInhalt Icon={PersonIcon} kurz="Mein Bereich" />
        </Link>
        {/* Die "Verwaltung" liegt auf einer eigenen Seite (req-025) und
            erscheint nur beim Gesamt-Admin; wer sie ohne die
            Kennzeichnung direkt aufruft, bekommt keinen Zugriff (siehe
            lib/auth/super-admin.ts). */}
        {superAdmin && (
          <Link
            className={styles.eintrag}
            href={ACCOUNTS_PATH}
            aria-label="Verwaltung"
            title="Verwaltung"
          >
            <EintragInhalt Icon={VerwaltungIcon} kurz="Verwaltung" />
          </Link>
        )}
        {/* Auf "Mein Bereich" steht das Abmelden schon in der Karte "Meine
            Geraete" -- zweimal auf einer Seite nicht (bug-033, req-096). */}
        {abmelden && (
          <div className={styles.abmelden}>
            <AbmeldenButton />
            {/* Der Knopf traegt seinen Namen selbst (aria-label); dieser
                Text ist allein zum Lesen da, damit auch unter ihm eine
                Beschriftung steht wie unter den Eintraegen darueber. */}
            <span className={styles.label} aria-hidden="true">
              Abmelden
            </span>
          </div>
        )}
      </nav>
    </header>
  );
}
