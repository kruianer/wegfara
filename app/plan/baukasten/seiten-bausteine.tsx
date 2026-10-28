"use client";

import { useState } from "react";
import styles from "./bausteine.module.css";
import go from "./begleiter-bausteine.module.css";

/**
 * Bausteine fuer ganze Seiten (req-091). Die Seiten-Mockups unter
 * delivery/design/baukasten/ setzen sich allein aus den Bausteinen des
 * Katalogs zusammen; was ihnen fehlte, steht hier -- damit es im Katalog
 * steht und nicht nur im Mockup.
 *
 * Wie die uebrigen Bausteine ausgedacht: keine Reise, keine Daten aus der
 * Datenbank.
 */

const PLANER_BEREICHE = [
  ["◉", "POIs"],
  ["◷", "Planung"],
  ["★", "Bewertungen"],
  ["€", "Kosten"],
  ["▤", "Dokumente"],
  ["✎", "Reisedetails"],
  ["✉", "Chat"],
] as const;

export function Seitenrahmen() {
  return (
    <>
      <div className={styles.planer}>
        <nav className={styles.leiste} aria-label="Bereiche">
          <span className={styles.leistenMarke} aria-hidden="true">
            W
          </span>
          {PLANER_BEREICHE.map(([symbol, name]) => (
            <a
              key={name}
              href="#"
              onClick={(e) => e.preventDefault()}
              className={styles.leistenEintrag}
              aria-current={name === "Planung" ? "page" : undefined}
            >
              <span className={styles.leistenSymbol} aria-hidden="true">
                {symbol}
              </span>
              {name}
            </a>
          ))}
          <div className={styles.leistenFuss}>
            <a
              href="#"
              onClick={(e) => e.preventDefault()}
              className={styles.leistenEintrag}
            >
              <span className={styles.leistenSymbol} aria-hidden="true">
                ◔
              </span>
              Mein Bereich
            </a>
          </div>
        </nav>
        <main className={styles.planerInhalt}>
          <header className={styles.seitenKopf}>
            <div>
              <h1 className={styles.seitenTitel}>Planung</h1>
              <p className={styles.seitenUntertitel}>
                Toskana im Herbst · 10.–18. Oktober 2026
              </p>
            </div>
            <div className={styles.reihe}>
              <button type="button" className={styles.knopf}>
                Mit KI planen
              </button>
              <button type="button" className={styles.knopfBetont}>
                + Programmpunkt
              </button>
            </div>
          </header>
          <div className={styles.spalten}>
            <section className={styles.karte}>
              <div className={styles.kartenKopf}>
                <h2 className={styles.kartenTitel}>Linke Spalte</h2>
                <span className={styles.pille}>Kartenkopf</span>
              </div>
              <p className={styles.kartenText}>
                Spalten stehen nebeneinander, solange je 320 px Platz ist.
              </p>
            </section>
            <div className={styles.stapel}>
              <section className={styles.karte}>
                <h2 className={styles.kartenTitel}>Rechte Spalte</h2>
                <p className={styles.kartenText}>
                  Ein Stapel hält mehrere Karten untereinander.
                </p>
              </section>
              <section className={`${styles.karte} ${styles.karteRuhig}`}>
                <h2 className={styles.kartenTitel}>Zweite Karte</h2>
              </section>
            </div>
          </div>
        </main>
      </div>
      <div className={styles.schmalHinweis}>
        <p className={styles.kartenTitel}>Bildschirm zu schmal</p>
        <p className={styles.kartenText}>
          Der Planer benötigt einen breiteren Bildschirm (mindestens 768 Pixel).
          Nutze für unterwegs stattdessen den Begleiter.
        </p>
        <a className={styles.knopfBetont} href="/go">
          Zum Begleiter
        </a>
      </div>
    </>
  );
}

