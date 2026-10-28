"use client";

import { useId, useState, type CSSProperties, type ReactNode } from "react";
import { PencilIcon, PlusIcon, TrashIcon } from "@/components/icons";
import { TippzielCheckbox } from "@/components/tippziel-checkbox";
import { findeBaustein } from "@/lib/design/baukasten";
import {
  FARBWELT_PLANER,
  SCHRIFTSTUFEN,
  type Schriftstufe,
} from "@/lib/design/stil";
import { DEFAULT_THEME_ID, THEMES } from "@/lib/theme/themes";
import { LEERE_PRAEFERENZEN } from "@/lib/trips/praeferenzen";
import type { Trip } from "@/lib/trips/types";
import { Seitenleiste } from "../components/seitenleiste";
import styles from "./bausteine.module.css";
import go from "./begleiter-bausteine.module.css";
import {
  BegleiterBlatt,
  BegleiterChat,
  BegleiterKarte,
  BegleiterListen,
  BegleiterProgramm,
  BegleiterRahmen,
  Chat,
  Einzelseite,
  Karte,
  Kennzahlen,
  Leer,
  Seitenrahmen,
  Zeitstrahl,
} from "./seiten-bausteine";

/**
 * Die Bausteine des Baukastens (req-089). Sie sind aus den Tokens der
 * gemeinsamen Stil-Datei gebaut und halten die vier Regeln aus stack.md bei
 * jeder der drei Breiten ein -- sie sind die Vorlage, auf die die
 * bestehenden Module Bereich fuer Bereich umgestellt werden.
 *
 * Was sie zeigen, ist ausgedacht: keine Reise, keine Daten aus der
 * Datenbank.
 */

/** Die Textstufen der Farbwelt, laut nach leise. */
export const TEXTSTUFEN = [
  "--text",
  "--text-2",
  "--text-3",
  "--text-4",
] as const;

function Gruppe({ titel, children }: { titel: string; children: ReactNode }) {
  return (
    <section className={styles.gruppe}>
      <h3 className={styles.gruppenTitel}>{titel}</h3>
      {children}
    </section>
  );
}

function Farben() {
  return (
    <>
      <Gruppe titel="Farbwelt">
        <ul className={styles.farben}>
          {Object.entries(FARBWELT_PLANER).map(([name, wert]) => (
            <li key={name} className={styles.farbe}>
              <span
                className={styles.farbfeld}
                style={{ background: `var(${name})` }}
                aria-hidden="true"
              />
              <span className={styles.farbname}>{name}</span>
              <span className={styles.farbwert}>{wert}</span>
            </li>
          ))}
        </ul>
      </Gruppe>
      <Gruppe titel="Textstufen auf der Karte">
        <div className={styles.karte}>
          {TEXTSTUFEN.map((stufe) => (
            <p
              key={stufe}
              className={styles.textprobe}
              style={{ color: `var(${stufe})` }}
              data-textstufe={stufe}
            >
              {stufe} — Die Fähre nach Elba geht um 9:40 Uhr.
            </p>
          ))}
        </div>
      </Gruppe>
      <Gruppe titel="Schriftstufen">
        <div className={styles.karte}>
          {(Object.keys(SCHRIFTSTUFEN) as Schriftstufe[]).map((stufe) => (
            <p
              key={stufe}
              className={styles.schriftprobe}
              style={{
                fontSize: `var(--schrift-${stufe})`,
                lineHeight: `var(--zeile-${stufe})`,
              }}
              data-schriftstufe={stufe}
            >
              {stufe} · {SCHRIFTSTUFEN[stufe].groessePx} px — Ankunft in
              Portoferraio
            </p>
          ))}
        </div>
      </Gruppe>
    </>
  );
}

function Knoepfe() {
  return (
    <>
      <Gruppe titel="Gewöhnlich und betont">
        <div className={styles.reihe}>
          <button type="button" className={styles.knopf}>
            Abbrechen
          </button>
          <button type="button" className={styles.knopfBetont}>
            Speichern
          </button>
        </div>
      </Gruppe>
      <Gruppe titel="Abgeschaltet">
        <div className={styles.reihe}>
          <button type="button" className={styles.knopf} disabled>
            Abbrechen
          </button>
          <button type="button" className={styles.knopfBetont} disabled>
            Speichern
          </button>
        </div>
      </Gruppe>
      <Gruppe titel="Mit Symbol">
        <div className={styles.reihe}>
          <button type="button" className={styles.knopf}>
            <PlusIcon />
            POI hinzufügen
          </button>
          <button type="button" className={styles.knopfBetont}>
            <PencilIcon />
            Bearbeiten
          </button>
          <button
            type="button"
            className={styles.knopfSymbol}
            aria-label="Löschen"
            title="Löschen"
          >
            <TrashIcon />
          </button>
          <button
            type="button"
            className={styles.knopfSymbol}
            aria-label="Löschen"
            title="Löschen"
            disabled
          >
            <TrashIcon />
          </button>
        </div>
      </Gruppe>
    </>
  );
}

