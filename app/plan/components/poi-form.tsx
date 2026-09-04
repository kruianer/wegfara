"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { Poi, PoiPhoto, PoiPosition } from "@/lib/pois/types";
import type { PlaceSuggestion } from "@/lib/osm/place-search";
import { MIN_PLACE_QUERY_LENGTH } from "@/lib/osm/place-search";
import { searchPlaceSuggestions } from "@/lib/trips/search-places";
import { POI_TYPES, POI_TYPE_LABEL } from "@/lib/pois/type-meta";
import { POI_STATUSES, POI_STATUS_LABEL } from "@/lib/pois/status-meta";
import {
  POI_ADDRESS_MAX_LENGTH,
  POI_NAME_MAX_LENGTH,
  POI_OPENING_HOURS_MAX_LENGTH,
  POI_PHONE_MAX_LENGTH,
  POI_WEB_MAX_LENGTH,
  emptyPoiInput,
  poiToInput,
  validatePoiInput,
  type PoiFieldErrors,
  type PoiInput,
} from "@/lib/pois/validate";
import {
  removePoiPhoto,
  reorderPoiPhotos,
  saveNewPoi,
  savePoiChanges,
  uploadPoiPhoto,
} from "@/lib/pois/save-poi";
import { ArrowUpIcon, TrashIcon } from "./icons";
import styles from "./poi-form.module.css";

/** Nominatim verbietet Anfragen im Takt der Tastendruecke (siehe req-017). */
const SEARCH_DEBOUNCE_MS = 350;

function photoUrl(photoId: string): string {
  return `/api/poi-fotos/${photoId}`;
}

function formatPosition(position: PoiPosition): string {
  return `${position.lat.toFixed(5)}, ${position.lng.toFixed(5)}`;
}

/**
 * Das Formular zum Anlegen und Aendern eines POI (req-035). Es steht in der
 * Liste selbst -- beim Anlegen als neue Zeile oben, beim Aendern als
 * aufgeklappte Zeile -- damit die Karte daneben sichtbar bleibt und sich
 * die Position setzen laesst.
 *
 * Aenderbar sind alle Angaben ausser der Nummer: sie bleibt nach der
 * Vergabe fest, denn ueber sie wird in der Gruppe und auf der Karte
 * gesprochen (req-013).
 *
 * Die Bilder gehoeren zu einem POI, den es schon gibt: sie werden sofort
 * hochgeladen, entfernt und umsortiert -- nicht erst beim Speichern des
 * Formulars.
 */