export function Zeitstrahl() {
  return (
    <section className={styles.karte}>
      <div className={styles.tagKopf}>
        <h2 className={styles.kartenTitel}>Tag 1 · Samstag, 10. Oktober</h2>
        <span className={styles.pille}>3 Programmpunkte</span>
      </div>
      <ol className={styles.stationen}>
        <li className={styles.station}>
          <span className={styles.stationZeit}>
            09:40<span className={styles.stationDauer}>1 Std</span>
          </span>
          <div className={styles.stationKarte}>
            <p className={styles.stationName}>Fähre nach Portoferraio</p>
            <p className={styles.kartenMeta}>Fähre · Moby Lines</p>
          </div>
        </li>
        <li>
          <p className={styles.transfer}>↓ Fahrt · 25 Min</p>
        </li>
        <li className={styles.station}>
          <span className={styles.stationZeit}>
            13:00<span className={styles.stationDauer}>2 Std</span>
          </span>
          <div className={styles.stationKarte}>
            <p className={styles.stationName}>
              Zwei Möglichkeiten — wir entscheiden vor Ort
            </p>
            <div className={styles.optionen}>
              <button type="button" className={styles.kachel}>
                <span className={styles.stationName}>Monte Capanne</span>
                <span className={styles.kartenMeta}>Wanderung</span>
              </button>
              <button type="button" className={styles.kachel}>
                <span className={styles.stationName}>Spiaggia di Sansone</span>
                <span className={styles.kartenMeta}>Strand</span>
              </button>
            </div>
          </div>
        </li>
      </ol>
    </section>
  );
}

export function Karte() {
  return (
    <ol className={styles.kartenFlaeche} aria-label="Karte der Tagesroute">
      {[1, 2, 3, 4, 5].map((n) => (
        <li key={n} className={styles.kartenPunkt}>
          {n}
        </li>
      ))}
      <li className={`${styles.kartenPunkt} ${styles.kartenPunktLeise}`}>6</li>
    </ol>
  );
}

export function Kennzahlen() {
  return (
    <>
      <dl className={styles.kennzahlen}>
        {[
          ["12.480,00 €", "Kosten bisher"],
          ["3.120,00 €", "je Person"],
          ["4", "Reisende"],
        ].map(([wert, name]) => (
          <div key={name} className={styles.kennzahl}>
            <dd className={styles.kennzahlWert}>{wert}</dd>
            <dt className={styles.kennzahlName}>{name}</dt>
          </div>
        ))}
      </dl>
      <ul className={styles.liste}>
        <li className={styles.zeile}>
          <span className={styles.zeilenText}>
            <span className={styles.zeilenName}>Anna bekommt</span>
          </span>
          <span className={`${styles.betrag} ${styles.betragPlus}`}>
            +10.215,40 €
          </span>
        </li>
        <li className={styles.zeile}>
          <span className={styles.zeilenText}>
            <span className={styles.zeilenName}>Ben zahlt</span>
          </span>
          <span className={`${styles.betrag} ${styles.betragMinus}`}>
            −84,00 €
          </span>
        </li>
        <li className={styles.zeile}>
          <span className={styles.zeilenText}>
            <span className={styles.zeilenName}>Fähre</span>
          </span>
          <span className={styles.betrag}>84,00 €</span>
        </li>
      </ul>
    </>
  );
}

export function Leer() {
  return (
    <div className={styles.leer}>
      <p className={styles.leerTitel}>Noch keine Dokumente</p>
      <p className={styles.leerText}>
        Lege Tickets und Buchungen hier ab — unterwegs sind sie im Begleiter.
      </p>
      <button type="button" className={styles.knopf}>
        Dokument hochladen
      </button>
    </div>
  );
}

export function Chat() {
  return (
    <>
      <ol className={styles.verlauf}>
        <li className={`${styles.nachricht} ${styles.nachrichtEigene}`}>
          <span className={styles.nachrichtAbsender}>Du</span>
          Wo essen wir am zweiten Abend?
        </li>
        <li className={styles.nachricht}>
          <span className={styles.nachrichtAbsender}>Claude</span>
          In Portoferraio liegen drei Restaurants nah am Hafen.
        </li>
      </ol>
      <div className={styles.eingabeZeile}>
        <textarea
          className={styles.eingabe}
          aria-label="Nachricht"
          defaultValue=""
        />
        <button type="button" className={styles.knopfBetont}>
          Senden
        </button>
      </div>
    </>
  );
}

