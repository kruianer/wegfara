"use client";

import { useEffect, useId, useState } from "react";
import type { Activity } from "@/lib/activities/types";
import type { Transfer, TransferMode } from "@/lib/transfers/types";
import { TRANSFER_MODES } from "@/lib/transfers/types";
import { TRANSFER_MODE_LABEL } from "@/lib/transfers/type-meta";
import { lueckeMinuten, zeitreichtNichtHinweis } from "@/lib/transfers/luecke";
import {
  OHNE_VORSCHLAG_HINWEIS,
  routenprofilFuer,
} from "@/lib/transfers/routenprofil";
import {
  ladeTransferVorschlag,
  removeTransfer,
  saveNewTransfer,
  saveTransferChanges,
  type VorschlagGrund,
} from "@/lib/transfers/save-transfer";
import type { TransferVorschlag } from "@/lib/transfers/vorschlag";
import {
  emptyTransferInput,
  transferToInput,
  validateTransferInput,
  withStreckenangaben,
  type TransferFieldErrors,
  type TransferInput,
} from "@/lib/transfers/validate";
import dialogStyles from "@/components/dialog.module.css";
import styles from "./transfer-form.module.css";

/**
 * Das Formular fuer den Transfer zwischen zwei Programmpunkten (req-052).
 * Beim Anlegen steht bereits ein Vorschlag darin -- Verkehrsmittel, Dauer und
 * Strecke aus der tatsaechlichen Route; wer das Verkehrsmittel wechselt,
 * bekommt Dauer und Strecke dafuer neu vorgeschlagen, gerechnet mit dessen
 * eigenem Profil (req-059). Aenderbar ist alles.
 *
 * Fuer Boot, Flug, Bahn und Faehre gibt es keinen Streckenvorschlag: dort
 * bleiben Dauer und Strecke leer, und ein Hinweis sagt es.
 *
 * Ohne Vorschlag (fehlende Position, stummer Routing-Dienst) nennt ein
 * Hinweis den Grund, und die Angaben werden selbst eingetragen. Reicht die
 * Zeit zwischen den beiden Programmpunkten nicht, wird der Transfer trotzdem
 * angelegt -- umgeplant wird nichts von selbst (siehe vision.md).
 */
