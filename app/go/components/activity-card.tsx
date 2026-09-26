"use client";

import { useState } from "react";
import type { Activity } from "@/lib/activities/types";
import {
  ACTIVITY_TYPE_COLOR,
  ACTIVITY_TYPE_LABEL,
} from "@/lib/activities/type-meta";
import { formatTimeRange } from "@/lib/activities/format";
import { resolveBookingAction } from "@/lib/activities/booking";
import { kachelLinks } from "@/lib/activities/kachel-links";
import type { Poi } from "@/lib/pois/types";
import { istKiBild } from "@/lib/pois/ki-bild";
import { poiFotoUrl } from "@/lib/pois/foto-url";
import { KiBildMarke } from "@/components/ki-bild-marke";
import { BookingButton } from "./booking-button";
import { KachelLinks } from "./kachel-links";
import styles from "./activity-card.module.css";

export function ActivityCard({
  activity,
  poi,
  selected,
  ohneMich = [],
}: {
  activity: Activity;
  /**
   * Der POI, aus dem der Programmpunkt entstanden ist (`activity.poiId`) —
   * von dort kommen die Fotos der Kachel (req-079). Ein Programmpunkt ohne
   * POI hat keine; dann bleibt es bei der farbigen Flaeche.
   */
  poi?: Poi;
  /** Kennzeichnet die Karte als gewaehlte Alternative einer Options-Gruppe. */
  selected?: boolean;
  /**
   * Wer bei diesem Programmpunkt nicht dabei ist (req-054): die Namen derer,
   * die beim zugrundeliegenden POI "Ohne mich" gestimmt haben. Steht auch
   * dann noch hier, wenn die Runde beendet ist.
   */
  ohneMich?: string[];
}) {
  const [expanded, setExpanded] = useState(false);
  const color = ACTIVITY_TYPE_COLOR[activity.type];
  const bookingAction = resolveBookingAction(activity);
  // Die Fotos kommen ueber den POI (req-079); das erste steht oben auf der
  // Kachel. Ohne POI und ohne Foto ist die Liste leer -- ein fehlendes Foto
  // ist kein Fehler (vgl. bug-021).
  const fotos = poi?.photos ?? [];
  const erstesFoto = fotos.length > 0 ? fotos[0] : null;
  const weitereFotos = fotos.slice(1);
  const links = kachelLinks(activity, poi);

  return (
    <div className={`${styles.card} ${selected ? styles.selected : ""}`}>
      {/* Der obere Teil zeigt das erste Foto des POI; ohne Foto bleibt es bei
          der farbigen Flaeche des Typs (req-079). Die Angaben darueber --
          Art, Uhrzeit und "Gewählt" -- bringen ihren eigenen Grund mit und
          bleiben deshalb auf jedem Foto lesbar. */}
      <div
        className={styles.photo}
        data-testid={`kachel-kopf-${activity.id}`}
        style={erstesFoto ? undefined : { backgroundColor: color }}
      >
        {erstesFoto && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element --
                Die Datei kommt aus der eigenen Schnittstelle und wird
                unveraendert gezeigt (siehe lib/pois/foto-url.ts). */}
            <img
              className={styles.photoImage}
              src={poiFotoUrl(erstesFoto.id)}
              alt={`Foto von ${activity.title}`}
              loading="lazy"
            />
            {/* Ein KI-Bild traegt sein Zeichen auch hier (req-072). */}
            {istKiBild(erstesFoto) && <KiBildMarke />}
          </>
        )}
        <span className={styles.typeChip} style={{ backgroundColor: color }}>
          {ACTIVITY_TYPE_LABEL[activity.type]}
        </span>
        <span className={styles.timePill}>{formatTimeRange(activity)}</span>
        {selected && <span className={styles.selectedPill}>✓ Gewählt</span>}
      </div>
      <div className={styles.body}>
        <h3 className={styles.title}>{activity.title}</h3>
        {/* Aufgeklappt ersetzt der Langtext den Kurztext (req-079) -- nicht
            beides untereinander: der Kurztext ist die Kurzfassung desselben. */}
        {expanded ? (
          <p className={styles.longText}>{activity.longText}</p>
        ) : (
          <p className={styles.shortText}>{activity.shortText}</p>
        )}
        {/* Die weiteren Fotos des POI, in ihrer Reihenfolge -- das erste bleibt
            oben auf der Kachel und wiederholt sich hier nicht. Sie entstehen
            erst beim Aufklappen: unterwegs im Mobilfunk wird nichts geladen,
            was niemand sehen wollte (req-079, Constraints). */}
        {expanded && weitereFotos.length > 0 && (
          <div
            className={styles.weitereFotos}
            data-testid={`kachel-weitere-fotos-${activity.id}`}
          >
            {weitereFotos.map((foto, index) => (
              <div key={foto.id} className={styles.weiteresFoto}>
                {/* eslint-disable-next-line @next/next/no-img-element --
                    Siehe oben: die Datei kommt aus der eigenen Schnittstelle. */}
                <img
                  className={styles.weiteresFotoBild}
                  src={poiFotoUrl(foto.id)}
                  alt={`Foto ${index + 2} von ${activity.title}`}
                  loading="lazy"
                />
                {istKiBild(foto) && <KiBildMarke />}
              </div>
            ))}
          </div>
        )}
        {ohneMich.length > 0 && (
          <p
            className={styles.ohneMich}
            data-testid={`ohne-mich-${activity.id}`}
          >
            Nicht dabei: {ohneMich.join(", ")}
          </p>
        )}
        <button
          type="button"
          className={styles.toggle}
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? "Weniger anzeigen" : "Mehr lesen"}
        </button>
        {/* Der Weg zum Ort, seine Webseite und seine weiteren Kontaktwege
            (req-079) -- was nicht hinterlegt ist, fehlt hier ganz. */}
        <KachelLinks links={links} activityId={activity.id} />
        {bookingAction && (
          <div className={styles.actions}>
            <BookingButton action={bookingAction} />
          </div>
        )}
      </div>
    </div>
  );
}
