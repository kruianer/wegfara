/** Eine fertig formulierte Nachricht, unabhaengig vom Versandweg. */
export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

/**
 * Austauschbare Schnittstelle zum Mailversand (analog zu lib/ai/client.ts).
 * Versandt wird nur, was ein Requirement verlangt -- derzeit ausschliesslich
 * der Anmeldelink (siehe delivery/stack.md).
 */
export interface Mailer {
  /** Liefert false, wenn die Nachricht nicht zugestellt werden konnte. */
  send(message: MailMessage): Promise<boolean>;
}
