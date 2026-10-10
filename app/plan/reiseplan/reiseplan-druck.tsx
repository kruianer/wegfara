"use client";

import type {
  DruckDeckblatt,
  DruckFoto,
  DruckKosten,
  DruckStation,
  DruckTag,
  Reiseplan,
} from "@/lib/druck/types";
import { DRUCK_BUCHUNG_LABEL } from "@/lib/druck/kosten";
import { APP_NAME } from "@/lib/marke";
import { poiFotoUrl } from "@/lib/pois/foto-url";
import { CompassIcon } from "@/components/compass-icon";
import { KiBildMarke } from "@/components/ki-bild-marke";
import styles from "./reiseplan-druck.module.css";

/**
 * Der Reiseplan zum Ausdrucken (req-080) -- das Heft, das der Reiseleiter vor
 * der Reise verschickt und aushaendigt.
 *
 * Gesetzt fuer **A4 hoch, randlos**: Farbflaechen und Fotos laufen bis an die
 * Blattkante, der Textsatz haelt 15 mm Sicherheitsrand. Das PDF entsteht ueber
 * die Druckfunktion des Browsers -- serverseitig erzeugt wird in diesem
 * Schritt keines (req-080, Constraints).
 *
 * Was auf den Seiten steht, rechnet lib/druck/; diese Datei zeichnet es. Die
 * verbindliche Vorlage fuer das Aussehen ist das Mockup
 * (delivery/design/reiseplan-druck/variante-c-magazin.mockup.html).
 */

/** Ein Foto im Heft, in der Flaeche, die sein Layout vorgibt. */
function Bild({
  foto,
  gross = false,
  alt,
  testId,
}: {
  foto: DruckFoto;
  gross?: boolean;
  alt: string;
  testId?: string;
}) {
  return (
    <div
      className={`${styles.bild} ${gross ? styles.gross : ""}`.trim()}
      data-testid={testId}
    >
      {/* eslint-disable-next-line @next/next/no-img-element --
          Die Datei kommt aus der eigenen Schnittstelle und wird unveraendert
          gezeigt (siehe lib/pois/foto-url.ts); der Bild-Optimierer von Next
          ist hier nicht im Spiel. */}
      <img className={styles.bildFoto} src={poiFotoUrl(foto.id)} alt={alt} />
      {/* Ein KI-Bild traegt sein Zeichen auch auf Papier (req-072). */}
      {foto.istKiBild && <KiBildMarke />}
    </div>
  );
}

/**
 * Das grosse Foto einer Station. Fehlt es, bleibt die Flaeche ganz aus --
 * ein leeres Rechteck sieht aus wie ein Fehler im Druck.
 */
function GrossesFoto({ station }: { station: DruckStation }) {
  if (!station.grossesFoto) return null;
  return (
    <Bild
      foto={station.grossesFoto}
      gross
      alt={`Foto von ${station.name}`}
      testId={`station-foto-gross-${station.activityId}`}
    />
  );
}

/**
 * Die kleinen Fotos daneben oder darunter. Hat ein POI nur ein Foto, gibt es
 * sie nicht -- dann fuellt das eine den Bildbereich, und es bleibt keine
 * leere Flaeche (req-080).
 */
function KleineFotos({ station }: { station: DruckStation }) {
  if (station.kleineFotos.length === 0) return null;
  return (
    <div
      className={styles.kleine}
      data-testid={`station-fotos-klein-${station.activityId}`}
    >
      {station.kleineFotos.map((foto, index) => (
        <Bild
          key={foto.id}
          foto={foto}
          alt={`Foto ${index + 2} von ${station.name}`}
        />
      ))}
    </div>
  );
}

/**
 * Die Marke der Station: Startzeit, Art, Trennstrich -- in allen Layouts
 * gleich. Dort steht **nur die Startzeit**: keine Dauer, keine Endzeit; ein
 * Zeitfenster machte aus dem Heft einen Fahrplan.
 */
