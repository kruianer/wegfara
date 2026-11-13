import { istWerkzeugName, WERKZEUGE } from "./beschreibungen";
import { fuehreWerkzeugAus, type WerkzeugUmgebung } from "./ausfuehren";

/**
 * Der JSON-RPC-Umschlag der Lese-Schnittstelle (req-104): dieselbe Form, die
 * mitdenka bei seinen anderen Gates erwartet -- `jsonrpc`, `id`, `method`,
 * `params` hinein, `result` oder `error` heraus. Zwei Methoden mit den Namen
 * aus MCP; den MCP-Server baut mitdenka selbst.
 *
 * Was auch immer hereinkommt, die Antwort ist ein Umschlag -- nie ein
 * Absturz. Ein Fehler beim Lesen wird zu einem JSON-RPC-Fehler, ohne dass
 * seine Einzelheiten hinausgehen.
 */

export type JsonRpcId = string | number | null;

export type JsonRpcAntwort =
  | { jsonrpc: "2.0"; id: JsonRpcId; result: unknown }
  | {
      jsonrpc: "2.0";
      id: JsonRpcId;
      error: { code: number; message: string };
    };

/**
 * Die Fehlernummern aus JSON-RPC 2.0 -- und eine aus dem Bereich, den es
 * Servern freigibt, fuer den fehlenden oder ungueltigen Schluessel.
 */
export const JSON_RPC_FEHLER = {
  nichtAngemeldet: -32001,
  unlesbar: -32700,
  ungueltig: -32600,
  unbekannteMethode: -32601,
  ungueltigeParameter: -32602,
  intern: -32603,
} as const;

export function rpcFehler(
  id: JsonRpcId,
  code: number,
  message: string,
): JsonRpcAntwort {
  return { jsonrpc: "2.0", id, error: { code, message } };
}

function idAus(anfrage: Record<string, unknown>): JsonRpcId {
  const { id } = anfrage;
  return typeof id === "string" || typeof id === "number" ? id : null;
}

/** Beantwortet eine Anfrage, deren Rumpf schon als JSON gelesen ist. */
export async function beantworte(
  umgebung: WerkzeugUmgebung,
  accountId: string,
  rumpf: unknown,
): Promise<JsonRpcAntwort> {
  if (typeof rumpf !== "object" || rumpf === null || Array.isArray(rumpf)) {
    return rpcFehler(null, JSON_RPC_FEHLER.ungueltig, "Ungültige Anfrage.");
  }
  const anfrage = rumpf as Record<string, unknown>;
  const id = idAus(anfrage);
  if (anfrage.jsonrpc !== "2.0" || typeof anfrage.method !== "string") {
    return rpcFehler(id, JSON_RPC_FEHLER.ungueltig, "Ungültige Anfrage.");
  }

  switch (anfrage.method) {
    case "tools/list":
      return { jsonrpc: "2.0", id, result: { tools: WERKZEUGE } };

    case "tools/call": {
      const params =
        typeof anfrage.params === "object" && anfrage.params !== null
          ? (anfrage.params as Record<string, unknown>)
          : {};
      if (!istWerkzeugName(params.name)) {
        return rpcFehler(
          id,
          JSON_RPC_FEHLER.ungueltigeParameter,
          `Unbekanntes Werkzeug: ${String(params.name)}`,
        );
      }
      try {
        const ergebnis = await fuehreWerkzeugAus(
          umgebung,
          accountId,
          params.name,
          params.arguments,
        );
        return {
          jsonrpc: "2.0",
          id,
          result: {
            content: [{ type: "text", text: ergebnis.text }],
            isError: ergebnis.fehler,
          },
        };
      } catch (fehler) {
        // Der Grund steht im Server-Log, nicht in der Antwort: er koennte
        // Einzelheiten der Datenbank tragen.
        console.error(
          `werkzeuge: werkzeug=${params.name} grund=${fehler instanceof Error ? fehler.message : String(fehler)}`,
        );
        return rpcFehler(
          id,
          JSON_RPC_FEHLER.intern,
          "Das Werkzeug ist fehlgeschlagen.",
        );
      }
    }

    default:
      return rpcFehler(
        id,
        JSON_RPC_FEHLER.unbekannteMethode,
        `Unbekannte Methode: ${anfrage.method}`,
      );
  }
}
