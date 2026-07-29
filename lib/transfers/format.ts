import type { Transfer } from "./types";

/** z.B. "12 Min · 4,2 km" aus Dauer und Distanz eines Transfers. */
export function formatTransferMeta(
  transfer: Pick<Transfer, "durationMin" | "distanceKm">,
): string {
  const distance = transfer.distanceKm.toFixed(1).replace(".", ",");
  return `${transfer.durationMin} Min · ${distance} km`;
}
