import { getPool } from "@/lib/db/pool";
import { requestLoginLink } from "@/lib/auth/login";
import { normalizeEmail } from "@/lib/auth/email";
import { createRateLimiter } from "@/lib/auth/rate-limit";
import { LOGIN_LINK_NOTICE } from "@/lib/auth/messages";
import { smtpMailer } from "@/lib/mail/smtp-mailer";

export const dynamic = "force-dynamic";

/**
 * Ohne Anmeldung erreichbar und versendet Mails -- deshalb gebremst.
 * Fuenf Anfragen je Adresse in 15 Minuten reichen fuer jeden ehrlichen
 * Gebrauch.
 */
const limiter = createRateLimiter(5, 15 * 60 * 1000);

export async function POST(request: Request) {
  let email = "";
  let weiter = "";
  try {
    const body = (await request.json()) as {
      email?: unknown;
      weiter?: unknown;
    };
    if (typeof body.email === "string") email = body.email;
    if (typeof body.weiter === "string") weiter = body.weiter;
  } catch {
    email = "";
  }

  const now = new Date();
  if (limiter.allow(normalizeEmail(email), now)) {
    await requestLoginLink(getPool(), smtpMailer, email, now, weiter);
  }

  // Immer dieselbe Antwort — auch bei unbekannter Adresse und auch dann,
  // wenn die Bremse gegriffen hat (req-016).
  return Response.json({ notice: LOGIN_LINK_NOTICE });
}
