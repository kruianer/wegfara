import { fireEvent } from "@testing-library/react";

/**
 * Wo ein Block des Zeitstrahls im Raster liegt -- sein `top`. jsdom rechnet
 * kein Layout; die Oberkante des Rasters liegt dort bei 0, weshalb diese
 * Stelle zugleich das clientY ist, an dem der Block beginnt.
 */
export function blockOberkante(block: HTMLElement): number {
  return Number.parseFloat(block.style.top) || 0;
}

/**
 * Fasst einen liegenden Programmpunkt mit der Maus an (bug-066) -- als
 * Vorgabe an seiner Oberkante, so dass der Zeiger seinen Beginn fuehrt.
 * jsdom kennt kein DragEvent; React behandelt das MouseEvent gleich.
 */
export function programmpunktAnfassen(
  block: HTMLElement,
  clientY = blockOberkante(block),
) {
  fireEvent.pointerDown(block, { pointerType: "mouse", clientY });
  fireEvent(
    block,
    new MouseEvent("dragstart", { bubbles: true, cancelable: true, clientY }),
  );
}
