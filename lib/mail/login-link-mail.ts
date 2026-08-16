import type { MailMessage } from "./mailer";
import { LOGIN_LINK_DURATION_MS } from "../auth/lifetime";

export const LOGIN_LINK_SUBJECT = "Dein Anmeldelink für Wegfara";

const VALID_MINUTES = Math.round(LOGIN_LINK_DURATION_MS / 60000);

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Formuliert die Anmeldelink-Nachricht. Bewusst ohne Namen und ohne
 * Reisedaten: die Mail laeuft ueber einen fremden Server und soll nichts
 * preisgeben, was ueber die Anmeldung hinausgeht.
 */
export function loginLinkMail(to: string, url: string): MailMessage {
  const text = [
    "Hallo,",
    "",
    "mit diesem Link meldest du dich bei Wegfara an:",
    url,
    "",
    `Der Link ist ${VALID_MINUTES} Minuten gültig und genau einmal verwendbar.`,
    "Hast du ihn nicht angefordert, ignoriere diese Nachricht einfach.",
    "",
    "Wegfara",
  ].join("\n");

  const safeUrl = escapeHtml(url);
  const html = [
    "<p>Hallo,</p>",
    "<p>mit diesem Link meldest du dich bei Wegfara an:</p>",
    `<p><a href="${safeUrl}">${safeUrl}</a></p>`,
    `<p>Der Link ist ${VALID_MINUTES} Minuten gültig und genau einmal verwendbar.`,
    " Hast du ihn nicht angefordert, ignoriere diese Nachricht einfach.</p>",
    "<p>Wegfara</p>",
  ].join("");

  return { to, subject: LOGIN_LINK_SUBJECT, text, html };
}
