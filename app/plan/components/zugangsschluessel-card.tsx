"use client";

import { useId, useState } from "react";
import {
  API_KEY_LABEL,
  apiKeyStateText,
  type ApiKeyKind,
  type ApiKeyState,
} from "@/lib/api-keys/types";
import {
  API_KEY_ERRORS,
  removeApiKey,
  saveApiKey,
} from "@/lib/api-keys/save-api-key";
import styles from "./zugangsschluessel-card.module.css";

/**
 * Das Formular einer Zeile: es hinterlegt einen Schluessel oder ersetzt den
 * vorhandenen (req-028). Das Feld verbirgt die Eingabe wie ein Kennwortfeld
 * — was hier steht, ist nach dem Speichern nicht wieder zu sehen.
 */
function KeyForm({
  kind,
  onSaved,
  onFailed,
  onCancel,
}: {
  kind: ApiKeyKind;
  onSaved: (keys: ApiKeyState[]) => void;
  onFailed: () => void;
  onCancel: () => void;
}) {
  const fieldId = useId();
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit() {
    const apiKey = value.trim();
    if (saving || apiKey.length === 0) return;

    setSaving(true);
    const result = await saveApiKey(kind, apiKey);
    setSaving(false);

    if (!result.ok) {
      onFailed();
      return;
    }
    onSaved(result.keys);
  }

  const heading = `Zugangsschlüssel setzen: ${API_KEY_LABEL[kind]}`;

  return (
    <form
      className={styles.form}
      aria-label={heading}
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <label className={styles.label} htmlFor={fieldId}>
        {`Zugangsschlüssel für ${API_KEY_LABEL[kind]}`}
      </label>
      <input
        id={fieldId}
        className={styles.input}
        // Verbirgt die Eingabe wie ein Kennwortfeld (req-028, GUI). Keine
        // Vervollstaendigung durch den Browser: der Schluessel gehoert in den
        // Account, nicht in den Kennwortspeicher des Geraets.
        type="password"
        autoComplete="off"
        value={value}
        onChange={(event) => setValue(event.target.value)}
      />
      <div className={styles.formActions}>
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
          disabled={saving || value.trim().length === 0}
        >
          {saving ? "Speichert…" : "Speichern"}
        </button>
      </div>
    </form>
  );
}

/**
 * Die Karte "Zugangsschluessel" im Bereich "Account" (req-028, seit req-032
 * nicht mehr im Bereich "Einstellungen"): je
 * Account ein eigener Schluessel fuer die KI-Suche und einer fuer den Import
 * aus Google, damit jeder Account seine eigenen Kosten traegt.
 *
 * Ein hinterlegter Schluessel wird nie wieder angezeigt. Sichtbar ist nur,
 * dass er gesetzt ist, und seine letzten vier Zeichen zur Unterscheidung —
 * Ersetzen ist moeglich, Auslesen nicht.
 *
 * Die Karte sieht nur ein Account-Admin (siehe AccountView); die
 * Schnittstelle prueft dasselbe noch einmal serverseitig.
 */
export function ZugangsschluesselCard({
  keys,
  onChange,
}: {
  keys: ApiKeyState[];
  onChange: (keys: ApiKeyState[]) => void;
}) {
  const [editing, setEditing] = useState<ApiKeyKind | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function handleSaved(next: ApiKeyState[]) {
    setNotice(null);
    setEditing(null);
    onChange(next);
  }

  async function handleRemove(kind: ApiKeyKind) {
    setNotice(null);
    const result = await removeApiKey(kind);
    if (!result.ok) {
      setNotice(API_KEY_ERRORS.removeFailed);
      return;
    }
    onChange(result.keys);
  }

  return (
    <section className={styles.card} aria-label="Zugangsschlüssel">
      <h2 className={styles.cardTitle}>Zugangsschlüssel</h2>
      <p className={styles.intro}>
        Die KI-Suche und der Import aus Google rechnen über den hier
        hinterlegten Schlüssel ab. Ohne Schlüssel ist die zugehörige Funktion
        gesperrt.
      </p>
      <ul className={styles.list}>
        {keys.map((state) => (
          <li key={state.kind} className={styles.item}>
            {editing === state.kind ? (
              <KeyForm
                kind={state.kind}
                onSaved={handleSaved}
                onFailed={() => setNotice(API_KEY_ERRORS.failed)}
                onCancel={() => setEditing(null)}
              />
            ) : (
              <div className={styles.row}>
                <div className={styles.rowBody}>
                  <div className={styles.rowName}>
                    {API_KEY_LABEL[state.kind]}
                  </div>
                  <p className={styles.state}>{apiKeyStateText(state)}</p>
                </div>
                <div className={styles.rowActions}>
                  <button
                    type="button"
                    className={styles.actionButton}
                    onClick={() => {
                      setNotice(null);
                      setEditing(state.kind);
                    }}
                  >
                    {state.lastFour === null ? "Setzen" : "Ersetzen"}
                  </button>
                  {/* Entfernen sperrt die zugehoerige Funktion (req-028). */}
                  {state.lastFour !== null && (
                    <button
                      type="button"
                      className={`${styles.actionButton} ${styles.dangerButton}`}
                      aria-label={`Zugangsschlüssel entfernen: ${API_KEY_LABEL[state.kind]}`}
                      onClick={() => void handleRemove(state.kind)}
                    >
                      Entfernen
                    </button>
                  )}
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
      {notice && (
        <p
          className={styles.notice}
          role="alert"
          data-testid="zugangsschluessel-notice"
        >
          {notice}
        </p>
      )}
    </section>
  );
}
