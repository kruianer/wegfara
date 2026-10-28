"use client";

import { useState } from "react";
import { QrCode } from "@/components/qr-code";
import type { Invitation, InvitationMail } from "@/lib/invitations/types";
import { invitationMailHint } from "@/lib/invitations/mail-hinweis";
import styles from "./cards.module.css";

/** z.B. "23.09.2026" — bis wann der Zugangslink gilt. */
export function formatValidUntil(iso: string): string {
  const date = new Date(iso);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${day}.${month}.${date.getFullYear()}`;
}

/**
 * Die Flaeche, die nach einem Klick auf "Einladen" aufgeht (req-023): der
 * QR-Code zum Abscannen, derselbe Link als Text zum Weitergeben und eine
 * Schaltflaeche zum Kopieren. Beides fuehrt an dieselbe Stelle.
 *
 * Wurde die Einladung zusaetzlich per E-Mail verschickt (req-085), sagt die
 * Flaeche, ob das gelungen ist -- und wenn nicht, dass der Link selbst
 * weiterzugeben ist.
 */
export function InvitationPanel({
  invitation,
  name,
  mail = null,
  onClose,
  copyToClipboard = (text: string) => navigator.clipboard.writeText(text),
}: {
  invitation: Invitation;
  /** Wie die eingeladene Person angesprochen wird. */
  name: string;
  /** Was aus der Einladungs-Mail wurde; null, wenn keine vorgesehen war. */
  mail?: InvitationMail | null;
  onClose: () => void;
  copyToClipboard?: (text: string) => Promise<void>;
}) {
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    try {
      await copyToClipboard(invitation.url);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className={styles.invitation} data-testid="invitation-panel">
      <QrCode
        code={invitation.qr}
        label={`QR-Code der Einladung für ${name}`}
      />
      <div className={styles.invitationBody}>
        {mail && (
          <p
            className={
              mail.status === "versandt"
                ? styles.invitationHint
                : `${styles.notice} ${styles.invitationNotice}`
            }
            role="status"
            data-testid="invitation-mail"
          >
            {invitationMailHint(mail)}
          </p>
        )}
        <p className={styles.invitationHint}>
          Lass den QR-Code abscannen oder schick den Link. Er gilt bis zum{" "}
          {formatValidUntil(invitation.expiresAt)} und lässt sich genau einmal
          verwenden.
        </p>
        <p className={styles.invitationLink} data-testid="invitation-link">
          {invitation.url}
        </p>
        <div className={styles.invitationActions}>
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={() => void copyLink()}
          >
            Link kopieren
          </button>
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={onClose}
          >
            Schließen
          </button>
        </div>
        {copied && (
          <p className={styles.invitationHint} role="status">
            Der Link liegt in der Zwischenablage.
          </p>
        )}
      </div>
    </div>
  );
}
