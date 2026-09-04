import type { TripDocument } from "./types";

/**
 * Die Verknuepfung eines Dokuments, wie sie als Kennzeichnung auf der Karte
 * steht (Vorlage, Abschnitt "5. Dokumente"): „POI · Villa Rufolo“,
 * „Transfer · Mietwagen“ oder „Nicht verknüpft“.
 */
export type DocumentLinkKind = "poi" | "transfer" | "keine";

export interface DocumentLinkLabel {
  kind: DocumentLinkKind;
  text: string;
}

export const NO_LINK_LABEL = "Nicht verknüpft";

export function documentLinkLabel(
  document: Pick<TripDocument, "poiId" | "transferId">,
  names: { pois: Map<string, string>; transfers: Map<string, string> },
): DocumentLinkLabel {
  if (document.poiId) {
    const name = names.pois.get(document.poiId);
    if (name) return { kind: "poi", text: `POI · ${name}` };
  }
  if (document.transferId) {
    const name = names.transfers.get(document.transferId);
    if (name) return { kind: "transfer", text: `Transfer · ${name}` };
  }
  // Zeigt die Verknuepfung ins Leere -- der POI ist entfernt worden --,
  // steht das Dokument als unverknuepft da. Es haengt an der Reise, nicht
  // am POI, und bleibt deshalb erhalten (req-034).
  return { kind: "keine", text: NO_LINK_LABEL };
}

/** Die Namen der POIs und Transfers einer Reise, zum Beschriften der Karten. */
export function linkNames(
  pois: { id: string; name: string }[],
  transfers: { id: string; title: string }[],
): { pois: Map<string, string>; transfers: Map<string, string> } {
  return {
    pois: new Map(pois.map((poi) => [poi.id, poi.name])),
    transfers: new Map(
      transfers.map((transfer) => [transfer.id, transfer.title]),
    ),
  };
}
