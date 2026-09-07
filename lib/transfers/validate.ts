import { TRANSFER_MODE_LABEL } from "./type-meta";
import type { Streckenangaben } from "./vorschlag";
import { isTransferMode, type Transfer, type TransferMode } from "./types";

/**
 * Was am Transfer-Formular erfasst wird (req-052): Verkehrsmittel, Titel,
 * Dauer und Strecke. Dauer und Strecke stehen als Text darin -- so wie sie
 * getippt werden; geprueft werden sie beim Speichern.
 */
export interface TransferInput {
  mode: TransferMode;
  title: string;
  durationMin: string;
  distanceKm: string;
}

export type TransferInputField = keyof TransferInput;

export type TransferFieldErrors = Partial<Record<TransferInputField, string>>;

export const TRANSFER_TITLE_MAX_LENGTH = 120;

/** Die geprueften Angaben, wie sie in die Ablage gehen. */
export interface TransferInputValues {
  mode: TransferMode;
  title: string;
  durationMin: number;
  distanceKm: number;
}

/** Ein Transfer-Formular ohne Vorschlag -- Verkehrsmittel und Titel gesetzt. */
export function emptyTransferInput(zielTitel: string): TransferInput {
  return {
    mode: "auto",
    title: vorgeschlagenerTitel(zielTitel),
    durationMin: "",
    distanceKm: "",
  };
}

/** Der Titel, den das Formular vorschlaegt -- aenderbar wie alles andere. */
export function vorgeschlagenerTitel(zielTitel: string): string {
  return `Nach ${zielTitel}`.slice(0, TRANSFER_TITLE_MAX_LENGTH);
}

/** Die Angaben eines vorhandenen Transfers als Formularstand. */
export function transferToInput(transfer: Transfer): TransferInput {
  return {
    mode: transfer.mode,
    title: transfer.title,
    durationMin: String(transfer.durationMin),
    distanceKm: formatDezimal(transfer.distanceKm),
  };
}

/** Dauer und Strecke eines Vorschlags in den Formularstand uebernehmen. */
export function withStreckenangaben(
  input: TransferInput,
  angaben: Streckenangaben,
): TransferInput {
  return {
    ...input,
    durationMin: String(angaben.durationMin),
    distanceKm: formatDezimal(angaben.distanceKm),
  };
}

/** Komma statt Punkt -- so wird eine Zahl hier geschrieben und getippt. */
export function formatDezimal(value: number): string {
  return String(value).replace(".", ",");
}

/** Getippt wird mit Komma oder Punkt; NaN heisst: keine Zahl. */
function alsZahl(value: string): number {
  const text = value.trim().replace(",", ".");
  return text.length === 0 ? NaN : Number(text);
}

/**
 * Prueft den Formularstand (req-052). Verkehrsmittel, Dauer und Strecke sind
 * Pflicht -- fehlt die Position eines der beiden Programmpunkte, gibt es
 * keinen Vorschlag, und der Reiseleiter traegt sie selbst ein. Der Titel darf
 * nicht leer sein; wer ihn leert, bekommt den des Verkehrsmittels.
 */
export function validateTransferInput(input: TransferInput): {
  values: TransferInputValues | null;
  errors: TransferFieldErrors;
} {
  const errors: TransferFieldErrors = {};

  if (!isTransferMode(input.mode)) {
    errors.mode = "Bitte ein Verkehrsmittel wählen.";
  }

  const title =
    input.title.trim().length > 0
      ? input.title.trim()
      : TRANSFER_MODE_LABEL[input.mode];
  if (title.length > TRANSFER_TITLE_MAX_LENGTH) {
    errors.title = `Höchstens ${TRANSFER_TITLE_MAX_LENGTH} Zeichen.`;
  }

  const durationMin = alsZahl(input.durationMin);
  if (!Number.isFinite(durationMin) || durationMin < 1) {
    errors.durationMin = "Bitte eine Dauer in Minuten eintragen.";
  }

  const distanceKm = alsZahl(input.distanceKm);
  if (!Number.isFinite(distanceKm) || distanceKm <= 0) {
    errors.distanceKm = "Bitte eine Strecke in Kilometern eintragen.";
  }

  if (Object.keys(errors).length > 0) return { values: null, errors };

  return {
    values: {
      mode: input.mode,
      title,
      // Eine halbe Minute gibt es im Zeitstrahl nicht.
      durationMin: Math.round(durationMin),
      // Eine Nachkommastelle, aber nie auf 0 gerundet: eine Strecke hat eine
      // Laenge (siehe migrations/0008_transfers.sql).
      distanceKm: Math.max(0.1, Math.round(distanceKm * 10) / 10),
    },
    errors,
  };
}
