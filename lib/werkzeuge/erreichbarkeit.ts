/**
 * Die Lese-Schnittstelle fuer mitdenka gehoert nicht ins Internet (req-104).
 * Beide Anwendungen laufen auf dem Beelink; mitdenka ruft sie ueber das
 * Docker-Netz bzw. den lokal gebundenen Port.
 *
 * Der Tunnel ist mit einem Token eingerichtet und leitet den ganzen Host
 * weiter -- einen Pfad nimmt er nicht aus. Was durch ihn kommt, traegt aber
 * die Koepfe, die Cloudflare jeder Anfrage mitgibt; daran erkennt die Route
 * es und antwortet wie auf eine Adresse, die es nicht gibt. Abstreifen kann
 * ein Aufrufer diese Koepfe nicht: Cloudflare setzt sie selbst.
 */

const CLOUDFLARE_KOEPFE = ["cf-ray", "cf-connecting-ip", "cf-ipcountry"];

export function kamUeberCloudflare(headers: Headers): boolean {
  if (CLOUDFLARE_KOEPFE.some((kopf) => headers.has(kopf))) return true;
  return /cloudflare/i.test(headers.get("cdn-loop") ?? "");
}
