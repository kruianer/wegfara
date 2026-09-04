import type { MailMessage } from "./mailer";
import { LOGIN_LINK_DURATION_MS } from "../auth/lifetime";

export const LOGIN_LINK_SUBJECT = "Dein Anmeldelink für Wegfara";

const VALID_MINUTES = Math.round(LOGIN_LINK_DURATION_MS / 60000);

/**
 * Der Betreff nennt die Umgebung, wenn die Mail nicht aus prod stammt
 * (req-037). Beide Umgebungen verschicken unter derselben Adresse -- ohne
 * diesen Zusatz waere eine dev-Mail von einer echten nicht zu unterscheiden.
 */
export function loginLinkSubject(umgebung: string | null): string {
  return umgebung ? `[${umgebung}] ${LOGIN_LINK_SUBJECT}` : LOGIN_LINK_SUBJECT;
}

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
export function loginLinkMail(
  to: string,
  url: string,
  umgebung: string | null = null,
): MailMessage {
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

  return { to, subject: loginLinkSubject(umgebung), text, html };
}
