"use client";

import { useEffect, useId, useState } from "react";
import type { MainPlace, Trip } from "@/lib/trips/types";
import type { TripParticipant } from "@/lib/trip-participants/types";
import type { PlaceSuggestion } from "@/lib/osm/place-search";
import { MIN_PLACE_QUERY_LENGTH } from "@/lib/osm/place-search";
import {
  TRIP_DESCRIPTION_MAX_LENGTH,
  TRIP_TITLE_MAX_LENGTH,
  tripDraftIsValid,
  validateTripDraft,
  type TripDraft,
  type TripFieldErrors,
} from "@/lib/trips/validate";
import { searchPlaceSuggestions } from "@/lib/trips/search-places";
import { saveNewTrip, saveTripChanges } from "@/lib/trips/save-trip";
import type { TripState } from "@/lib/trips/state";
import { TripStateSelect } from "./trip-state-select";
import styles from "@/components/cards.module.css";

/** Nominatim verbietet Anfragen im Takt der Tastendruecke — erst nach einer
 *  kurzen Pause wird gesucht (siehe Nominatim-Nutzungsbedingungen). */
const SEARCH_DEBOUNCE_MS = 350;

/**
 * Die Karte "Eckdaten der Reise" in den Reisedetails (req-033). Sie loest
 * das ueberlagernde Formular aus req-017 ab: dieselben Felder, dieselben
 * Regeln -- nur stehen sie jetzt dort, wo auch alles Uebrige zur Reise
 * steht. Ein zweites Formular daneben gibt es nicht.
 *
 * Mit trip = null legt sie eine neue Reise an: die Felder erscheinen leer,
 * und erst das Speichern legt die Reise an -- wer abbricht, hinterlaesst
 * keinen Eintrag (req-033, Constraints).
 *
 * Der Hauptort wird ausschliesslich ueber die Ortssuche erfasst —
 * Koordinaten werden nie von Hand eingegeben (req-017).
 */
