/**
 * Der Riegel nach aussen fuer den Anwendungsserver der E2E-Tests (req-047).
 *
 * Wird dem Server per NODE_OPTIONS="--require ..." vorgeschaltet (siehe
 * scripts/e2e.mjs) und ersetzt `fetch`, bevor Next.js es zu fassen bekommt.
 * Damit gilt fuer den ganzen Prozess: Anfragen an OpenAI, Google Places,
 * Overpass, open-meteo oder sonst wohin nach draussen kommen nicht zustande
 * -- kein Test kann Kosten verursachen oder im Netz haengen (siehe
 * Test-Policy in delivery/stack.md).
 *
 * Nominatim bekommt eine feste Antwort statt einer Absage: die Ortssuche ist
 * Teil der geprueften Fluesse (ohne gewaehlten Vorschlag entsteht weder eine
 * Reise noch ein POI mit Position), und der Ort eines POI wird beim Speichern
 * dort nachgeschlagen. Geprueft wird damit der echte Weg durch
 * lib/osm/place-search.ts und lib/osm/ort-lookup.ts -- nur die Antwort kommt
 * aus dem Hause.
 *
 * Bewusst CommonJS: --require laedt kein ES-Modul.
 */

const ECHTES_FETCH = globalThis.fetch;

/** Der Ort, den die feste Antwort zu jeder Anfrage nennt. */
const ORT = "Teststadt";
const REGION = "Testregion";
const LAND = "Testland";

const LOKALE_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

function istLokal(hostname) {
  return LOKALE_HOSTS.has(hostname);
}

/**
 * Eine Position aus der Eingabe -- gleiche Eingabe, gleiche Stelle. Erfunden,
 * aber stabil: die Tests duerfen sich auf den gewaehlten Vorschlag verlassen.
 */
function positionFuer(text) {
  let hash = 0;
  for (const zeichen of text) {
    hash = (hash * 31 + zeichen.codePointAt(0)) % 100_000;
  }
  return {
    lat: 40 + (hash % 1000) / 1000,
    lng: 10 + (Math.floor(hash / 1000) % 1000) / 1000,
  };
}

/** Ein Eintrag im Format, das Nominatim liefert (siehe lib/osm/place-search.ts). */
function eintrag(name) {
  const { lat, lng } = positionFuer(name);
  return {
    name,
    display_name: `${name}, ${ORT}, ${REGION}, ${LAND}`,
    lat: String(lat),
    lon: String(lng),
    address: {
      road: `${name}-Weg`,
      house_number: "1",
      postcode: "12345",
      town: ORT,
      state: REGION,
      country: LAND,
    },
  };
}

/**
 * Die Antwort auf eine Nominatim-Anfrage -- oder null, wenn die Adresse
 * nicht zu Nominatim gehoert.
 */
function nominatimAntwort(url) {
  if (url.hostname !== "nominatim.openstreetmap.org") return null;

  if (url.pathname.startsWith("/reverse")) {
    return { address: { town: ORT, state: REGION, country: LAND } };
  }

  const query = (url.searchParams.get("q") ?? "").trim();
  return query.length === 0 ? [] : [eintrag(query)];
}

function alsAntwort(inhalt) {
  return new Response(JSON.stringify(inhalt), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

function adresseVon(input) {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

globalThis.fetch = async function fetchOhneAussenwelt(input, init) {
  const adresse = adresseVon(input);
  let url;
  try {
    url = new URL(adresse);
  } catch {
    return ECHTES_FETCH(input, init);
  }

  if (istLokal(url.hostname)) return ECHTES_FETCH(input, init);

  const nominatim = nominatimAntwort(url);
  if (nominatim) return alsAntwort(nominatim);

  // Laut und nachvollziehbar: was hier auftaucht, gehoert in den Test
  // gemockt oder gar nicht erst aufgerufen.
  console.error(
    `E2E: Zugriff nach aussen gesperrt: ${url.origin}${url.pathname}`,
  );
  throw new Error(`E2E: Zugriff nach aussen gesperrt: ${url.href}`);
};