function StationMarke({
  station,
  mitStrich = true,
}: {
  station: DruckStation;
  mitStrich?: boolean;
}) {
  return (
    <div className={styles.stationMarke}>
      <span
        className={styles.zeit}
        data-testid={`station-zeit-${station.activityId}`}
      >
        {station.startzeit}
      </span>
      <span className={styles.art}>{station.art}</span>
      {mitStrich && <span className={styles.strich} aria-hidden="true" />}
    </div>
  );
}

/** Name, Langtext und -- wenn es eine gibt -- der Satz zur Alternative. */
function StationText({ station }: { station: DruckStation }) {
  return (
    <>
      <h3 className={styles.stationName}>{station.name}</h3>
      {/* Der Langtext (req-044), nicht der Kurztext: im Heft ist Platz, und
          der Kurztext ist nur seine Kurzfassung. */}
      <p
        className={styles.stationLauf}
        data-testid={`station-langtext-${station.activityId}`}
      >
        {station.langtext}
      </p>
      {/* Die Alternative einer Options-Gruppe in einem Satz (req-004) --
          Raum bekommt nur die Hauptoption. */}
      {station.alternative && (
        <p
          className={styles.nebenbei}
          data-testid={`station-alternative-${station.activityId}`}
        >
          {station.alternative}
        </p>
      )}
    </>
  );
}

/**
 * Eine Station in ihrem Layout (req-080). Welches sie traegt, hat
 * lib/druck/layouts.ts entschieden -- hier wird es nur gezeichnet.
 */
