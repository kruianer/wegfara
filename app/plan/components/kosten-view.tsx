"use client";

import { useMemo, useState } from "react";
import type { Trip } from "@/lib/trips/types";
import type { Poi, PoiBuchung } from "@/lib/pois/types";
import type { Activity } from "@/lib/activities/types";
import type { GespeicherteKostenzeile, Kostenzeile } from "@/lib/kosten/types";
import { kostenzeilen } from "@/lib/kosten/zeilen";
import { kostenSummen } from "@/lib/kosten/summen";
import {
  createKostenzeile,
  removeKostenzeile,
  saveKostenzeile,
  type NeueZeile,
  type Zeilenziel,
} from "@/lib/kosten/save-zeile";
import { KOSTEN_ANZAHL_MAX, parseAnzahl } from "@/lib/kosten/anzahl";
import {
  bezeichnungProblem,
  KOSTEN_BEZEICHNUNG_MAX_LENGTH,
} from "@/lib/kosten/validate";
import {
  POI_BUCHUNGEN,
  POI_BUCHUNG_LABEL,
  VORGEGEBENE_BUCHUNG,
} from "@/lib/pois/buchung";
import { formatKosten, parseKosten } from "@/lib/pois/kosten";
import { TrashIcon } from "@/components/icons";
import styles from "./kosten-view.module.css";

/** Ein Betrag in Cent, wie er in der Tabelle steht: „12,50 €". */
function betrag(cent: number | null): string {
  return cent === null ? "—" : `${formatKosten(cent)} €`;
}

/** Der Preis einer Zeile als Eingabe: „12,50"; leer heisst "nicht eingetragen". */
function preisEingabe(cent: number | null): string {
  return cent === null ? "" : formatKosten(cent);
}

/** Welche Zeile beim Speichern gemeint ist (siehe lib/kosten/save-zeile.ts). */
function ziel(zeile: Kostenzeile): Zeilenziel {
  return zeile.activityId ? { activityId: zeile.activityId } : { id: zeile.id };
}

const PREIS_UNGUELTIG =
  "Der Preis muss ein Betrag in Euro sein, zum Beispiel 12,50.";
const ANZAHL_UNGUELTIG = `Die Anzahl muss eine ganze Zahl sein, hoechstens ${KOSTEN_ANZAHL_MAX}.`;
const NICHT_GESPEICHERT = "Das konnte nicht gespeichert werden.";
const NICHT_ENTFERNT = "Die Zeile konnte nicht entfernt werden.";

/** Eine leere manuelle Zeile -- die Anzahl mit der Teilnehmerzahl vorbelegt. */
function leereZeile(teilnehmerzahl: number): NeueZeile {
  return {
    bezeichnung: "",
    preis: "",
    anzahl: String(teilnehmerzahl),
    buchung: VORGEGEBENE_BUCHUNG,
  };
}

/**
 * Der Bereich "Kosten" des Planers (req-062): die Kostenplanung einer Reise
 * -- was sie kosten wird, insgesamt und je Person.
 *
 * Je Programmpunkt eine Zeile, automatisch aus dem Zeitstrahl. Preis und
 * Buchungsstatus stehen am POI (req-061); hier werden sie angezeigt und
 * geaendert und fliessen in den POI zurueck -- es gibt eine Wahrheit, an
 * zwei Stellen bedienbar. Eine zweite Kopie haelt die Tabelle nicht.
 *
 * Die Kostenplanung ist die Kalkulation **vorher**; die Ausgaben (req-029)
 * im Begleiter bleiben davon getrennt -- sie erfassen, was unterwegs
 * tatsaechlich gezahlt wurde.
 */