export function EckdatenCard({
  trip,
  onSaved,
  onCancel,
  onDelete,
  onStateChanged,
}: {
  /** null legt eine neue Reise an, sonst wird diese geaendert. */
  trip: Trip | null;
  /**
   * Beim Anlegen kommt die Zuordnung des Anlegenden als Reiseleiter mit
   * (req-021); beim Aendern ist sie null.
   */
  onSaved: (trip: Trip, tripParticipant: TripParticipant | null) => void;
  /** Bricht das Anlegen ab -- nur bei einer neuen Reise. */
  onCancel: () => void;
  /** Oeffnet die Rueckfrage vor dem Loeschen (req-017, jetzt hier). */
  onDelete: (trip: Trip) => void;
  /** Der Zustand ist bereits gespeichert, wenn das ankommt (req-022). */
  onStateChanged: (tripId: string, state: TripState) => void;
}) {
  const fieldId = useId();
  const [title, setTitle] = useState(trip?.title ?? "");
  const [startDate, setStartDate] = useState(trip?.startDate ?? "");
  const [endDate, setEndDate] = useState(trip?.endDate ?? "");
  const [description, setDescription] = useState(trip?.description ?? "");
  const [mainPlace, setMainPlace] = useState<MainPlace | null>(
    trip?.mainPlace ?? null,
  );
  const [placeQuery, setPlaceQuery] = useState(trip?.mainPlace.name ?? "");
  // Das Ergebnis der Ortssuche samt der Eingabe, zu der es gehoert -- so
  // verschwinden veraltete Vorschlaege beim Weitertippen von selbst, ohne
  // dass sie eigens zurueckgesetzt werden muessen.
  const [found, setFound] = useState<{
    query: string;
    places: PlaceSuggestion[];
  }>({ query: "", places: [] });
  const [errors, setErrors] = useState<TripFieldErrors>({});
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  const placeChosen = mainPlace !== null && placeQuery === mainPlace.name;
  const suggestions =
    !placeChosen && found.query === placeQuery ? found.places : [];

  useEffect(() => {
    if (placeChosen || placeQuery.trim().length < MIN_PLACE_QUERY_LENGTH) {
      return;
    }

    let abandoned = false;
    const timer = setTimeout(async () => {
      const places = await searchPlaceSuggestions(placeQuery);
      if (!abandoned) setFound({ query: placeQuery, places });
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      abandoned = true;
      clearTimeout(timer);
    };
  }, [placeQuery, placeChosen]);

  function changePlaceQuery(value: string) {
    setPlaceQuery(value);
    // Weicht die Eingabe vom gewaehlten Ort ab, gilt er als nicht mehr
    // gewaehlt -- die Position muss immer aus einem Vorschlag stammen.
    if (mainPlace && value !== mainPlace.name) setMainPlace(null);
  }

  function choosePlace(place: PlaceSuggestion) {
    setMainPlace({ name: place.name, lat: place.lat, lng: place.lng });
    setPlaceQuery(place.name);
  }

  async function submit() {
    if (saving) return;

    const draft: TripDraft = {
      title: title.trim(),
      startDate,
      endDate,
      mainPlace,
      description: description.trim(),
    };
    setErrors(validateTripDraft(draft));
    setFailed(false);
    if (!tripDraftIsValid(draft)) return;

    setSaving(true);
    const saved = trip
      ? await saveTripChanges(trip.id, draft)
      : await saveNewTrip(draft);
    setSaving(false);

    if (!saved) {
      setFailed(true);
      return;
    }
    onSaved(saved.trip, saved.tripParticipant);
  }

  return (
    <section className={styles.card} aria-label="Eckdaten der Reise">
      <h2 className={styles.cardTitle}>Eckdaten der Reise</h2>
      <form
        className={styles.form}
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <div className={styles.formFields}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor={`${fieldId}-title`}>
              Titel
            </label>
            <input
              id={`${fieldId}-title`}
              className={styles.input}
              type="text"
              maxLength={TRIP_TITLE_MAX_LENGTH}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
            {errors.title && (
              <p className={styles.error} role="alert">
                {errors.title}
              </p>
            )}
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor={`${fieldId}-place`}>
              Hauptort
            </label>
            <input
              id={`${fieldId}-place`}
              className={styles.input}
              type="text"
              autoComplete="off"
              placeholder="Ort suchen, z.B. Florenz"
              value={placeQuery}
              onChange={(event) => changePlaceQuery(event.target.value)}
            />
            {suggestions.length > 0 && (
              <ul className={styles.suggestions} aria-label="Ortsvorschläge">
                {suggestions.map((place) => (
                  <li key={`${place.name}-${place.lat}-${place.lng}`}>
                    <button
                      type="button"
                      className={styles.suggestion}
                      onClick={() => choosePlace(place)}
                    >
                      <span className={styles.suggestionName}>
                        {place.name}
                      </span>
                      {place.context && (
                        <span className={styles.suggestionContext}>
                          {place.context}
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {errors.mainPlace && (
              <p className={styles.error} role="alert">
                {errors.mainPlace}
              </p>
            )}
            {!errors.mainPlace && !placeChosen && (
              <p className={styles.hint}>
                Namen eintippen und einen Vorschlag wählen.
              </p>
            )}
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor={`${fieldId}-start`}>
              Beginn
            </label>
            <input
              id={`${fieldId}-start`}
              className={styles.input}
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
            />
            {errors.startDate && (
              <p className={styles.error} role="alert">
                {errors.startDate}
              </p>
            )}
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor={`${fieldId}-end`}>
              Ende
            </label>
            <input
              id={`${fieldId}-end`}
              className={styles.input}
              type="date"
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
            />
            {errors.endDate && (
              <p className={styles.error} role="alert">
                {errors.endDate}
              </p>
            )}
          </div>

          {/* Die Beschreibung ist freiwillig und mehrzeilig (req-033) -- sie
              nimmt deshalb die ganze Breite der Karte ein. */}
          <div className={`${styles.field} ${styles.fieldWide}`}>
            <label className={styles.label} htmlFor={`${fieldId}-description`}>
              Beschreibung
            </label>
            <textarea
              id={`${fieldId}-description`}
              className={`${styles.input} ${styles.textarea}`}
              rows={5}
              maxLength={TRIP_DESCRIPTION_MAX_LENGTH}
              placeholder="Was geplant ist, was mitzubringen, worauf zu achten — freiwillig."
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
            {errors.description && (
              <p className={styles.error} role="alert">
                {errors.description}
              </p>
            )}
          </div>

          {/* Der Zustand laesst sich nur bei einer bereits gespeicherten
              Reise setzen (req-033); eine neue beginnt auf "In Planung"
              (req-022). Er wird sofort beim Umstellen gespeichert und
              haengt deshalb nicht am Speichern der Eckdaten. */}
          {trip && (
            <div className={styles.field}>
              <span className={styles.label}>Zustand</span>
              <TripStateSelect
                trip={trip}
                onChanged={(state) => onStateChanged(trip.id, state)}
              />
            </div>
          )}
        </div>

        {failed && (
          <p
            className={styles.error}
            role="alert"
            data-testid="trip-save-error"
          >
            Die Reise konnte nicht gespeichert werden. Die Eingaben bleiben
            stehen.
          </p>
        )}

        <div className={styles.formActions}>
          {/* Loeschen bleibt wie in req-017, steht aber seit req-033 hier --
              und nur bei einer Reise, die es schon gibt. */}
          {trip && (
            <button
              type="button"
              className={styles.dangerButton}
              onClick={() => onDelete(trip)}
            >
              Reise löschen
            </button>
          )}
          <span className={styles.actionSpacer} />
          {!trip && (
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={onCancel}
            >
              Abbrechen
            </button>
          )}
          <button
            type="submit"
            className={styles.primaryButton}
            disabled={saving}
          >
            {saving ? "Speichert…" : "Speichern"}
          </button>
        </div>
      </form>
    </section>
  );
}
