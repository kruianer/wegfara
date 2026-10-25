"use client";

import { useState } from "react";
import { QrCode } from "@/components/qr-code";
import { formatValidUntil } from "@/components/invitation-panel";
import type { Invitation, InvitationMail } from "@/lib/invitations/types";
import { invitationMailHint } from "@/lib/invitations/mail-hinweis";
import styles from "./mitreisende-view.module.css";

/**
 * Die Einladung im Begleiter (req-087): derselbe Inhalt wie in der Planer-
 * Karte (req-023, req-085) -- QR-Code, Link, "Link kopieren" und was aus der
 * E-Mail wurde --, aber untereinander statt nebeneinander. Bei 375 px bliebe
 * neben dem QR-Code fuer den Link kaum Platz.
 */
export function EinladungPanel({
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
    <div className={styles.einladung} data-testid="invitation-panel">
      <div className={styles.qr}>
        <QrCode
          code={invitation.qr}
          label={`QR-Code der Einladung für ${name}`}
        />
      </div>
      {mail && (
        <p
          className={
            mail.status === "versandt"
              ? styles.einladungText
              : `${styles.hinweis} ${styles.einladungHinweis}`
          }
          role="status"
          data-testid="invitation-mail"
        >
          {invitationMailHint(mail)}
        </p>
      )}
      <p className={styles.einladungText}>
        Lass den QR-Code abscannen oder schick den Link. Er gilt bis zum{" "}
        {formatValidUntil(invitation.expiresAt)} und lässt sich genau einmal
        verwenden.
      </p>
      <p className={styles.einladungLink} data-testid="invitation-link">
        {invitation.url}
      </p>
      <div className={styles.einladungAktionen}>
        <button
          type="button"
          className={styles.knopf}
          onClick={() => void copyLink()}
        >
          Link kopieren
        </button>
        <button type="button" className={styles.knopf} onClick={onClose}>
          Schließen
        </button>
      </div>
      {copied && (
        <p className={styles.einladungText} role="status">
          Der Link liegt in der Zwischenablage.
        </p>
      )}
    </div>
  );
}
