import type { TripDocument } from "./types";

/** Die Filterleiste des Bereichs "Dokumente" (req-034, Vorlage Abschnitt 5). */
export type DocumentFilterId = "alle" | "poi" | "transfer" | "ohne";

export interface DocumentFilter {
  id: DocumentFilterId;
  label: string;
}

export const DOCUMENT_FILTERS: DocumentFilter[] = [
  { id: "alle", label: "Alle" },
  { id: "poi", label: "Mit POI verknüpft" },
  { id: "transfer", label: "Mit Transfer verknüpft" },
  { id: "ohne", label: "Ohne Verknüpfung" },
];

export const DEFAULT_DOCUMENT_FILTER: DocumentFilterId = "alle";

/** Die Dokumente, die der gewaehlte Filter uebrig laesst (req-034). */
export function filterDocuments(
  documents: TripDocument[],
  filter: DocumentFilterId,
): TripDocument[] {
  switch (filter) {
    case "poi":
      return documents.filter((document) => document.poiId !== null);
    case "transfer":
      return documents.filter((document) => document.transferId !== null);
    case "ohne":
      return documents.filter(
        (document) => document.poiId === null && document.transferId === null,
      );
    default:
      return documents;
  }
}