export function Einzelseite() {
  return (
    <>
      <div className={styles.spalteSchmal}>
        <p className={styles.marke}>wegfara</p>
        <section className={styles.karte}>
          <h2 className={styles.kartenTitel}>Schmale Spalte</h2>
          <p className={styles.kartenText}>
            Für Anmeldung, Einladung und das Einrichten eines Passkeys.
          </p>
        </section>
      </div>
      <div className={styles.spalteMittel}>
        <section className={styles.karte}>
          <h2 className={styles.kartenTitel}>Mittlere Spalte</h2>
          <p className={styles.kartenText}>Für Mein Bereich.</p>
        </section>
      </div>
    </>
  );
}

const BEGLEITER_TABS = [
  ["◷", "Plan"],
  ["◉", "Karte"],
  ["€", "Kosten"],
  ["▤", "Dokumente"],
  ["⋯", "Mehr"],
] as const;

export function BegleiterRahmen() {
  return (
    <div className={go.goApp}>
      <header className={go.goKopf}>
        <span className={go.goKachel} aria-hidden="true">
          T
        </span>
        <div className={go.goKopfText}>
          <p className={go.goTitel}>Toskana im Herbst</p>
          <span className={go.goUntertitel}>Tag 1 von 9</span>
        </div>
        <button
          type="button"
          className={go.goSymbolKnopf}
          aria-label="Mein Bereich"
        >
          ◔
        </button>
      </header>
      <main className={go.goInhalt}>
        <ul className={go.goTage} aria-label="Reisetage">
          {["10.", "11.", "12.", "13.", "14.", "15.", "16.", "17.", "18."].map(
            (tag, i) => (
              <li key={tag}>
                <a
                  href="#"
                  onClick={(e) => e.preventDefault()}
                  className={go.goTag}
                  aria-current={i === 0 ? "date" : undefined}
                >
                  {tag}
                </a>
              </li>
            ),
          )}
        </ul>
        <p className={go.goText}>Der Inhalt rollt, Kopf und Leiste stehen.</p>
      </main>
      <nav className={go.goLeiste} aria-label="Bereiche">
        {BEGLEITER_TABS.map(([symbol, name]) => (
          <a
            key={name}
            href="#"
            onClick={(e) => e.preventDefault()}
            className={go.goLeistenEintrag}
            aria-current={name === "Plan" ? "page" : undefined}
          >
            <span className={go.goLeistenSymbol} aria-hidden="true">
              {symbol}
            </span>
            <span className={go.goLeistenText}>{name}</span>
          </a>
        ))}
      </nav>
    </div>
  );
}

export function BegleiterProgramm() {
  return (
    <>
      <h2 className={go.goAbschnittTitel}>Samstag, 10. Oktober</h2>
      <ol className={go.goPunkte}>
        <li className={go.goPunkt}>
          <span className={go.goPunktZeit}>09:40</span>
          <article className={go.goKarte}>
            <h3 className={go.goKartenTitel}>Fähre nach Portoferraio</h3>
            <p className={go.goText}>Moby Lines · Piombino</p>
            <div className={go.goMeta}>
              <span className={go.goPille}>1 Std</span>
              <span className={go.goPilleGut}>✓ gebucht</span>
            </div>
            <div className={go.goMeta}>
              <button type="button" className={go.goKnopf}>
                Navigation
              </button>
              <button type="button" className={go.goKnopfBetont}>
                Ticket
              </button>
            </div>
          </article>
        </li>
        <li>
          <p className={go.goTransfer}>↓ Fahrt · 25 Min</p>
        </li>
        <li className={go.goPunkt}>
          <span className={go.goPunktZeit}>13:00</span>
          <div className={go.goStapel}>
            <p className={go.goText}>Zwei Möglichkeiten</p>
            <div className={go.goOptionen}>
              <article className={`${go.goKarte} ${go.goKarteGewaehlt}`}>
                <h3 className={go.goKartenTitel}>Monte Capanne</h3>
              </article>
              <article className={go.goKarte}>
                <h3 className={go.goKartenTitel}>Spiaggia di Sansone</h3>
              </article>
            </div>
          </div>
        </li>
      </ol>
      <div className={go.goReihe}>
        <button type="button" className={go.goKnopf}>
          Abbrechen
        </button>
        <button type="button" className={go.goKnopfBetont}>
          Speichern
        </button>
      </div>
    </>
  );
}

