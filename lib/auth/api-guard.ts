import { NextResponse } from "next/server";

/**
 * Die einheitliche Abweisung fuer Schnittstellen: ohne angemeldete Person
 * wird jeder lesende und schreibende Zugriff zurueckgewiesen (req-016).
 * Die middleware faengt den Fall ohne Sitzungs-Cookie schon vorher ab --
 * hier wird geprueft, ob die Sitzung wirklich gilt.
 */
export const UNAUTHORIZED_MESSAGE = "nicht angemeldet";

export function unauthorized(): NextResponse {
  return NextResponse.json({ error: UNAUTHORIZED_MESSAGE }, { status: 401 });
}

/**
 * Die Abweisung fuer angemeldete Personen ohne die noetige Kennzeichnung --
 * die Account-Verwaltung sieht ausschliesslich der Gesamt-Admin (req-025).
 * Anders als bei unauthorized() hilft hier kein Anmelden weiter.
 */
export const FORBIDDEN_MESSAGE = "kein Zugriff";

export function forbidden(): NextResponse {
  return NextResponse.json({ error: FORBIDDEN_MESSAGE }, { status: 403 });
}