function Station({ station }: { station: DruckStation }) {
  const rahmen = `${styles.station} ${styles[station.layout]}`;
  const gemeinsam = {
    className: rahmen,
    "data-testid": `station-${station.activityId}`,
    "data-layout": station.layout,
  };

  // L5 -- Nebenstation: schmal, ein kleines Bild, kurzer Text.
  if (station.layout === "l5") {
    return (
      <div {...gemeinsam}>
        {station.grossesFoto && (
          <Bild foto={station.grossesFoto} alt={`Foto von ${station.name}`} />
        )}
        <div>
          <StationMarke station={station} mitStrich={false} />
          <StationText station={station} />
        </div>
      </div>
    );
  }

  // L1 -- grosses Bild links, Text rechts, kleine unter dem Text.
  if (station.layout === "l1") {
    return (
      <div {...gemeinsam}>
        <StationMarke station={station} />
        <div className={styles.koerper}>
          <GrossesFoto station={station} />
          <div className={styles.spalteRechts}>
            <StationText station={station} />
            <KleineFotos station={station} />
          </div>
        </div>
      </div>
    );
  }

  // L2 -- Text links, grosses Bild rechts, kleine unter dem Bild.
  if (station.layout === "l2") {
    return (
      <div {...gemeinsam}>
        <StationMarke station={station} />
        <div className={styles.koerper}>
          <div>
            <StationText station={station} />
          </div>
          <div>
            <GrossesFoto station={station} />
            <KleineFotos station={station} />
          </div>
        </div>
      </div>
    );
  }

  // L3 -- grosses Bild oben ueber die ganze Breite, Text darunter, kleine
  // rechts neben dem Text.
  if (station.layout === "l3") {
    return (
      <div {...gemeinsam}>
        <StationMarke station={station} />
        <GrossesFoto station={station} />
        <div className={styles.unten}>
          <div>
            <StationText station={station} />
          </div>
          <KleineFotos station={station} />
        </div>
      </div>
    );
  }

  // L4 -- Text zuerst ueber die ganze Breite, darunter eine Bildreihe. Ist
  // nur ein Foto da, faellt die Reihe darauf zusammen.
  return (
    <div {...gemeinsam}>
      <StationMarke station={station} />
      <StationText station={station} />
      {station.grossesFoto && (
        <div
          className={`${styles.bildreihe} ${
            station.kleineFotos.length === 0 ? styles.nurEines : ""
          }`.trim()}
          data-testid={`station-bildreihe-${station.activityId}`}
        >
          <Bild foto={station.grossesFoto} alt={`Foto von ${station.name}`} />
          {station.kleineFotos.map((foto, index) => (
            <Bild
              key={foto.id}
              foto={foto}
              alt={`Foto ${index + 2} von ${station.name}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/** Die Zeile am Fuss jeder Seite: Reise links, wo man gerade ist rechts. */
function Fuss({ links, rechts }: { links: string; rechts: string }) {
  return (
    <div className={styles.fuss}>
      <span>{links}</span>
      <span>{rechts}</span>
    </div>
  );
}

/**
 * Eine Tagesseite: Tageskopf und darunter die Stationen. Hat ein Tag viele
 * Stationen, laeuft er ueber mehrere Blaetter -- zerschnitten wird dabei
 * keine Station (siehe reiseplan-druck.module.css).
 */
function Tagesseite({ tag, fuss }: { tag: DruckTag; fuss: string }) {
  return (
    <section className={styles.seite} data-testid={`druck-tag-${tag.nummer}`}>
      <div className={styles.satz}>
        <div className={styles.tagAuftakt}>
          <div className={styles.tagZahl}>{tag.nummer}</div>
          <div>
            <h2>{tag.ueberschrift}</h2>
            <div className={styles.datum}>{tag.datumText}</div>
          </div>
        </div>

        {tag.stationen.map((station) => (
          <Station key={station.activityId} station={station} />
        ))}

        <Fuss links={fuss} rechts={`Tag ${tag.nummer}`} />
      </div>
    </section>
  );
}

/**
 * Die letzte Seite -- Kosten und Buchungen. Hier stehen die Angaben, die im
 * Tagesteil fehlen: je Position Betrag und Buchungszustand, darunter die
 * Summe und der Betrag je Person. Keine Tabelle mit Kopfzeile, sondern eine
 * Liste, die sich lesen laesst.
 */
function Kostenseite({ kosten, fuss }: { kosten: DruckKosten; fuss: string }) {
  return (
    <section className={styles.seite} data-testid="druck-kosten">
      <div className={styles.satz}>
        <div className={styles.kostenKopf}>
          <div className={styles.kapitel}>Zum Schluss</div>
          <h2>Was es kostet</h2>
          <p>
            Die geplanten Kosten, wie sie beim Drucken feststanden — und was
            davon schon gebucht ist. Was vor Ort dazukommt, steht hier nicht.
          </p>
        </div>

        <div className={styles.posten}>
          {kosten.posten.map((posten) => (
            <div
              key={posten.id}
              className={styles.position}
              data-testid={`kosten-posten-${posten.id}`}
            >
              <div className={styles.postenWas}>
                <div className={styles.postenName}>{posten.name}</div>
                <div className={styles.postenWo}>
                  {posten.zusatz && <span>{posten.zusatz} · </span>}
                  {/* Der Buchungszustand steht hier und nur hier -- im
                      Tagesteil kommt er nicht vor. */}
                  <span
                    className={
                      posten.buchung === "gebucht"
                        ? styles.gebucht
                        : posten.buchung === "offen"
                          ? styles.nochOffen
                          : undefined
                    }
                  >
                    {DRUCK_BUCHUNG_LABEL[posten.buchung]}
                  </span>
                </div>
              </div>
              {/* Eine Position ohne eingetragenen Preis steht als „offen" --
                  „nicht eingetragen" ist kein Betrag, den man raten koennte. */}
              <div
                className={`${styles.betrag} ${
                  posten.betrag === null ? styles.offen : ""
                }`.trim()}
              >
                {posten.betrag ?? "offen"}
              </div>
            </div>
          ))}
        </div>

        <div className={styles.summeBlock} data-testid="kosten-summe">
          <div>
            <div className={styles.bez}>Geplant insgesamt</div>
            {kosten.jePerson && (
              <div className={styles.je}>{kosten.jePerson} je Person</div>
            )}
          </div>
          <div className={styles.gesamt}>{kosten.gesamt}</div>
        </div>

        <Fuss links={fuss} rechts="Kosten" />
      </div>
    </section>
  );
}

/**
 * Seite 1 -- Bild und Dashboard. Das Foto nimmt die oberen zwei Drittel,
 * randlos bis an drei Kanten; Titel und Ort liegen darauf, wo ein Verlauf
 * fuer Lesbarkeit sorgt. Das untere Drittel traegt Beschreibung, vier Zahlen
 * und die Eckdaten.
 */
function Deckblatt({ deckblatt }: { deckblatt: DruckDeckblatt }) {
  return (
    <section
      className={`${styles.seite} ${styles.deckblatt}`}
      data-testid="druck-deckblatt"
    >
      <div className={styles.titelBild}>
        {deckblatt.titelFoto && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element -- siehe Bild() */}
            <img
              className={styles.titelBildFoto}
              src={poiFotoUrl(deckblatt.titelFoto.id)}
              alt={`Foto zu ${deckblatt.titel}`}
            />
            {deckblatt.titelFoto.istKiBild && <KiBildMarke />}
          </>
        )}
        <div className={styles.titelBildSchleier} aria-hidden="true" />
      </div>

      <div className={styles.titelMarke}>
        <span className={styles.kompass}>
          <CompassIcon size={18} />
        </span>
        <span>
          <span className={styles.wort}>{APP_NAME}</span>
          <br />
          <span className={styles.unter}>Reiseplan</span>
        </span>
      </div>

      <div className={styles.titelText}>
        {/* Der handschriftliche Satz ueber dem Titel ist der Anlass; er kommt
            aus der Beschreibung der Reise. Hat sie nur einen Satz, steht
            dieser im Dashboard und hier nichts. */}
        {deckblatt.vorspann && (
          <div className={styles.titelVorspann} data-testid="druck-vorspann">
            {deckblatt.vorspann}
          </div>
        )}
        <h1 className={styles.titelHaupt}>{deckblatt.titel}</h1>
        <div className={styles.titelOrt}>{deckblatt.ort}</div>
      </div>

      <div className={styles.dashboard}>
        {deckblatt.beschreibung && (
          <p
            className={styles.dashBeschreibung}
            data-testid="druck-beschreibung"
          >
            {deckblatt.beschreibung}
          </p>
        )}

        <div className={styles.dashZahlen} data-testid="druck-zahlen">
          {deckblatt.zahlen.map((zahl) => (
            <div
              key={zahl.bezeichnung}
              className={`${styles.zahlBlock} ${zahl.warm ? styles.warm : ""}`.trim()}
            >
              <span className={styles.wert}>
                {zahl.wert}
                {zahl.einheit && (
                  <span className={styles.einheit}> {zahl.einheit}</span>
                )}
              </span>
              <span className={styles.bez}>{zahl.bezeichnung}</span>
            </div>
          ))}
        </div>

        <div className={styles.dashZeilen} data-testid="druck-eckdaten">
          {deckblatt.eckdaten.map((zeile) => (
            <div key={zeile.label} className={styles.dashZeile}>
              <span className={styles.zeileLinks}>{zeile.label}</span>
              <span
                className={`${styles.zeileRechts} ${zeile.warm ? styles.warm : ""}`.trim()}
              >
                {zeile.wert}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/**
 * Der Hinweis, wie aus der Seite ein PDF wird. Er steht nur am Bildschirm:
 * ohne die Einstellung "Hintergrundgrafiken" bleiben die Farbflaechen weiss
 * -- eine Eigenheit des Browsers, kein Fehler der Vorlage.
 */
function DruckHinweis() {
  return (
    <div className={styles.nurBildschirm} data-testid="druck-hinweis">
      <h2>Reiseplan zum Ausdrucken</h2>
      <p>
        Drucken mit <strong>Strg+P</strong> (Mac: <strong>Cmd+P</strong>), dort
        <strong> A4 hoch</strong>, Ränder <strong>„keine“</strong> und{" "}
        <strong>Hintergrundgrafiken</strong> einschalten. „Als PDF speichern“
        ergibt die Datei zum Verschicken.
      </p>
      <p>Dieser Hinweis wird nicht mitgedruckt.</p>
    </div>
  );
}

export function ReiseplanDruck({ reiseplan }: { reiseplan: Reiseplan }) {
  return (
    <div className={styles.heft}>
      <DruckHinweis />
      <Deckblatt deckblatt={reiseplan.deckblatt} />
      {reiseplan.tage.map((tag) => (
        <Tagesseite key={tag.datum} tag={tag} fuss={reiseplan.fuss} />
      ))}
      <Kostenseite kosten={reiseplan.kosten} fuss={reiseplan.fuss} />
    </div>
  );
}
