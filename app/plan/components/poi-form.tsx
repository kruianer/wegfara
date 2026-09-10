"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { Poi, PoiPhoto, PoiPosition } from "@/lib/pois/types";
import type { PlaceSuggestion } from "@/lib/osm/place-search";
import {
  MIN_PLACE_QUERY_LENGTH,
  SEARCH_DEBOUNCE_MS,
} from "@/lib/osm/place-search";
import { searchPlaceSuggestions } from "@/lib/trips/search-places";
import { POI_TYPES, POI_TYPE_LABEL } from "@/lib/pois/type-meta";
import { POI_STATUSES, POI_STATUS_LABEL } from "@/lib/pois/status-meta";
import {
  DURATION_STEP_MINUTES,
  POI_ESTIMATED_DURATION_HOURS,
  formatEstimatedDuration,
} from "@/lib/pois/estimated-duration";
import {
  enthaeltWebadresse,
  parseGoogleMapsLink,
} from "@/lib/pois/google-link";
import {
  GOOGLE_LINK_FAILURE_TEXT,
  googleQuelleVonOrt,
  ortAusGoogleLink,
  type PoiGoogleQuelle,
} from "@/lib/pois/google-ort";
import {
  gefuellteFelder,
  googleOrtFuellung,
  ortsvorschlagFuellung,
  type Fuellung,
  type Vorbelegung,
} from "@/lib/pois/formular-fuellen";
import {
  vereinigteFelder,
  type ManualPoiField,
} from "@/lib/pois/manual-fields";
import { apiKeyMissingHint } from "@/lib/api-keys/types";
import { GOOGLE_FOTO_PROBLEM_TEXT } from "@/lib/pois/google-foto-problem";
import { requestBeschreibung } from "@/lib/pois/request-beschreibung";
import {
  POI_ADDRESS_MAX_LENGTH,
  POI_NAME_MAX_LENGTH,
  POI_OPENING_HOURS_MAX_LENGTH,
  POI_PHONE_MAX_LENGTH,
  POI_SHORT_TEXT_MAX_LENGTH,
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
import { ArrowUpIcon, TrashIcon } from "@/components/icons";
import styles from "./poi-form.module.css";

/**
 * Was am Suchfeld zum eingefuegten Google-Maps-Link steht (req-048). Dass
 * gerade nachgeschlagen wird, steht nicht darin: das ergibt sich aus dem
 * Feld selbst (siehe nachschlagLaeuft) und ist damit ab dem Einfuegen zu
 * sehen -- nicht erst, wenn die Anfrage hinausgeht (bug-026).
 */
type Nachschlag =
  | { kind: "ruht" }
  | { kind: "fehler"; text: string }
  | { kind: "uebernommen"; name: string };

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
 * Es beginnt seit req-048 mit einem einzigen Suchfeld, das beides annimmt:
 * einen Suchbegriff, zu dem Vorschlaege erscheinen, oder einen
 * Google-Maps-Link, der ohne Vorschlag abgerufen wird. Beide fuellen die
 * uebrigen Felder und ueberschreiben sie dabei; von Hand aendern laesst sich
 * danach jedes.
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
  vorbelegung = null,
  picking,
  pickedPosition,
  onTogglePicking,
  onSaved,
  onFotoProblem,
  onCancel,
  onDelete,
  hasGoogleKey = false,
  hasAiKey = false,
}: {
  /** null legt einen neuen POI an, sonst wird dieser geaendert. */
  poi: Poi | null;
  tripId: string;
  /**
   * Was die Anlegezeile schon gefunden hat (req-060): die Felder stehen
   * damit gefuellt da, sobald sich das Formular oeffnet -- geaendert wird
   * danach jedes von Hand. Beim Aendern eines vorhandenen POI bleibt sie
   * aussen vor.
   */
  vorbelegung?: Vorbelegung | null;
  /** Ob dieses Formular gerade auf einen Klick in die Karte wartet. */
  picking: boolean;
  /** Die zuletzt auf der Karte angeklickte Position fuer dieses Formular. */
  pickedPosition: PoiPosition | null;
  onTogglePicking: () => void;
  onSaved: (poi: Poi) => void;
  /**
   * Der POI ist gespeichert, seine Bilder aus Google aber nicht (bug-027).
   * Gemeldet wird das ausserhalb des Formulars: beim Anlegen schliesst es
   * sich mit dem Speichern, eine Meldung darin waere nie zu lesen. null
   * loescht eine vorherige Meldung -- beim naechsten Mal ging es ja gut.
   */
  onFotoProblem?: (text: string | null) => void;
  onCancel: () => void;
  /** Oeffnet die Rueckfrage vor dem Entfernen -- nur bei einem vorhandenen POI. */
  onDelete: (poi: Poi) => void;
  /**
   * Ob der Account einen Zugangsschluessel fuer Google hat (req-028). Ohne
   * ihn wird ein eingefuegter Link nicht abgerufen; das Suchfeld weist
   * darauf hin (req-048). Die Suche nach einem Begriff laeuft weiter.
   */
  hasGoogleKey?: boolean;
  /**
   * Ob der Account einen Zugangsschluessel fuer die KI hat (req-028). Ohne
   * ihn erscheint der Knopf "Beschreibung vorschlagen" gar nicht erst
   * (req-058) -- man klickt nie auf etwas, das nicht gehen kann.
   */
  hasAiKey?: boolean;
}) {
  const fieldId = useId();
  const [input, setInput] = useState<PoiInput>(
    poi ? poiToInput(poi) : { ...emptyPoiInput(), ...vorbelegung?.fuellung },
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
  const [nachschlag, setNachschlag] = useState<Nachschlag>({ kind: "ruht" });
  // Was das Suchfeld gefuellt hat, und der Google-Ort dahinter (req-048).
  // Beides geht beim Speichern mit: Gefuelltes gilt nicht als von Hand
  // geaendert, und der Ort bei Google gehoert zum POI.
  // Was die Anlegezeile gefuellt hat, zaehlt wie hier Gefuelltes: nicht als
  // von Hand geaendert, und ihr Google-Ort gehoert zum POI (req-060).
  const [autoFilled, setAutoFilled] = useState<ManualPoiField[]>(
    vorbelegung ? gefuellteFelder(vorbelegung.fuellung) : [],
  );
  const [googleQuelle, setGoogleQuelle] = useState<PoiGoogleQuelle | null>(
    vorbelegung?.google ?? null,
  );

  const [photos, setPhotos] = useState<PoiPhoto[]>(poi?.photos ?? []);
  const [photoProblem, setPhotoProblem] = useState<string | null>(null);
  /** Laeuft gerade ein Vorschlag fuer die Beschreibung (req-058)? */
  const [beschreibungLaeuft, setBeschreibungLaeuft] = useState(false);
  const [beschreibungProblem, setBeschreibungProblem] = useState<string | null>(
    null,
  );
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
      // Selbst auf der Karte gesetzt zaehlt wie selbst getippt (req-048).
      setAutoFilled((bisher) => bisher.filter((feld) => feld !== "position"));
    }
  }

  // Ein eingefuegter Google-Maps-Link wird abgerufen statt vorgeschlagen
  // (req-048) -- zu ihm erscheint deshalb nie eine Vorschlagsliste.
  const istLink = parseGoogleMapsLink(placeQuery) !== null;
  // Eine andere Webadresse ist weder Link noch Suchbegriff: danach zu suchen
  // waere sinnlos, also sagt das Feld, woran es liegt.
  const fremderLink = !istLink && enthaeltWebadresse(placeQuery);
  const suggestions =
    !istLink && !fremderLink && found.query === placeQuery ? found.places : [];
  // Ein erkannter Link ist vom Einfuegen an in Arbeit -- erst die kurze
  // Wartezeit, dann die Anfrage (bug-026). Ein Link, auf den sekundenlang
  // nichts hin geschieht, sieht aus wie einer, den niemand bemerkt hat.
  const nachschlagLaeuft =
    istLink && hasGoogleKey && nachschlag.kind === "ruht";

  /**
   * Schreibt eine Fuellung in die Felder (req-048): was die Quelle kennt,
   * wird ueberschrieben, alles Uebrige bleibt stehen. Das Gefuellte gilt
   * nicht als von Hand geaendert.
   */
  const uebernimm = useCallback((fuellung: Fuellung) => {
    setInput((current) => ({ ...current, ...fuellung }));
    setAutoFilled((bisher) =>
      vereinigteFelder(bisher, gefuellteFelder(fuellung)),
    );
  }, []);

  useEffect(() => {
    if (parseGoogleMapsLink(placeQuery) === null) {
      if (enthaeltWebadresse(placeQuery)) return;
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
    }

    // Ohne Zugangsschluessel wird gar nicht erst angefragt (req-028); am
    // Feld steht dann der Hinweis darauf.
    if (!hasGoogleKey) return;

    let abandoned = false;
    const timer = setTimeout(async () => {
      const outcome = await ortAusGoogleLink(placeQuery);
      if (abandoned) return;

      if (outcome.result === "fehler") {
        // Die uebrigen Felder bleiben stehen, das Formular offen (req-048).
        setNachschlag({
          kind: "fehler",
          text: GOOGLE_LINK_FAILURE_TEXT[outcome.reason],
        });
        return;
      }

      const fuellung = googleOrtFuellung(outcome.ort);
      uebernimm(fuellung);
      setGoogleQuelle(googleQuelleVonOrt(outcome.ort));
      setNachschlag({ kind: "uebernommen", name: outcome.ort.name });
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      abandoned = true;
      clearTimeout(timer);
    };
  }, [placeQuery, hasGoogleKey, uebernimm]);

  function set<K extends keyof PoiInput>(field: K, value: PoiInput[K]) {
    setInput((current) => ({ ...current, [field]: value }));
    // Von Hand getippt: ab jetzt bleibt es beim Auffrischen stehen (req-048).
    setAutoFilled((bisher) => bisher.filter((feld) => feld !== field));
  }

  /**
   * Ein gewaehlter Vorschlag fuellt Name, Typ, Adresse und Position, soweit
   * OpenStreetMap sie kennt (req-048) -- und ueberschreibt sie dabei. Den
   * Ort setzt er nicht: er wird beim Speichern abgeleitet (req-041).
   */
  function choosePlace(place: PlaceSuggestion) {
    uebernimm(ortsvorschlagFuellung(place));
    setPlaceQuery("");
    setFound({ query: "", places: [] });
    setNachschlag({ kind: "ruht" });
  }

  async function submit() {
    if (saving) return;

    const gefunden = validatePoiInput(input);
    setErrors(gefunden);
    setFailed(false);
    if (Object.keys(gefunden).length > 0) return;

    setSaving(true);
    // Die Herkunft geht mit (req-048): Gefuelltes gilt nicht als von Hand
    // geaendert, und der Ort bei Google gehoert zum gespeicherten POI.
    const herkunft = { autoFilled, google: googleQuelle };
    const ergebnis = poi
      ? await savePoiChanges(poi.id, input, herkunft)
      : await saveNewPoi(tripId, input, herkunft);
    setSaving(false);

    if (!ergebnis) {
      setFailed(true);
      return;
    }

    const gespeichert = ergebnis.poi;
    // Der POI steht, seine Bilder aus Google nicht -- das gehoert gesagt
    // (bug-027). Die Meldung geht nach oben: beim Anlegen schliesst sich
    // dieses Formular gleich, die Liste dahinter bleibt.
    onFotoProblem?.(
      ergebnis.fotoProblem
        ? GOOGLE_FOTO_PROBLEM_TEXT[ergebnis.fotoProblem]
        : null,
    );

    // Gespeichert ist gespeichert: ein zweites Speichern holt die Fotos bei
    // Google nicht noch einmal, und der Vergleich mit dem Stand in der
    // Datenbank trägt die Herkunft von hier an selbst.
    setAutoFilled([]);
    setGoogleQuelle(null);
    // Fotos aus Google entstehen erst beim Speichern -- was von dort
    // zurueckkommt, ist der neue Stand.
    const fotos = gespeichert.photos?.length ? gespeichert.photos : photos;
    setPhotos(fotos);
    onSaved({ ...gespeichert, photos: fotos });
  }

  /** Meldet die neue Bilderfolge zugleich an die Liste -- das erste steht in der Zeile. */
  /**
   * Holt einen Vorschlag fuer Kurz- und Langtext (req-058). Er landet in den
   * Feldern und ist dort aenderbar. Kommt keiner, sagt das Formular es --
   * ein stiller Fehlschlag sieht sonst aus wie "die KI weiss nichts dazu"
   * (bug-021).
   */
  async function beschreibungVorschlagen() {
    setBeschreibungProblem(null);
    setBeschreibungLaeuft(true);
    const vorschlag = await requestBeschreibung({
      name: input.name.trim(),
      type: input.type,
      ort: input.ort,
      address: input.address,
    });
    setBeschreibungLaeuft(false);

    if (!vorschlag) {
      setBeschreibungProblem(
        "Es konnte keine Beschreibung geholt werden. Bitte später erneut versuchen.",
      );
      return;
    }

    setInput((current) => ({
      ...current,
      shortText: vorschlag.shortText,
      longText: vorschlag.longText,
    }));
  }

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

        {/* Das eine Suchfeld am Anfang (req-048): es nimmt einen Suchbegriff
            an -- dann erscheinen Vorschläge -- oder einen Google-Maps-Link,
            der ohne Vorschlag abgerufen wird. Beides füllt die übrigen
            Felder und überschreibt sie dabei. */}
        <div className={`${styles.field} ${styles.fieldWide}`}>
          <label className={styles.label} htmlFor={`${fieldId}-suche`}>
            Ort suchen oder Google-Maps-Link einfügen
          </label>
          <input
            id={`${fieldId}-suche`}
            className={styles.input}
            type="text"
            autoComplete="off"
            placeholder="z.B. Villa Rufolo Ravello"
            value={placeQuery}
            onChange={(event) => {
              setPlaceQuery(event.target.value);
              setNachschlag({ kind: "ruht" });
            }}
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
          {/* Ohne Zugangsschlüssel wird ein Link nicht abgerufen (req-028);
              die Suche nach einem Begriff läuft weiter. */}
          {istLink && !hasGoogleKey && (
            <p className={styles.hint} data-testid="poi-suche-kein-schluessel">
              {apiKeyMissingHint("google")}
            </p>
          )}
          {nachschlagLaeuft && (
            <p className={styles.hint} data-testid="poi-suche-laeuft">
              Schlägt bei Google nach…
            </p>
          )}
          {(nachschlag.kind === "fehler" || fremderLink) && (
            <p
              className={styles.error}
              role="alert"
              data-testid="poi-suche-fehler"
            >
              {nachschlag.kind === "fehler"
                ? nachschlag.text
                : GOOGLE_LINK_FAILURE_TEXT.kein_google_link}
            </p>
          )}
          {nachschlag.kind === "uebernommen" && (
            <p className={styles.hint} data-testid="poi-suche-uebernommen">
              „{nachschlag.name}“ übernommen. Jedes Feld bleibt änderbar.
            </p>
          )}
        </div>

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

        {/* Wie lange man bleiben will (req-058). Leer heisst "nicht
            eingetragen" -- dann gilt die geschaetzte Dauer des Typs, die
            unter dem Feld steht. */}
        <div className={styles.field}>
          <label className={styles.label} htmlFor={`${fieldId}-duration`}>
            Dauer
          </label>
          <input
            id={`${fieldId}-duration`}
            className={styles.input}
            type="number"
            inputMode="numeric"
            min={DURATION_STEP_MINUTES}
            step={DURATION_STEP_MINUTES}
            placeholder={String(POI_ESTIMATED_DURATION_HOURS[input.type] * 60)}
            value={input.durationMinutes}
            onChange={(event) => set("durationMinutes", event.target.value)}
          />
          {errors.durationMinutes ? (
            <p className={styles.error}>{errors.durationMinutes}</p>
          ) : (
            <p className={styles.hint}>
              In Minuten, in Schritten von {DURATION_STEP_MINUTES}. Leer heißt:
              es gilt die geschätzte Dauer des Typs (
              {formatEstimatedDuration(input.type)}).
            </p>
          )}
        </div>

        {/* Die Beschreibung, die beim Sammeln notiert wird (req-044): der
            Kurztext steht auch in der POI-Zeile, deshalb ist er begrenzt --
            der Langtext ist es nicht. */}
        <div className={`${styles.field} ${styles.fieldWide}`}>
          <label className={styles.label} htmlFor={`${fieldId}-short-text`}>
            Kurztext
          </label>
          <input
            id={`${fieldId}-short-text`}
            className={styles.input}
            type="text"
            autoComplete="off"
            maxLength={POI_SHORT_TEXT_MAX_LENGTH}
            value={input.shortText}
            onChange={(event) => set("shortText", event.target.value)}
          />
          {errors.shortText && (
            <p className={styles.error} role="alert">
              {errors.shortText}
            </p>
          )}
        </div>

        <div className={`${styles.field} ${styles.fieldWide}`}>
          <label className={styles.label} htmlFor={`${fieldId}-long-text`}>
            Langtext
          </label>
          <textarea
            id={`${fieldId}-long-text`}
            className={`${styles.input} ${styles.textarea}`}
            rows={4}
            value={input.longText}
            onChange={(event) => set("longText", event.target.value)}
          />
          {/* Der Vorschlag der KI (req-058): nur auf Knopfdruck, weil jeder
              Lauf ueber den Zugangsschluessel des Accounts kostet. Ohne
              Schluessel erscheint der Knopf gar nicht erst. */}
          {hasAiKey && (
            <>
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={() => void beschreibungVorschlagen()}
                disabled={beschreibungLaeuft || input.name.trim().length === 0}
              >
                {beschreibungLaeuft
                  ? "Wird geholt …"
                  : "Beschreibung vorschlagen"}
              </button>
              {beschreibungProblem && (
                <p role="alert" className={styles.error}>
                  {beschreibungProblem}
                </p>
              )}
            </>
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

        {/* Der Ort wird nicht eingegeben, sondern beim Speichern aus Adresse
            oder Position abgeleitet (req-041) -- das Feld zeigt nur an, was
            zuletzt abgeleitet wurde. Es steht seit req-044 unter der Adresse,
            aus der es entsteht. */}
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

        {/* Die Position kommt aus dem Suchfeld am Anfang (req-048) oder aus
            einem Klick auf die Karte, für Orte ohne eigenen Namen (req-035).
            Sie steht seit req-044 unter der Adresse: meistens ergibt sie
            sich aus ihr. */}
        <div className={`${styles.field} ${styles.fieldWide}`}>
          <span className={styles.label}>Position</span>
          {/* Der Schalter entscheidet, ob ein Klick auf die Karte die
              Position setzt (req-044). Ohne ihn verstellte jeder Klick beim
              Verschieben der Karte versehentlich die Position; nach einem
              gesetzten Klick schaltet er sich wieder aus. */}
          <div className={styles.positionRow}>
            <button
              type="button"
              className={`${styles.pickButton} ${
                picking ? styles.pickButtonActive : ""
              }`}
              aria-label="Position auf der Karte setzen"
              aria-pressed={picking}
              onClick={onTogglePicking}
            >
              {picking ? "Klick abwarten…" : "Position auf der Karte setzen"}
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