export function TransferForm({
  fromActivity,
  toActivity,
  transfer,
  onSaved,
  onRemoved,
  onCancel,
}: {
  fromActivity: Activity;
  toActivity: Activity;
  /** null legt einen neuen Transfer an, sonst wird dieser geaendert. */
  transfer: Transfer | null;
  onSaved: (transfer: Transfer) => void;
  onRemoved: (transfer: Transfer) => void;
  onCancel: () => void;
}) {
  const fieldId = useId();
  const [input, setInput] = useState<TransferInput>(() =>
    transfer ? transferToInput(transfer) : emptyTransferInput(toActivity.title),
  );
  const [errors, setErrors] = useState<TransferFieldErrors>({});
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const [vorschlag, setVorschlag] = useState<TransferVorschlag | null>(null);
  // Warum es keinen Vorschlag gibt; null heisst: es gibt einen (oder er wird
  // noch geholt).
  const [grund, setGrund] = useState<VorschlagGrund | null>(
    fehlendePosition(fromActivity, toActivity) ? "ohne_position" : null,
  );
  const [holt, setHolt] = useState(!transfer && !grund);

  // Boot, Flug, Bahn und Faehre faehrt kein Routing-Dienst aus (req-059).
  const ohneStreckenvorschlag = routenprofilFuer(input.mode) === null;
  // Die Wegbeschreibung gilt fuer das gewaehlte Verkehrsmittel (req-059).
  const wegzeilen = vorschlag?.proMittel[input.mode]?.wegbeschreibung ?? [];
  const luecke = lueckeMinuten(fromActivity, toActivity);
  const zeitHinweis = zeitreichtNichtHinweis(
    luecke,
    Number(input.durationMin.replace(",", ".")),
  );

  useEffect(() => {
    // Ohne Position gibt es nichts zu holen -- das steht schon fest
    // (req-052). Ein vorhandener Transfer bringt seine Angaben selbst mit;
    // sein Vorschlag wird erst beim Wechsel des Verkehrsmittels gebraucht.
    if (fehlendePosition(fromActivity, toActivity)) return;

    let verworfen = false;
    void (async () => {
      const antwort = await ladeTransferVorschlag(
        fromActivity.id,
        toActivity.id,
      );
      if (verworfen) return;

      const gefunden = antwort.vorschlag;
      setVorschlag(gefunden);
      setGrund(antwort.grund);
      setHolt(false);
      // Ein vorhandener Transfer behaelt seine Angaben -- geaendert wird er
      // vom Nutzer, nicht vom Vorschlag.
      if (!transfer && gefunden) {
        setInput((current) => uebernimm(current, gefunden.mode, gefunden));
      }
    })();

    return () => {
      verworfen = true;
    };
  }, [fromActivity, toActivity, transfer]);

  /** Verkehrsmittel wechseln: Dauer und Strecke werden dafuer neu vorgeschlagen. */
  function waehleVerkehrsmittel(mode: TransferMode) {
    setInput((current) => uebernimm(current, mode, vorschlag));
  }

  async function speichern() {
    if (saving) return;

    const { values, errors: gefunden } = validateTransferInput(input);
    setErrors(gefunden);
    if (!values) return;

    setSaving(true);
    setFailed(false);
    const gespeichert = transfer
      ? await saveTransferChanges(transfer.id, values)
      : await saveNewTransfer(fromActivity.id, toActivity.id, values);
    setSaving(false);

    if (!gespeichert) {
      setFailed(true);
      return;
    }
    onSaved(gespeichert);
  }

  async function entfernen() {
    if (!transfer || saving) return;

    setSaving(true);
    setFailed(false);
    const entfernt = await removeTransfer(transfer.id);
    setSaving(false);

    if (!entfernt) {
      setFailed(true);
      return;
    }
    onRemoved(entfernt);
  }

  return (
    <div className={dialogStyles.overlay}>
      <div
        className={dialogStyles.card}
        role="dialog"
        aria-modal="true"
        aria-label={transfer ? "Transfer ändern" : "Transfer anlegen"}
        data-testid="transfer-form"
      >
        <h2 className={dialogStyles.title}>
          {transfer ? "Transfer ändern" : "Transfer anlegen"}
        </h2>
        <p className={dialogStyles.text}>
          Von „{fromActivity.title}“ nach „{toActivity.title}“.
        </p>

        {holt && (
          <p className={styles.hint} data-testid="transfer-form-holt">
            Vorschlag wird ermittelt…
          </p>
        )}
        {ohneStreckenvorschlag ? (
          <p
            className={styles.hint}
            role="note"
            data-testid="transfer-form-mittel-hinweis"
          >
            {OHNE_VORSCHLAG_HINWEIS}
          </p>
        ) : (
          grund && (
            <p
              className={styles.hint}
              role="note"
              data-testid="transfer-form-hinweis"
            >
              {grundHinweis(grund, fromActivity, toActivity)}
            </p>
          )
        )}

        <div className={styles.fields}>
          <label className={styles.field} htmlFor={`${fieldId}-mode`}>
            <span className={styles.label}>Verkehrsmittel</span>
            <select
              id={`${fieldId}-mode`}
              className={styles.input}
              value={input.mode}
              onChange={(event) =>
                waehleVerkehrsmittel(event.target.value as TransferMode)
              }
            >
              {TRANSFER_MODES.map((mode) => (
                <option key={mode} value={mode}>
                  {TRANSFER_MODE_LABEL[mode]}
                </option>
              ))}
            </select>
          </label>

          <label className={styles.field} htmlFor={`${fieldId}-title`}>
            <span className={styles.label}>Bezeichnung</span>
            <input
              id={`${fieldId}-title`}
              className={styles.input}
              value={input.title}
              onChange={(event) =>
                setInput((current) => ({
                  ...current,
                  title: event.target.value,
                }))
              }
            />
            {errors.title && (
              <span className={styles.error}>{errors.title}</span>
            )}
          </label>

          <div className={styles.row}>
            <label className={styles.field} htmlFor={`${fieldId}-duration`}>
              <span className={styles.label}>Dauer (Min)</span>
              <input
                id={`${fieldId}-duration`}
                className={styles.input}
                inputMode="numeric"
                value={input.durationMin}
                onChange={(event) =>
                  setInput((current) => ({
                    ...current,
                    durationMin: event.target.value,
                  }))
                }
              />
              {errors.durationMin && (
                <span className={styles.error}>{errors.durationMin}</span>
              )}
            </label>

            <label className={styles.field} htmlFor={`${fieldId}-distance`}>
              <span className={styles.label}>Strecke (km)</span>
              <input
                id={`${fieldId}-distance`}
                className={styles.input}
                inputMode="decimal"
                value={input.distanceKm}
                onChange={(event) =>
                  setInput((current) => ({
                    ...current,
                    distanceKm: event.target.value,
                  }))
                }
              />
              {errors.distanceKm && (
                <span className={styles.error}>{errors.distanceKm}</span>
              )}
            </label>
          </div>
        </div>

        {wegzeilen.length > 0 && (
          <div className={styles.route}>
            <ul
              className={styles.wegbeschreibung}
              data-testid="transfer-form-wegbeschreibung"
            >
              {wegzeilen.map((zeile, index) => (
                <li key={`${index}-${zeile}`}>{zeile}</li>
              ))}
            </ul>
          </div>
        )}

        {zeitHinweis && (
          <p
            className={styles.warning}
            role="note"
            data-testid="transfer-form-zeit"
          >
            {zeitHinweis}
          </p>
        )}
        {failed && (
          <p
            className={dialogStyles.error}
            role="alert"
            data-testid="transfer-form-error"
          >
            Der Transfer konnte nicht gespeichert werden.
          </p>
        )}

        <div className={dialogStyles.actions}>
          {transfer && (
            <button
              type="button"
              className={styles.removeButton}
              onClick={() => void entfernen()}
              disabled={saving}
            >
              Entfernen
            </button>
          )}
          <button
            type="button"
            className={dialogStyles.secondaryButton}
            onClick={onCancel}
          >
            Abbrechen
          </button>
          <button
            type="button"
            className={styles.saveButton}
            onClick={() => void speichern()}
            disabled={saving}
          >
            Speichern
          </button>
        </div>
      </div>
    </div>
  );
}

