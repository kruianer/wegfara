export type StandortErgebnis =
  | { ok: true; lat: number; lng: number }
  | { ok: false; grund: "abgelehnt" | "nicht_verfuegbar" };

/**
 * Fragt die aktuelle Position im Browser ab (req-050). Kein Hintergrund-
 * Standort (siehe stack.md): der Aufrufer ruft sie nur auf, waehrend die
 * Karte offen und ihre Anzeige eingeblendet ist.
 */
export function holeStandort(): Promise<StandortErgebnis> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      resolve({ ok: false, grund: "nicht_verfuegbar" });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          ok: true,
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        }),
      (error) =>
        resolve({
          ok: false,
          grund:
            error.code === error.PERMISSION_DENIED
              ? "abgelehnt"
              : "nicht_verfuegbar",
        }),
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  });
}
