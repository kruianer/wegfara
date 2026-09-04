import { NextResponse } from "next/server";
import { getPool } from "@/lib/db/pool";
import { currentSession } from "@/lib/auth/current-session";
import { logoutEverywhere } from "@/lib/auth/login";
import { connectionIsSecure } from "@/lib/auth/cookies";
import { clearSessionCookie } from "@/lib/auth/cookie-store";
import { unauthorized } from "@/lib/auth/api-guard";

export const dynamic = "force-dynamic";

/**
 * "Ueberall abmelden" (req-037): beendet alle Sitzungen des Kontos auf allen
 * Geraeten -- auch die gerade benutzte, deren Cookie hier gleich mit
 * geloescht wird. Die Passkeys bleiben bestehen; es ist ein Abmelden, kein
 * Aussperren.
 */
export async function POST(request: Request) {
  const session = await currentSession();
  if (!session) return unauthorized();

  await logoutEverywhere(getPool(), session.participant.id);

  const response = NextResponse.json({ status: "abgemeldet" });
  clearSessionCookie(
    response,
    connectionIsSecure(request.headers.get("x-forwarded-proto"), request.url),
  );
  return response;
}
