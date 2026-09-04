import type { MailMessage } from "./mailer";
import { ACCESS_LINK_DURATION_MS } from "../auth/lifetime";

export const INVITATION_SUBJECT = "Deine Einladung zu Wegfara";

const VALID_DAYS = Math.round(ACCESS_LINK_DURATION_MS / (24 * 60 * 60 * 1000));

/**
 * Der Betreff nennt die Umgebung, wenn die Mail nicht aus prod stammt
 * (req-037) -- beide Umgebungen verschicken unter derselben Adresse.
 */
export function invitationSubject(umgebung: string | null): string {
  return umgebung ? `[${umgebung}] ${INVITATION_SUBJECT}` : INVITATION_SUBJECT;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Formuliert die Einladung (req-038). Wie beim Anmeldelink bewusst ohne
 * Reisedaten: die Mail laeuft ueber einen fremden Server und soll nichts
 * preisgeben, was ueber den Zugang hinausgeht. Der Name steht darin, weil
 * die Einladung an genau diese Person gebunden ist.
 */
export function invitationMail(
  to: string,
  name: string,
  url: string,
  umgebung: string | null = null,
): MailMessage {
  const text = [
    `Hallo ${name},`,
    "",
    "du wurdest zu Wegfara eingeladen. Mit diesem Link kommst du herein:",
    url,
    "",
    `Der Link ist ${VALID_DAYS} Tage gültig und genau einmal verwendbar.`,
    "Beim Öffnen richtest du einen Passkey für dein Gerät ein.",
    "",
    "Wegfara",
  ].join("\n");

  const safeUrl = escapeHtml(url);
  const html = [
    `<p>Hallo ${escapeHtml(name)},</p>`,
    "<p>du wurdest zu Wegfara eingeladen. Mit diesem Link kommst du herein:</p>",
    `<p><a href="${safeUrl}">${safeUrl}</a></p>`,
    `<p>Der Link ist ${VALID_DAYS} Tage gültig und genau einmal verwendbar. Beim Öffnen richtest du einen Passkey für dein Gerät ein.</p>`,
    "<p>Wegfara</p>",
  ].join("");

  return { to, subject: invitationSubject(umgebung), text, html };
}