export function PoiForm({
  poi,
  tripId,
  picking,
  pickedPosition,
  onTogglePicking,
  onSaved,
  onCancel,
  onDelete,
}: {
  /** null legt einen neuen POI an, sonst wird dieser geaendert. */
  poi: Poi | null;
  tripId: string;
  /** Ob dieses Formular gerade auf einen Klick in die Karte wartet. */
  picking: boolean;
  /** Die zuletzt auf der Karte angeklickte Position fuer dieses Formular. */
  pickedPosition: PoiPosition | null;
  onTogglePicking: () => void;
  onSaved: (poi: Poi) => void;
  onCancel: () => void;
  /** Oeffnet die Rueckfrage vor dem Entfernen -- nur bei einem vorhandenen POI. */
  onDelete: (poi: Poi) => void;
}) {
  const fieldId = useId();
  const [input, setInput] = useState<PoiInput>(
    poi ? poiToInput(poi) : emptyPoiInput(),
  );
  const [errors, setErrors] = useState<PoiFieldErrors>({});
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  const [placeQuery, setPlaceQuery] = useState("");
  // Das Ergebnis der Ortssuche samt der Eingabe, zu der es gehoert -- so
  // verschwinden veraltete Vorschlaege beim Weitertippen von selbst.
  const [found, setFound] = useState<{
    query: string;
    places: PlaceSuggestion[];
  }>({ query: "", places: [] });

  const [photos, setPhotos] = useState<PoiPhoto[]>(poi?.photos ?? []);
  const [photoProblem, setPhotoProblem] = useState<string | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const busy = useRef(false);

  // Eine auf der Karte gesetzte Position waehrend des Renderns uebernehmen
  // (siehe react.dev/learn/you-might-not-need-an-effect) -- die Karte ist
  // eine Schwester dieses Formulars, ihr Klick kommt von aussen herein.
  const [syncedPick, setSyncedPick] = useState(pickedPosition);
  if (pickedPosition !== syncedPick) {
    setSyncedPick(pickedPosition);
    if (pickedPosition) {
      setInput((current) => ({ ...current, position: pickedPosition }));
    }
  }

  const suggestions = found.query === placeQuery ? found.places : [];

  useEffect(() => {
    if (placeQuery.trim().length < MIN_PLACE_QUERY_LENGTH) return;

    let abandoned = false;
    const timer = setTimeout(async () => {
      const places = await searchPlaceSuggestions(placeQuery);
      if (!abandoned) setFound({ query: placeQuery, places });
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      abandoned = true;
      clearTimeout(timer);
    };
  }, [placeQuery]);

  function set<K extends keyof PoiInput>(field: K, value: PoiInput[K]) {
    setInput((current) => ({ ...current, [field]: value }));
  }

  /**
   * Ein gewaehlter Vorschlag setzt Position und Adresse, soweit
   * OpenStreetMap sie kennt (req-035). Den Ort setzt er nicht mehr: er wird
   * beim Speichern abgeleitet (req-041). Der Name wird nur ergaenzt, wenn
   * noch keiner dasteht -- eine eigene Benennung bleibt stehen.
   */
  function choosePlace(place: PlaceSuggestion) {
    setInput((current) => ({
      ...current,
      name: current.name.trim().length > 0 ? current.name : place.name,
      address: place.address.length > 0 ? place.address : current.address,
      position: { lat: place.lat, lng: place.lng },
    }));
    setPlaceQuery("");
    setFound({ query: "", places: [] });
  }

  async function submit() {
    if (saving) return;

    const gefunden = validatePoiInput(input);
    setErrors(gefunden);
    setFailed(false);
    if (Object.keys(gefunden).length > 0) return;

    setSaving(true);
    const gespeichert = poi
      ? await savePoiChanges(poi.id, input)
      : await saveNewPoi(tripId, input);
    setSaving(false);

    if (!gespeichert) {
      setFailed(true);
      return;
    }
    onSaved({ ...gespeichert, photos });
  }

  /** Meldet die neue Bilderfolge zugleich an die Liste -- das erste steht in der Zeile. */
  function uebernehmeFotos(neue: PoiPhoto[]) {
    setPhotos(neue);
    if (poi) onSaved({ ...poi, photos: neue });
  }

  async function fotoHinzufuegen(file: File | undefined) {
    if (!file || !poi || busy.current) return;
    busy.current = true;
    setPhotoBusy(true);
    setPhotoProblem(null);

    const result = await uploadPoiPhoto(poi.id, file);
    busy.current = false;
    setPhotoBusy(false);
    if (!result.ok) {
      setPhotoProblem(result.error);
      return;
    }
    uebernehmeFotos(result.photos);
  }

  async function fotoEntfernen(photoId: string) {
    if (!poi || busy.current) return;
    busy.current = true;
    setPhotoBusy(true);
    setPhotoProblem(null);

    const neue = await removePoiPhoto(photoId);
    busy.current = false;
    setPhotoBusy(false);
    if (!neue) {
      setPhotoProblem("Das Bild konnte nicht entfernt werden.");
      return;
    }
    uebernehmeFotos(neue);
  }

  async function fotoNachVorn(index: number) {
    if (!poi || index === 0 || busy.current) return;
    const folge = photos.map((photo) => photo.id);
    [folge[index - 1], folge[index]] = [folge[index], folge[index - 1]];

    busy.current = true;
    setPhotoBusy(true);
    setPhotoProblem(null);
    // Sofort anzeigen; die Reihenfolge gilt schon, waehrend sie gespeichert wird.
    uebernehmeFotos(
      folge.map((id, position) => ({ id, position: position + 1 })),
    );

    const neue = await reorderPoiPhotos(poi.id, folge);
    busy.current = false;
    setPhotoBusy(false);
    if (!neue) {
      setPhotoProblem("Die Reihenfolge konnte nicht gespeichert werden.");
      return;
    }
    uebernehmeFotos(neue);
  }

  return (
    <form
      className={`${styles.form} ${poi ? "" : styles.formStandalone}`}
      aria-label={poi ? `POI ändern: ${poi.name}` : "POI anlegen"}
      data-testid={poi ? `poi-form-${poi.id}` : "poi-form-neu"}
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <div className={styles.fields}>
        {poi && (
          <div className={styles.field}>
            <span className={styles.label}>Nummer</span>
            <p className={styles.number} data-testid="poi-form-number">
              #{poi.number}
            </p>
            <p className={styles.hint}>
              Die Nummer bleibt fest — über sie wird in der Gruppe und auf der
              Karte gesprochen.
            </p>
          </div>
        )}

        <div className={styles.field}>
          <label className={styles.label} htmlFor={`${fieldId}-name`}>
            Name
          </label>
          <input
            id={`${fieldId}-name`}
            className={styles.input}
            type="text"
            autoComplete="off"
            maxLength={POI_NAME_MAX_LENGTH}
            value={input.name}
            onChange={(event) => set("name", event.target.value)}
          />
          {errors.name && (
            <p className={styles.error} role="alert">
              {errors.name}
            </p>
          )}
        </div>

        {/* Der Ort wird nicht eingegeben, sondern beim Speichern aus Adresse
            oder Position abgeleitet (req-041) -- das Feld zeigt nur an, was
            zuletzt abgeleitet wurde. */}
        <div className={styles.field}>
          <label className={styles.label} htmlFor={`${fieldId}-ort`}>
            Ort
          </label>
          <input
            id={`${fieldId}-ort`}
            className={styles.input}
            type="text"
            readOnly
            value={input.ort}
          />
          <p className={styles.hint}>
            Wird beim Speichern aus der Adresse ermittelt — ohne Adresse aus der
            Position.
          </p>
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor={`${fieldId}-type`}>
            Typ
          </label>
          <select
            id={`${fieldId}-type`}
            className={`${styles.input} ${styles.select}`}
            value={input.type}
            onChange={(event) =>
              set("type", event.target.value as PoiInput["type"])
            }
          >
            {POI_TYPES.map((type) => (
              <option key={type} value={type}>
                {POI_TYPE_LABEL[type]}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor={`${fieldId}-status`}>
            Status
          </label>
          <select
            id={`${fieldId}-status`}
            className={`${styles.input} ${styles.select}`}
            value={input.status}
            onChange={(event) =>
              set("status", event.target.value as PoiInput["status"])
            }
          >
            {POI_STATUSES.map((status) => (
              <option key={status} value={status}>
                {POI_STATUS_LABEL[status]}
              </option>
            ))}
          </select>
        </div>

        {/* Die Position auf zwei Wegen: über die Ortssuche mit Vorschlägen
            oder mit einem Klick auf die Karte, für Orte ohne eigenen Namen
            (req-035). */}
        <div className={`${styles.field} ${styles.fieldWide}`}>
          <label className={styles.label} htmlFor={`${fieldId}-place`}>
            Position
          </label>
          <input
            id={`${fieldId}-place`}
            className={styles.input}
            type="text"
            autoComplete="off"
            placeholder="Ort suchen, z.B. Villa Rufolo Ravello"
            value={placeQuery}
            onChange={(event) => setPlaceQuery(event.target.value)}
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
                    <span className={styles.suggestionName}>{place.name}</span>
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
          <div className={styles.positionRow}>
            <button
              type="button"
              className={`${styles.pickButton} ${
                picking ? styles.pickButtonActive : ""
              }`}
              aria-pressed={picking}
              onClick={onTogglePicking}
            >
              {picking ? "Klick abwarten…" : "Auf der Karte setzen"}
            </button>
            <span
              className={styles.positionValue}
              data-testid="poi-form-position"
            >
              {input.position
                ? formatPosition(input.position)
                : "Noch keine Position"}
            </span>
          </div>
          {errors.position && (
            <p className={styles.error} role="alert">
              {errors.position}
            </p>
          )}
        </div>

        <div className={`${styles.field} ${styles.fieldWide}`}>
          <label className={styles.label} htmlFor={`${fieldId}-address`}>
            Adresse
          </label>
          <input
            id={`${fieldId}-address`}
            className={styles.input}
            type="text"
            autoComplete="off"
            maxLength={POI_ADDRESS_MAX_LENGTH}
            value={input.address}
            onChange={(event) => set("address", event.target.value)}
          />
          {errors.address && (
            <p className={styles.error} role="alert">
              {errors.address}
            </p>
          )}
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor={`${fieldId}-web`}>
            Webseite
          </label>
          <input
            id={`${fieldId}-web`}
            className={styles.input}
            type="text"
            autoComplete="off"
            maxLength={POI_WEB_MAX_LENGTH}
            value={input.web}
            onChange={(event) => set("web", event.target.value)}
          />
          {errors.web && (
            <p className={styles.error} role="alert">
              {errors.web}
            </p>
          )}
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor={`${fieldId}-phone`}>
            Telefonnummer
          </label>
          <input
            id={`${fieldId}-phone`}
            className={styles.input}
            type="text"
            autoComplete="off"
            maxLength={POI_PHONE_MAX_LENGTH}
            value={input.phone}
            onChange={(event) => set("phone", event.target.value)}
          />
          {errors.phone && (
            <p className={styles.error} role="alert">
              {errors.phone}
            </p>
          )}
        </div>

        <div className={`${styles.field} ${styles.fieldWide}`}>
          <label className={styles.label} htmlFor={`${fieldId}-hours`}>
            Öffnungszeiten
          </label>
          <textarea
            id={`${fieldId}-hours`}
            className={`${styles.input} ${styles.textarea}`}
            rows={4}
            maxLength={POI_OPENING_HOURS_MAX_LENGTH}
            placeholder="Eine Zeile je Wochentag — freiwillig."
            value={input.openingHours}
            onChange={(event) => set("openingHours", event.target.value)}
          />
          {errors.openingHours && (
            <p className={styles.error} role="alert">
              {errors.openingHours}
            </p>
          )}
        </div>

        {/* Bilder gehören zu einem POI, den es schon gibt -- sie werden
            sofort abgelegt, nicht erst beim Speichern (req-035). */}
        <div className={`${styles.field} ${styles.fieldWide}`}>
          <span className={styles.label}>Bilder</span>
          {poi ? (
            <>
              {photos.length > 0 && (
                <ul
                  className={styles.photos}
                  aria-label={`Bilder von ${poi.name}`}
                >
                  {photos.map((photo, index) => (
                    <li key={photo.id} className={styles.photoCard}>
                      {/* Die Datei liegt im Bildverzeichnis außerhalb des
                          Repos und geht über /api/poi-fotos heraus, nicht
                          über den Bild-Optimierer von Next. */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        className={styles.photo}
                        src={photoUrl(photo.id)}
                        alt={`Bild ${index + 1} von ${poi.name}`}
                      />
                      <div className={styles.photoActions}>
                        <button
                          type="button"
                          className={styles.iconButton}
                          aria-label={`Bild ${index + 1} nach vorn`}
                          disabled={index === 0 || photoBusy}
                          onClick={() => void fotoNachVorn(index)}
                        >
                          <ArrowUpIcon />
                        </button>
                        <button
                          type="button"
                          className={`${styles.iconButton} ${styles.danger}`}
                          aria-label={`Bild ${index + 1} entfernen`}
                          disabled={photoBusy}
                          onClick={() => void fotoEntfernen(photo.id)}
                        >
                          <TrashIcon />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <div className={styles.photoAdd}>
                {/* Zwei Wege, dieselbe Ablage: eine Datei vom Gerät oder ein
                    Foto mit der Kamera (req-035). */}
                <label
                  className={styles.uploadButton}
                  htmlFor={`${fieldId}-bild`}
                >
                  Bild hinzufügen
                </label>
                <input
                  id={`${fieldId}-bild`}
                  className={styles.hiddenInput}
                  type="file"
                  accept="image/*"
                  aria-label="Bild hinzufügen"
                  disabled={photoBusy}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    void fotoHinzufuegen(file);
                  }}
                />
                <label
                  className={styles.uploadButton}
                  htmlFor={`${fieldId}-kamera`}
                >
                  Fotografieren
                </label>
                <input
                  id={`${fieldId}-kamera`}
                  className={styles.hiddenInput}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  aria-label="Fotografieren"
                  disabled={photoBusy}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    void fotoHinzufuegen(file);
                  }}
                />
              </div>
              {photoProblem && (
                <p
                  className={styles.error}
                  role="alert"
                  data-testid="poi-foto-hinweis"
                >
                  {photoProblem}
                </p>
              )}
            </>
          ) : (
            <p className={styles.hint}>
              Bilder lassen sich hinzufügen, sobald der POI angelegt ist.
            </p>
          )}
        </div>
      </div>

      {failed && (
        <p className={styles.error} role="alert" data-testid="poi-save-error">
          Der POI konnte nicht gespeichert werden. Die Eingaben bleiben stehen.
        </p>
      )}

      <div className={styles.actions}>
        {poi && (
          <button
            type="button"
            className={styles.dangerButton}
            onClick={() => onDelete(poi)}
          >
            POI löschen
          </button>
        )}
        <span className={styles.actionSpacer} />
        <button
          type="button"
          className={styles.secondaryButton}
          onClick={onCancel}
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
  );
}