function Felder() {
  const id = useId();
  return (
    <div className={styles.formular}>
      <label className={styles.feld}>
        <span className={styles.beschriftung}>Titel der Reise</span>
        <input className={styles.eingabe} defaultValue="Toskana im Herbst" />
      </label>
      <label className={styles.feld}>
        <span className={styles.beschriftung}>Hauptort</span>
        <input
          className={styles.eingabe}
          defaultValue=""
          aria-invalid="true"
          aria-describedby={`${id}-fehler`}
        />
        <span id={`${id}-fehler`} className={styles.fehlertext}>
          Bitte einen Ort aus der Suche wählen.
        </span>
      </label>
      <label className={styles.feld}>
        <span className={styles.beschriftung}>Reisetempo</span>
        <select className={styles.eingabe} defaultValue="ausgewogen">
          <option value="entspannt">Entspannt</option>
          <option value="ausgewogen">Ausgewogen</option>
          <option value="dicht">Dicht</option>
        </select>
      </label>
      <label className={styles.feld}>
        <span className={styles.beschriftung}>Für die Gruppe</span>
        <textarea
          className={`${styles.eingabe} ${styles.textbereich}`}
          defaultValue="Badesachen nicht vergessen."
        />
      </label>
    </div>
  );
}

function Umschalter() {
  const [ansicht, setAnsicht] = useState("tag");
  const [an, setAn] = useState(true);
  const [filter, setFilter] = useState<string[]>(["gesetzt"]);
  const umschalten = (wert: string) =>
    setFilter((alt) =>
      alt.includes(wert) ? alt.filter((f) => f !== wert) : [...alt, wert],
    );
  return (
    <>
      <Gruppe titel="Segmente">
        <div className={styles.segmente} role="group" aria-label="Ansicht">
          {[
            ["tag", "Tag"],
            ["woche", "Woche"],
            ["reise", "Reise"],
          ].map(([wert, text]) => (
            <button
              key={wert}
              type="button"
              className={styles.segment}
              aria-pressed={ansicht === wert}
              onClick={() => setAnsicht(wert)}
            >
              {text}
            </button>
          ))}
        </div>
      </Gruppe>
      <Gruppe titel="Schalter">
        <button
          type="button"
          role="switch"
          aria-checked={an}
          className={styles.schalter}
          onClick={() => setAn((wert) => !wert)}
        >
          <span className={styles.schalterSpur} aria-hidden="true">
            <span className={styles.schalterKnopf} />
          </span>
          Fahrzeiten zeigen
        </button>
      </Gruppe>
      <Gruppe titel="Filter">
        <div className={styles.reihe}>
          {[
            ["gesetzt", "Gesetzt"],
            ["vielleicht", "Vielleicht"],
            ["verworfen", "Verworfen"],
          ].map(([wert, text]) => (
            <button
              key={wert}
              type="button"
              className={styles.filter}
              aria-pressed={filter.includes(wert)}
              onClick={() => umschalten(wert)}
            >
              {text}
            </button>
          ))}
        </div>
      </Gruppe>
      <Gruppe titel="Ankreuzbox">
        <label className={styles.ankreuzen}>
          <TippzielCheckbox defaultChecked aria-label="Gebucht" />
          <span>Gebucht</span>
        </label>
      </Gruppe>
    </>
  );
}

function Kacheln() {
  return (
    <div className={styles.kacheln}>
      <article className={styles.karte}>
        <h3 className={styles.kartenTitel}>Fähre nach Elba</h3>
        <p className={styles.kartenText}>
          Piombino ab 9:40, Portoferraio an 10:40. Tickets liegen bei den
          Dokumenten.
        </p>
        <p className={styles.kartenMeta}>Mi, 14. Okt · 1 Std</p>
      </article>
      <article className={`${styles.karte} ${styles.karteRuhig}`}>
        <h3 className={styles.kartenTitel}>Mittag in Marciana</h3>
        <p className={styles.kartenText}>Noch nicht verplant.</p>
      </article>
      <button type="button" className={styles.kachel} aria-pressed="true">
        <span className={styles.kartenTitel}>Monte Capanne</span>
        <span className={styles.kartenMeta}>Gewählt</span>
      </button>
    </div>
  );
}