export function KostenView({
  trip,
  activities,
  pois,
  gespeicherte,
  teilnehmerzahl,
  onPoiChanged,
  onZeileGespeichert,
  onZeileEntfernt,
}: {
  trip: Trip;
  /** Die Programmpunkte der geoeffneten Reise. */
  activities: Activity[];
  /** Die POIs der geoeffneten Reise -- an ihnen stehen Preis und Buchung. */
  pois: Poi[];
  /** Was zu den Zeilen dieser Reise gespeichert ist. */
  gespeicherte: GespeicherteKostenzeile[];
  /** Wie viele Personen mitfahren -- die Vorbelegung der Anzahl. */
  teilnehmerzahl: number;
  /** Ein geaenderter POI -- er steht danach auch im Bereich POIs richtig. */
  onPoiChanged: (poi: Poi) => void;
  /** Eine gespeicherte Zeile (Programmpunkt ohne POI oder manuelle Zeile). */
  onZeileGespeichert: (zeile: GespeicherteKostenzeile) => void;
  /** Eine entfernte manuelle Zeile -- sie ist bereits geloescht. */
  onZeileEntfernt: (id: string) => void;
}) {
  const zeilen = useMemo(
    () =>
      kostenzeilen({ trip, activities, pois, gespeicherte, teilnehmerzahl }),
    [trip, activities, pois, gespeicherte, teilnehmerzahl],
  );
  // Was gerade in einem Feld steht, solange es bearbeitet wird. Nach dem
  // Speichern faellt die Zeile wieder auf den gespeicherten Stand zurueck.
  const [entwuerfe, setEntwuerfe] = useState<Record<string, string>>({});
  const [anzahlEntwuerfe, setAnzahlEntwuerfe] = useState<
    Record<string, string>
  >({});
  const [bezeichnungEntwuerfe, setBezeichnungEntwuerfe] = useState<
    Record<string, string>
  >({});
  const summen = useMemo(
    () => kostenSummen(zeilen, teilnehmerzahl),
    [zeilen, teilnehmerzahl],
  );
  const [problem, setProblem] = useState<string | null>(null);
  // Das Formular fuer eine manuelle Zeile -- solange es offen ist, ist die
  // Zeile nur diese Absicht: erst das Speichern legt sie an.
  const [anlegen, setAnlegen] = useState(false);
  const [neu, setNeu] = useState<NeueZeile>(() => leereZeile(teilnehmerzahl));
  const [anzahlBeruehrt, setAnzahlBeruehrt] = useState(false);

  function ohne(
    setzen: (
      aendern: (current: Record<string, string>) => Record<string, string>,
    ) => void,
    zeilenId: string,
  ) {
    setzen((current) => {
      if (!(zeilenId in current)) return current;
      const rest = { ...current };
      delete rest[zeilenId];
      return rest;
    });
  }

  function vergiss(zeilenId: string) {
    ohne(setEntwuerfe, zeilenId);
  }

  function vergissAnzahl(zeilenId: string) {
    ohne(setAnzahlEntwuerfe, zeilenId);
  }

  async function speicherePreis(zeile: Kostenzeile, eingabe: string) {
    const gelesen = parseKosten(eingabe);
    if (gelesen === "ungueltig") {
      setProblem(PREIS_UNGUELTIG);
      return;
    }
    // Unveraendert: kein Schreibvorgang, keine Meldung.
    if (gelesen === zeile.preisCent) {
      vergiss(zeile.id);
      setProblem(null);
      return;
    }

    const antwort = await saveKostenzeile(ziel(zeile), { preis: eingabe });
    if (!antwort) {
      setProblem(NICHT_GESPEICHERT);
      return;
    }
    setProblem(null);
    vergiss(zeile.id);
    if (antwort.poi) onPoiChanged(antwort.poi);
    if (antwort.zeile) onZeileGespeichert(antwort.zeile);
  }

  async function speichereAnzahl(zeile: Kostenzeile, eingabe: string) {
    const gelesen = parseAnzahl(eingabe);
    if (gelesen === "ungueltig") {
      setProblem(ANZAHL_UNGUELTIG);
      return;
    }
    // Unveraendert: kein Schreibvorgang, keine Meldung. Eine leere Eingabe
    // nimmt der Zeile ihre eigene Anzahl -- sie zieht danach wieder mit der
    // Teilnehmerzahl nach und ist deshalb nie "unveraendert".
    if (gelesen !== null && gelesen === zeile.anzahl) {
      vergissAnzahl(zeile.id);
      setProblem(null);
      return;
    }

    const antwort = await saveKostenzeile(ziel(zeile), { anzahl: eingabe });
    if (!antwort) {
      setProblem(NICHT_GESPEICHERT);
      return;
    }
    setProblem(null);
    vergissAnzahl(zeile.id);
    if (antwort.zeile) onZeileGespeichert(antwort.zeile);
  }

  async function speichereBezeichnung(zeile: Kostenzeile, eingabe: string) {
    const gefunden = bezeichnungProblem(eingabe);
    if (gefunden) {
      setProblem(gefunden);
      return;
    }
    if (eingabe.trim() === zeile.bezeichnung) {
      ohne(setBezeichnungEntwuerfe, zeile.id);
      setProblem(null);
      return;
    }

    const antwort = await saveKostenzeile(ziel(zeile), {
      bezeichnung: eingabe.trim(),
    });
    if (!antwort) {
      setProblem(NICHT_GESPEICHERT);
      return;
    }
    setProblem(null);
    ohne(setBezeichnungEntwuerfe, zeile.id);
    if (antwort.zeile) onZeileGespeichert(antwort.zeile);
  }

  async function speichereBuchung(zeile: Kostenzeile, buchung: PoiBuchung) {
    const antwort = await saveKostenzeile(ziel(zeile), { buchung });
    if (!antwort) {
      setProblem(NICHT_GESPEICHERT);
      return;
    }
    setProblem(null);
    if (antwort.poi) onPoiChanged(antwort.poi);
    if (antwort.zeile) onZeileGespeichert(antwort.zeile);
  }

  /** Legt die manuelle Zeile an (req-062) -- gerechnet wird sie danach mit. */
  async function lege() {
    const gefunden = bezeichnungProblem(neu.bezeichnung);
    if (gefunden) {
      setProblem(gefunden);
      return;
    }
    if (parseKosten(neu.preis) === "ungueltig") {
      setProblem(PREIS_UNGUELTIG);
      return;
    }
    if (parseAnzahl(neu.anzahl) === "ungueltig") {
      setProblem(ANZAHL_UNGUELTIG);
      return;
    }

    const gespeichert = await createKostenzeile(trip.id, {
      ...neu,
      bezeichnung: neu.bezeichnung.trim(),
      // Unberuehrt bleibt die Anzahl leer: die Zeile zieht dann mit der
      // Teilnehmerzahl nach (req-062).
      anzahl: anzahlBeruehrt ? neu.anzahl : "",
    });
    if (!gespeichert) {
      setProblem(NICHT_GESPEICHERT);
      return;
    }
    setProblem(null);
    setAnlegen(false);
    onZeileGespeichert(gespeichert);
  }

  /** Entfernt eine manuelle Zeile (req-062). */
  async function entferne(zeile: Kostenzeile) {
    if (!(await removeKostenzeile(zeile.id))) {
      setProblem(NICHT_ENTFERNT);
      return;
    }
    setProblem(null);
    onZeileEntfernt(zeile.id);
  }

  return (
    <section className={styles.area} aria-label="Kosten">
      <div className={styles.head}>
        <h2 className={styles.title}>Kosten</h2>
        {/* Fuer alles ohne Programmpunkt -- Maut, Parkgebuehren, Sprit
            (req-062). */}
        <button
          type="button"
          className={styles.primaryButton}
          onClick={() => {
            setNeu(leereZeile(teilnehmerzahl));
            setAnzahlBeruehrt(false);
            setAnlegen(true);
          }}
        >
          Zeile hinzufügen
        </button>
      </div>
      {problem && (
        <p className={styles.error} role="alert" data-testid="kosten-hinweis">
          {problem}
        </p>
      )}
      {zeilen.length === 0 ? (
        <p className={styles.empty}>Noch keine Kosten erfasst.</p>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table} aria-label="Kostenplanung">
            <thead>
              <tr>
                <th scope="col">Bezeichnung</th>
                <th scope="col" className={styles.numberHead}>
                  Preis je Person
                </th>
                <th scope="col" className={styles.numberHead}>
                  Anzahl
                </th>
                <th scope="col" className={styles.numberHead}>
                  Gesamt
                </th>
                <th scope="col">Buchung</th>
                <th scope="col" className={styles.actionsHead}>
                  <span className={styles.visuallyHidden}>Aktionen</span>
                </th>
              </tr>
            </thead>
            <tbody data-testid="kostenzeilen">
              {zeilen.map((zeile) => (
                <tr key={zeile.id} data-testid={`kostenzeile-${zeile.id}`}>
                  <td>
                    {/* Die Bezeichnung einer Zeile aus dem Plan kommt vom
                        POI (req-062) und wird dort geaendert; eine manuelle
                        traegt ihre eigene. */}
                    {zeile.herkunft === "manuell" ? (
                      <input
                        className={styles.input}
                        type="text"
                        autoComplete="off"
                        maxLength={KOSTEN_BEZEICHNUNG_MAX_LENGTH}
                        aria-label={`Bezeichnung: ${zeile.bezeichnung}`}
                        value={
                          bezeichnungEntwuerfe[zeile.id] ?? zeile.bezeichnung
                        }
                        onChange={(event) =>
                          setBezeichnungEntwuerfe((current) => ({
                            ...current,
                            [zeile.id]: event.target.value,
                          }))
                        }
                        onBlur={(event) =>
                          void speichereBezeichnung(zeile, event.target.value)
                        }
                      />
                    ) : (
                      <>
                        <span className={styles.bezeichnung}>
                          {zeile.bezeichnung}
                        </span>
                        {zeile.reisetag && (
                          <span className={styles.reisetag}>
                            {zeile.reisetag}
                          </span>
                        )}
                      </>
                    )}
                  </td>
                  <td className={styles.number}>
                    {/* Derselbe Betrag wie im POI-Formular (req-061), hier
                        nur naeher dran: was hier steht, steht dort. */}
                    <input
                      className={`${styles.input} ${styles.numberInput}`}
                      type="text"
                      inputMode="decimal"
                      autoComplete="off"
                      placeholder="z.B. 12,50"
                      aria-label={`Preis je Person: ${zeile.bezeichnung}`}
                      value={
                        entwuerfe[zeile.id] ?? preisEingabe(zeile.preisCent)
                      }
                      onChange={(event) =>
                        setEntwuerfe((current) => ({
                          ...current,
                          [zeile.id]: event.target.value,
                        }))
                      }
                      onBlur={(event) =>
                        void speicherePreis(zeile, event.target.value)
                      }
                    />
                  </td>
                  <td className={styles.number}>
                    {/* Vorbelegt mit der Teilnehmerzahl; von Hand gesetzt
                        bleibt sie stehen, auch wenn jemand zur Reise
                        dazukommt (req-062). */}
                    <input
                      className={`${styles.input} ${styles.numberInput}`}
                      type="text"
                      inputMode="numeric"
                      autoComplete="off"
                      data-testid="kostenzeile-anzahl"
                      aria-label={`Anzahl: ${zeile.bezeichnung}`}
                      value={anzahlEntwuerfe[zeile.id] ?? String(zeile.anzahl)}
                      onChange={(event) =>
                        setAnzahlEntwuerfe((current) => ({
                          ...current,
                          [zeile.id]: event.target.value,
                        }))
                      }
                      onBlur={(event) =>
                        void speichereAnzahl(zeile, event.target.value)
                      }
                    />
                  </td>
                  <td
                    className={styles.number}
                    data-testid="kostenzeile-gesamt"
                  >
                    {betrag(zeile.gesamtCent)}
                  </td>
                  <td>
                    <select
                      className={`${styles.input} ${styles.select}`}
                      aria-label={`Buchung: ${zeile.bezeichnung}`}
                      value={zeile.buchung}
                      onChange={(event) =>
                        void speichereBuchung(
                          zeile,
                          event.target.value as PoiBuchung,
                        )
                      }
                    >
                      {POI_BUCHUNGEN.map((buchung) => (
                        <option key={buchung} value={buchung}>
                          {POI_BUCHUNG_LABEL[buchung]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className={styles.actions}>
                    {/* Nur manuelle Zeilen lassen sich loeschen: eine Zeile
                        aus dem Plan verschwindet mit ihrem Programmpunkt
                        (req-062). */}
                    {zeile.herkunft === "manuell" && (
                      <button
                        type="button"
                        className={`${styles.iconButton} ${styles.danger}`}
                        aria-label={`Zeile entfernen: ${zeile.bezeichnung}`}
                        onClick={() => void entferne(zeile)}
                      >
                        <TrashIcon />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {zeilen.length > 0 && (
        /* Unten die beiden Summen (req-062): die Gesamtkosten und, geteilt
           durch die Teilnehmerzahl, die Kosten je Person -- damit sich ein
           Mietauto auf alle verteilt. */
        <div className={styles.summen}>
          <div className={styles.summe}>
            <span className={styles.summeLabel}>Gesamtkosten</span>
            <span className={styles.summeWert} data-testid="kosten-gesamt">
              {betrag(summen.gesamtCent)}
            </span>
          </div>
          <div className={styles.summe}>
            <span className={styles.summeLabel}>Kosten je Person</span>
            <span className={styles.summeWert} data-testid="kosten-je-person">
              {betrag(summen.jePersonCent)}
            </span>
          </div>
        </div>
      )}
      {anlegen && (
        <form
          className={styles.form}
          aria-label="Neue Kostenzeile"
          onSubmit={(event) => {
            event.preventDefault();
            void lege();
          }}
        >
          <div className={styles.formFields}>
            <label className={styles.field}>
              <span className={styles.label}>Bezeichnung</span>
              <input
                className={styles.input}
                type="text"
                autoComplete="off"
                maxLength={KOSTEN_BEZEICHNUNG_MAX_LENGTH}
                placeholder="z.B. Maut"
                value={neu.bezeichnung}
                onChange={(event) =>
                  setNeu((current) => ({
                    ...current,
                    bezeichnung: event.target.value,
                  }))
                }
              />
            </label>
            <label className={styles.field}>
              <span className={styles.label}>Preis je Person</span>
              <input
                className={styles.input}
                type="text"
                inputMode="decimal"
                autoComplete="off"
                placeholder="z.B. 30,00"
                value={neu.preis}
                onChange={(event) =>
                  setNeu((current) => ({
                    ...current,
                    preis: event.target.value,
                  }))
                }
              />
            </label>
            <label className={styles.field}>
              <span className={styles.label}>Anzahl</span>
              <input
                className={styles.input}
                type="text"
                inputMode="numeric"
                autoComplete="off"
                value={neu.anzahl}
                onChange={(event) => {
                  // Erst eine eigene Eingabe macht die Anzahl zu einer von
                  // Hand gesetzten; unberuehrt zieht sie weiter mit der
                  // Teilnehmerzahl nach (req-062).
                  setAnzahlBeruehrt(true);
                  setNeu((current) => ({
                    ...current,
                    anzahl: event.target.value,
                  }));
                }}
              />
            </label>
            <label className={styles.field}>
              <span className={styles.label}>Buchung</span>
              <select
                className={`${styles.input} ${styles.select}`}
                value={neu.buchung}
                onChange={(event) =>
                  setNeu((current) => ({
                    ...current,
                    buchung: event.target.value as PoiBuchung,
                  }))
                }
              >
                {POI_BUCHUNGEN.map((buchung) => (
                  <option key={buchung} value={buchung}>
                    {POI_BUCHUNG_LABEL[buchung]}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className={styles.formActions}>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={() => setAnlegen(false)}
            >
              Abbrechen
            </button>
            <button type="submit" className={styles.primaryButton}>
              Speichern
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
