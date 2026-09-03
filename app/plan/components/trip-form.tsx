"use client";

import { useEffect, useId, useState } from "react";
import type { MainPlace, Trip } from "@/lib/trips/types";
import type { TripParticipant } from "@/lib/trip-participants/types";
import type { PlaceSuggestion } from "@/lib/osm/place-search";
import { MIN_PLACE_QUERY_LENGTH } from "@/lib/osm/place-search";
import {
  TRIP_TITLE_MAX_LENGTH,
  tripDraftIsValid,
  validateTripDraft,
  type TripDraft,
  type TripFieldErrors,
} from "@/lib/trips/validate";
import { searchPlaceSuggestions } from "@/lib/trips/search-places";
import { saveNewTrip, saveTripChanges } from "@/lib/trips/save-trip";
import styles from "./dialog.module.css";

/** Nominatim verbietet Anfragen im Takt der Tastendruecke — erst nach einer
 *  kurzen Pause wird gesucht (siehe Nominatim-Nutzungsbedingungen). */
const SEARCH_DEBOUNCE_MS = 350;

/**
 * Das Formular zum Anlegen und Aendern einer Reise (siehe req-017). Der
 * Hauptort wird ausschliesslich ueber die Ortssuche erfasst — Koordinaten
 * werden nie von Hand eingegeben.
 */
export function TripForm({
  trip,
  onSaved,
  onClose,
}: {
  /** null legt eine neue Reise an, sonst wird diese geaendert. */
  trip: Trip | null;
  /**
   * Beim Anlegen kommt die Zuordnung des Anlegenden als Reiseleiter mit
   * (req-021); beim Aendern ist sie null.
   */
  onSaved: (trip: Trip, tripParticipant: TripParticipant | null) => void;
  onClose: () => void;
}) {
  const fieldId = useId();
  const [title, setTitle] = useState(trip?.title ?? "");
  const [startDate, setStartDate] = useState(trip?.startDate ?? "");
  const [endDate, setEndDate] = useState(trip?.endDate ?? "");
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

  const heading = trip ? "Reise ändern" : "Neue Reise";

  return (
    <div className={styles.overlay}>
      <div
        className={styles.card}
        role="dialog"
        aria-modal="true"
        aria-label={heading}
      >
        <h2 className={styles.title}>{heading}</h2>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
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

          <div className={styles.dates}>
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

          <div className={styles.actions}>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={onClose}
            >
              Abbrechen
            </button>
            <button
              type="submit"
              className={styles.primaryButton}
              disabled={saving}
            >
              {saving ? "Speichert…" : "Speichern"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