function Meldungen() {
  return (
    <div className={styles.meldungen}>
      <p className={`${styles.meldung} ${styles.hinweis}`} role="status">
        <strong className={styles.meldungsTitel}>Hinweis</strong>
        Die Einladung ging nicht per Mail hinaus — gib den Link selbst weiter.
      </p>
      <p className={`${styles.meldung} ${styles.erfolg}`} role="status">
        <strong className={styles.meldungsTitel}>Gespeichert</strong>
        Die Reise steht jetzt im Begleiter.
      </p>
      <p className={`${styles.meldung} ${styles.fehler}`} role="alert">
        <strong className={styles.meldungsTitel}>Fehler</strong>
        Der Ort liess sich nicht finden. Prüfe die Schreibweise.
      </p>
    </div>
  );
}

function Pillen() {
  return (
    <div className={styles.reihe}>
      <span className={styles.pille}>In Planung</span>
      <span className={styles.pille}>Gebucht</span>
      <span className={`${styles.pille} ${styles.pilleBetont}`}>Heute</span>
      <span className={styles.plakette} aria-label="3 offen">
        3
      </span>
    </div>
  );
}

function Dialog({ offen: anfangsOffen }: { offen: boolean }) {
  const [offen, setOffen] = useState(anfangsOffen);
  const titelId = useId();
  return (
    <>
      <button
        type="button"
        className={styles.knopf}
        onClick={() => setOffen(true)}
      >
        Dialog öffnen
      </button>
      {offen && (
        <div className={styles.dialogGrund}>
          <div
            className={styles.dialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titelId}
            data-testid="baukasten-dialog"
          >
            <h3 id={titelId} className={styles.dialogTitel}>
              POI löschen?
            </h3>
            <p className={styles.kartenText}>
              „Monte Capanne“ verschwindet aus der Sammlung und aus jedem Tag,
              an dem er verplant ist.
            </p>
            <div className={styles.dialogKnoepfe}>
              <button
                type="button"
                className={styles.knopf}
                onClick={() => setOffen(false)}
              >
                Abbrechen
              </button>
              <button
                type="button"
                className={styles.knopfGefahr}
                onClick={() => setOffen(false)}
              >
                Löschen
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Listen() {
  const zeilen = [
    ["Anna", "Reiseleiterin", "anna"],
    ["Ben", "Mitreisender", "ben"],
    ["Clara Maria von Lindenau-Hohenstein", "Mitreisende", "clara"],
  ];
  return (
    <>
      <Gruppe titel="Liste">
        <ul className={styles.liste}>
          {zeilen.map(([name, rolle, kennung]) => (
            <li key={kennung} className={styles.zeile}>
              <span className={styles.avatar} aria-hidden="true">
                {name[0]}
              </span>
              <span className={styles.zeilenText}>
                <span className={styles.zeilenName}>{name}</span>
                <span className={styles.kartenMeta}>{rolle}</span>
              </span>
              <button
                type="button"
                className={styles.knopfSymbol}
                aria-label={`${name} ändern`}
                title="Ändern"
              >
                <PencilIcon />
              </button>
            </li>
          ))}
        </ul>
      </Gruppe>
      <Gruppe titel="Tabelle">
        <div className={styles.tabellenRahmen}>
          <table className={styles.tabelle}>
            <thead>
              <tr>
                <th scope="col">Posten</th>
                <th scope="col">Bezahlt von</th>
                <th scope="col" className={styles.zahl}>
                  Betrag
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Fähre</td>
                <td>Anna</td>
                <td className={styles.zahl}>84,00 €</td>
              </tr>
              <tr>
                <td>Abendessen</td>
                <td>Ben</td>
                <td className={styles.zahl}>126,50 €</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Gruppe>
    </>
  );
}

function Fortschritt() {
  const schritte = ["Sammeln", "Bewerten", "Planen", "Unterwegs"];
  return (
    <>
      <Gruppe titel="Balken">
        <div className={styles.fortschrittKopf}>
          <span>Belege erfasst</span>
          <span>7 von 10</span>
        </div>
        <div
          className={styles.balken}
          role="progressbar"
          aria-label="Belege erfasst"
          aria-valuemin={0}
          aria-valuemax={10}
          aria-valuenow={7}
        >
          <span className={styles.balkenFuellung} style={{ width: "70%" }} />
        </div>
      </Gruppe>
      <Gruppe titel="Schritte">
        <ol className={styles.schritte}>
          {schritte.map((schritt, i) => (
            <li
              key={schritt}
              className={styles.schritt}
              aria-current={i === 2 ? "step" : undefined}
              data-erledigt={i < 2 ? "" : undefined}
            >
              {schritt}
            </li>
          ))}
        </ol>
      </Gruppe>
    </>
  );
}

/** Eine ausgedachte Reise fuer die Seitenleiste -- keine aus der Datenbank. */
const BEISPIEL_REISE: Trip = {
  id: "baukasten",
  title: "Toskana im Herbst",
  startDate: "2026-10-10",
  endDate: "2026-10-18",
  mainPlace: { name: "Piombino", lat: 42.93, lng: 10.52 },
  description: "",
  state: "in_planung",
  tempo: "ausgewogen",
  praeferenzen: LEERE_PRAEFERENZEN,
};

function nichts() {}

function SeitenleisteBaustein() {
  return (
    <div className={styles.leistenBuehne}>
      <Seitenleiste
        trips={[BEISPIEL_REISE]}
        selectedTrip={BEISPIEL_REISE}
        today={new Date("2026-10-12T12:00:00")}
        activeArea="planung"
        onSelectTrip={nichts}
        onSelectArea={nichts}
        onCreateTrip={nichts}
        onOpenTripDetails={nichts}
      />
    </div>
  );
}

function Inhalt({ id, zustand }: { id: string; zustand: string | null }) {
  switch (id) {
    case "farben":
      return <Farben />;
    case "knoepfe":
      return <Knoepfe />;
    case "felder":
      return <Felder />;
    case "umschalter":
      return <Umschalter />;
    case "kacheln":
      return <Kacheln />;
    case "meldungen":
      return <Meldungen />;
    case "pillen":
      return <Pillen />;
    case "dialog":
      return <Dialog offen={zustand === "offen"} />;
    case "listen":
      return <Listen />;
    case "fortschritt":
      return <Fortschritt />;
    case "seitenleiste":
      return <SeitenleisteBaustein />;
    case "seitenrahmen":
      return <Seitenrahmen />;
    case "zeitstrahl":
      return <Zeitstrahl />;
    case "karte":
      return <Karte />;
    case "kennzahlen":
      return <Kennzahlen />;
    case "leer":
      return <Leer />;
    case "chat":
      return <Chat />;
    case "einzelseite":
      return <Einzelseite />;
    case "begleiter-rahmen":
      return <BegleiterRahmen />;
    case "begleiter-programm":
      return <BegleiterProgramm />;
    case "begleiter-listen":
      return <BegleiterListen />;
    case "begleiter-karte":
      return <BegleiterKarte />;
    case "begleiter-chat":
      return <BegleiterChat />;
    case "begleiter-blatt":
      return <BegleiterBlatt offen={zustand === "offen"} />;
    default:
      return null;
  }
}

/**
 * Die Farbschicht des Begleiters, wie die App sie setzt
 * (app/go/go-view.tsx): das vorgewaehlte Thema (req-091). Im Stylesheet der
 * Mockups steht dasselbe Thema an der Klasse `farbwelt-begleiter`.
 */
const BEGLEITER_THEMA = THEMES.find((t) => t.id === DEFAULT_THEME_ID)
  ?.vars as CSSProperties;

/**
 * Die Seite eines Bausteins, so wie der Katalog sie in jedem seiner drei
 * Rahmen zeigt. `data-baustein` nennt ihn -- die Bildschirmpruefung
 * (tests/e2e/screen-check.ts) schreibt den Namen in jede Meldung.
 */
export function BausteinSeite({
  id,
  zustand,
}: {
  id: string;
  zustand: string | null;
}) {
  const baustein = findeBaustein(id);
  if (!baustein) return null;
  if (baustein.welt === "begleiter") {
    return (
      <div
        className={go.goSeite}
        style={BEGLEITER_THEMA}
        data-baustein={baustein.titel}
      >
        {baustein.festeHoehe ? (
          <Inhalt id={id} zustand={zustand} />
        ) : (
          <div className={go.goInhalt}>
            <Inhalt id={id} zustand={zustand} />
          </div>
        )}
      </div>
    );
  }
  return (
    <div
      className={[
        styles.seite,
        baustein.festeHoehe ? styles.volleHoehe : "",
        id === "seitenleiste" || id === "seitenrahmen" ? styles.ohneRand : "",
      ].join(" ")}
      data-baustein={baustein.titel}
    >
      <Inhalt id={id} zustand={zustand} />
    </div>
  );
}
