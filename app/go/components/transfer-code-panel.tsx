"use client";

import { useEffect, useMemo, useState } from "react";
import { QrCode } from "@/components/qr-code";
import { qrCodeOf, qrMatrixFor } from "@/lib/qr/qr-code";
import { shareQrImage, type ShareOutcome } from "@/lib/qr/qr-image";
import { formatIbanGroups, normalizeIban } from "@/lib/participants/iban";
import { formatCents, formatEuro } from "@/lib/expenses/money";
import { transferCodePayload } from "@/lib/expenses/transfer-code";
import { fetchBankDetails } from "@/lib/participants/bank-details";
import styles from "./transfer-code-panel.module.css";

/** Kantenlaenge des Codes -- lesbar aus etwa 20 cm (req-031, GUI). */
const QR_PIXELS = 224;

/** Wie das Bild heisst, das an die andere App geht. */
const IMAGE_FILE_NAME = "ueberweisungscode.png";

/** Was nach dem Teilen in der Flaeche steht. */
const SHARE_MESSAGES: Record<ShareOutcome, string | null> = {
  geteilt: "Der Code wurde als Bild weitergereicht.",
  gespeichert: "Der Code wurde als Bild gespeichert.",
  // Wer abbricht, will keine Rueckmeldung -- er hat sich gerade entschieden.
  abgebrochen: null,
  gescheitert: "Der Code lässt sich auf diesem Gerät nicht als Bild teilen.",
};

/** Was die Flaeche gerade weiss. */
type Zustand = "laedt" | "da" | "fehler";

/**
 * Die Flaeche mit dem Ueberweisungscode zu einer Zahlung des Ausgleichs
 * (req-031). Sie geht auf Anforderung auf -- der Code steht nicht dauerhaft
 * in der Liste -- und holt dabei die Bankverbindung des Empfaengers.
 *
 * Der Code enthaelt Empfaenger, Bankverbindung und Betrag, sonst nichts:
 * keine Angabe ueber die Reise oder die Ausgaben. Erzeugt wird er hier im
 * Geraet; nach aussen geht dabei nichts (req-031, Constraints).
 *
 * Daneben stehen dieselben Angaben als Text, jede einzeln zum Kopieren, und
 * eine Schaltflaeche zum Teilen: wer den Code auf demselben Geraet sieht,
 * auf dem seine Banking-App laeuft, kann ihn nicht abscannen.
 */
export function TransferCodePanel({
  recipientId,
  recipientName,
  amountCents,
  onClose,
  copyToClipboard = (text: string) => navigator.clipboard.writeText(text),
  shareCode = shareQrImage,
}: {
  recipientId: string;
  /** Immer der volle Name -- er muss zum Kontoinhaber passen (req-020). */
  recipientName: string;
  amountCents: number;
  onClose: () => void;
  copyToClipboard?: (text: string) => Promise<void>;
  shareCode?: typeof shareQrImage;
}) {
  const [zustand, setZustand] = useState<Zustand>("laedt");
  const [iban, setIban] = useState<string | null>(null);
  const [meldung, setMeldung] = useState<string | null>(null);

  useEffect(() => {
    let abgemeldet = false;
    void fetchBankDetails(recipientId).then((result) => {
      if (abgemeldet) return;
      if (!result.ok) {
        setZustand("fehler");
        return;
      }
      setIban(result.iban);
      setZustand("da");
    });
    return () => {
      abgemeldet = true;
    };
  }, [recipientId]);

  // Der Code haengt allein an Empfaenger, Bankverbindung und Betrag -- er
  // wird einmal gerechnet und nicht bei jeder Rueckmeldung neu.
  const matrix = useMemo(() => {
    if (iban === null) return null;
    const payload = transferCodePayload({
      recipientName,
      iban,
      amountCents,
    });
    return payload === null ? null : qrMatrixFor(payload);
  }, [iban, recipientName, amountCents]);

  const code = useMemo(() => (matrix ? qrCodeOf(matrix) : null), [matrix]);

  async function kopiere(was: string, text: string) {
    try {
      await copyToClipboard(text);
      setMeldung(`${was} liegt in der Zwischenablage.`);
    } catch {
      setMeldung(`${was} ließ sich nicht kopieren.`);
    }
  }

  async function teile() {
    if (!matrix) return;
    setMeldung(null);
    const ergebnis = await shareCode(
      matrix,
      IMAGE_FILE_NAME,
      `Überweisung an ${recipientName}`,
    );
    setMeldung(SHARE_MESSAGES[ergebnis]);
  }

  /** Die Angaben neben dem Code, jede einzeln zum Kopieren. */
  const zeilen = [
    { label: "Empfänger", text: recipientName, kopie: recipientName },
    iban === null
      ? null
      : {
          label: "Bankverbindung",
          text: formatIbanGroups(iban),
          // Kopiert wird sie ohne Leerzeichen -- so erwartet sie jede
          // Banking-App.
          kopie: normalizeIban(iban),
        },
    {
      label: "Betrag",
      text: formatEuro(amountCents),
      // Ohne Waehrungszeichen: eingetippt wird in der Banking-App die Zahl.
      kopie: formatCents(amountCents),
    },
  ].filter((zeile) => zeile !== null);

  return (
    <section
      className={styles.panel}
      aria-label={`Überweisungscode für ${recipientName}`}
    >
      {zustand === "laedt" && (
        <p className={styles.hint}>Bankverbindung wird geholt …</p>
      )}

      {zustand === "fehler" && (
        <p className={styles.hint} role="alert">
          Die Bankverbindung ließ sich nicht holen.
        </p>
      )}

      {zustand === "da" && iban === null && (
        <p className={styles.hint} data-testid="transfer-code-missing-iban">
          Für {recipientName} ist keine Bankverbindung hinterlegt. Die Zahlung
          lässt sich trotzdem abhaken.
        </p>
      )}

      {zustand === "da" && iban !== null && code === null && (
        <p className={styles.hint} role="alert">
          Aus der hinterlegten Bankverbindung lässt sich kein Überweisungscode
          erzeugen.
        </p>
      )}

      {code && (
        <QrCode
          code={code}
          label={`Überweisungscode für ${recipientName}`}
          size={QR_PIXELS}
        />
      )}

      {zustand === "da" && iban !== null && (
        <ul className={styles.details}>
          {zeilen.map((zeile) => (
            <li key={zeile.label} className={styles.detailRow}>
              <span className={styles.detailBody}>
                <span className={styles.detailLabel}>{zeile.label}</span>
                <span className={styles.detailValue}>{zeile.text}</span>
              </span>
              <button
                type="button"
                className={styles.copyButton}
                aria-label={`${zeile.label} kopieren`}
                onClick={() => void kopiere(zeile.label, zeile.kopie)}
              >
                Kopieren
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className={styles.actions}>
        {code && (
          <button
            type="button"
            className={styles.actionButton}
            onClick={() => void teile()}
          >
            Als Bild teilen
          </button>
        )}
        <button type="button" className={styles.actionButton} onClick={onClose}>
          Schließen
        </button>
      </div>

      {meldung && (
        <p className={styles.hint} role="status">
          {meldung}
        </p>
      )}
    </section>
  );
}
