import type { InvitationMail } from "./types";

/** Die Hinweise der Einladungsflaeche zum Versand der Mail (req-085). */
export const INVITATION_MAIL_HINTS = {
  keineAdresse: "Keine E-Mail-Adresse hinterlegt — gib den Link selbst weiter.",
  fehlgeschlagen:
    "Die E-Mail konnte nicht verschickt werden — gib den Link selbst weiter.",
} as const;

export function invitationMailHint(mail: InvitationMail): string {
  switch (mail.status) {
    case "versandt":
      return `Einladung an ${mail.an} geschickt`;
    case "keineAdresse":
      return INVITATION_MAIL_HINTS.keineAdresse;
    case "fehlgeschlagen":
      return INVITATION_MAIL_HINTS.fehlgeschlagen;
  }
}
