import { OHNE_STANDORT, type Standortlage, type Verzug } from "./types";

/**
 * Holt Ort und Verzug vom Server (req-051). Ist der Begleiter selbst gerade
 * offline, gilt dasselbe wie bei einem stummen Routing-Dienst: der Verzug
 * laesst sich nicht ermitteln, "Laut Plan" steht trotzdem.
 */
export async function ladeStandortlage(
  tripId: string,
  signal?: AbortSignal,
): Promise<Standortlage> {
  let antwort: Response;
  try {
    antwort = await fetch(
      `/api/live-status?reise=${encodeURIComponent(tripId)}`,
      { signal },
    );
  } catch {
    return { ort: null, verzug: { art: "unbekannt" } };
  }

  if (!antwort.ok) return OHNE_STANDORT;

  try {
    return alsStandortlage(await antwort.json());
  } catch {
    return OHNE_STANDORT;
  }
}

/** Die Antwort kommt von aussen -- gepruefte Werte oder gar keine. */
function alsStandortlage(body: unknown): Standortlage {
  const record = body as { ort?: unknown; verzug?: unknown } | null;
  const ort = typeof record?.ort === "string" ? record.ort : null;
  const art = (record?.verzug as { art?: unknown } | undefined)?.art;
  const minuten = (record?.verzug as { minuten?: unknown } | undefined)
    ?.minuten;
  const stand = (record?.verzug as { stand?: unknown } | undefined)?.stand;
  // Nur eine Fahrzeit aus einer frueheren Abfrage nennt ihren Stand (bug-067).
  const mitStand = typeof stand === "string" ? { stand } : {};

  let verzug: Verzug = { art: "keiner" };
  if (art === "unbekannt") verzug = { art };
  else if (art === "im_zeitplan" || art === "ankunft_im_plan") {
    verzug = { art, ...mitStand };
  } else if (art === "verspaetet" && typeof minuten === "number") {
    verzug = { art: "verspaetet", minuten, ...mitStand };
  }

  return { ort, verzug };
}