export function BegleiterListen() {
  return (
    <>
      <p className={go.goSumme}>12.480,00 €</p>
      <p className={go.goMeldung}>
        <span className={go.goMeldungsTitel}>Verspätung</span>
        Die Fähre legt 20 Minuten später ab.
      </p>
      <p className={`${go.goMeldung} ${go.goMeldungGut}`}>
        <span className={go.goMeldungsTitel}>Ausgeglichen</span>
        Alle Ausgaben sind verrechnet.
      </p>
      <ul className={go.goListe}>
        <li className={go.goZeile}>
          <span className={go.goAvatar} aria-hidden="true">
            A
          </span>
          <span className={go.goZeilenText}>
            <span className={go.goZeilenName}>Anna</span>
            <span className={go.goZeilenMeta}>bekommt</span>
          </span>
          <span className={`${go.goBetrag} ${go.goBetragPlus}`}>
            +10.215,40 €
          </span>
        </li>
        <li className={go.goZeile}>
          <span className={go.goAvatar} aria-hidden="true">
            B
          </span>
          <span className={go.goZeilenText}>
            <span className={go.goZeilenName}>Ben</span>
            <span className={go.goZeilenMeta}>zahlt</span>
          </span>
          <span className={`${go.goBetrag} ${go.goBetragMinus}`}>−84,00 €</span>
        </li>
        <li className={go.goZeile}>
          <span className={go.goZeilenText}>
            <span className={go.goZeilenName}>Fähre</span>
          </span>
          <span className={go.goBetrag}>84,00 €</span>
        </li>
      </ul>
      <label className={go.goFeld}>
        <span className={go.goBeschriftung}>Betrag</span>
        <input className={go.goEingabe} defaultValue="84,00" />
      </label>
      <div className={go.goLeer}>
        <p className={go.goLeerTitel}>Noch keine Dokumente</p>
        <p className={go.goText}>Der Reiseleiter legt sie im Planer ab.</p>
      </div>
    </>
  );
}

export function BegleiterKarte() {
  return (
    <ol className={go.goKartenFlaeche} aria-label="Karte">
      {[1, 2, 3, 4].map((n) => (
        <li key={n} className={go.goKartenPunkt}>
          {n}
        </li>
      ))}
      <li className={`${go.goKartenPunkt} ${go.goPosition}`}>A</li>
    </ol>
  );
}

export function BegleiterChat() {
  return (
    <>
      <ol className={go.goVerlauf}>
        <li className={go.goBlaseEigen}>Wo gibt es hier guten Kaffee?</li>
        <li className={go.goBlase}>
          Zwei Gassen weiter, an der Piazza Cavour.
        </li>
      </ol>
      <div className={go.goEingabeZeile}>
        <input
          className={go.goEingabe}
          aria-label="Frage an den Concierge"
          defaultValue=""
        />
        <button type="button" className={go.goKnopfBetont}>
          Fragen
        </button>
      </div>
    </>
  );
}

export function BegleiterBlatt({ offen: anfangsOffen }: { offen: boolean }) {
  const [offen, setOffen] = useState(anfangsOffen);
  return (
    <>
      <button
        type="button"
        className={go.goKnopf}
        onClick={() => setOffen(true)}
      >
        Mehr öffnen
      </button>
      {offen && (
        <div className={go.goBlattGrund}>
          <div
            className={go.goBlatt}
            role="dialog"
            aria-modal="true"
            aria-label="Mehr"
          >
            <h2 className={go.goBlattTitel}>Mehr</h2>
            <div className={go.goBlattInhalt}>
              <nav className={go.goListe} aria-label="Mehr">
                {["Wer fährt mit", "Meldungen", "Concierge"].map((name) => (
                  <a
                    key={name}
                    href="#"
                    onClick={(e) => e.preventDefault()}
                    className={go.goBlattEintrag}
                  >
                    {name}
                  </a>
                ))}
              </nav>
              <button
                type="button"
                className={go.goKnopf}
                onClick={() => setOffen(false)}
              >
                Schließen
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