/** Ob einem der beiden Programmpunkte die Position fehlt (req-052). */
function fehlendePosition(from: Activity, to: Activity): boolean {
  return !from.position || !to.position;
}

/**
 * Das gewaehlte Verkehrsmittel samt der Dauer und Strecke, die dafuer
 * vorgeschlagen sind. Gibt es zu diesem Verkehrsmittel keinen Vorschlag,
 * bleiben beide leer (req-059) -- ohne Vorschlag ueberhaupt bleiben sie
 * stehen: getippt ist getippt.
 */
function uebernimm(
  current: TransferInput,
  mode: TransferMode,
  vorschlag: TransferVorschlag | null,
): TransferInput {
  const mit = { ...current, mode };
  if (!vorschlag) return mit;

  const angaben = vorschlag.proMittel[mode];
  return angaben
    ? withStreckenangaben(mit, angaben)
    : { ...mit, durationMin: "", distanceKm: "" };
}

/** Warum kein Vorschlag im Formular steht -- der Hinweis nennt den Grund. */
function grundHinweis(
  grund: VorschlagGrund,
  from: Activity,
  to: Activity,
): string {
  if (grund === "dienst_stumm") {
    return (
      "Der Routing-Dienst ist gerade nicht erreichbar. " +
      "Verkehrsmittel, Dauer und Strecke bitte selbst eintragen."
    );
  }

  const ohne = [from, to]
    .filter((activity) => !activity.position)
    .map((activity) => `„${activity.title}“`)
    .join(" und ");
  return (
    `Für ${ohne} ist keine Position hinterlegt. ` +
    "Verkehrsmittel, Dauer und Strecke bitte selbst eintragen."
  );
}
