import type { ActivityPosition } from "@/lib/activities/types";
import type { Transfer } from "./types";
import type { TransferInputValues } from "./validate";
import type { TransferVorschlag } from "./vorschlag";

/**
 * Anlegen, Aendern und Entfernen eines Transfers (req-052) sowie das Holen
 * seines Vorschlags. Alles ist sofort gespeichert -- die Oberflaeche zeigt
 * das Ergebnis erst, wenn es geschrieben ist. Ein fehlgeschlagener Aufruf
 * liefert null und darf nicht stillschweigend als gespeichert erscheinen
 * (wie bei den Programmpunkten, siehe lib/activities/save-activity.ts).
 */

const TRANSFERS_API = "/api/transfers";

/** Warum es keinen Vorschlag gibt (req-052) -- die Oberflaeche nennt beides. */
export type VorschlagGrund = "ohne_position" | "dienst_stumm";

export interface VorschlagAntwort {
  vorschlag: TransferVorschlag | null;
  grund: VorschlagGrund | null;
}

async function transferAntwort(response: Response): Promise<Transfer | null> {
  if (!response.ok) return null;
  try {
    return (
      ((await response.json()) as { transfer?: Transfer }).transfer ?? null
    );
  } catch {
    return null;
  }
}

/**
 * Der Vorschlag zu einem Programmpunkt-Paar. Ohne Vorschlag steht der Grund
 * darin; ist der Server selbst nicht erreichbar, gilt dasselbe wie bei einem
 * stummen Routing-Dienst -- die Angaben werden von Hand eingetragen.
 */
export async function ladeTransferVorschlag(
  fromActivityId: string,
  toActivityId: string,
): Promise<VorschlagAntwort> {
  const stumm: VorschlagAntwort = { vorschlag: null, grund: "dienst_stumm" };
  try {
    const response = await fetch(
      `${TRANSFERS_API}/vorschlag?von=${encodeURIComponent(fromActivityId)}` +
        `&nach=${encodeURIComponent(toActivityId)}`,
    );
    if (!response.ok) return stumm;

    const body = (await response.json()) as Partial<VorschlagAntwort>;
    return {
      vorschlag: body.vorschlag ?? null,
      grund: body.vorschlag ? null : (body.grund ?? "dienst_stumm"),
    };
  } catch {
    return stumm;
  }
}

/**
 * Der Strassenverlauf der genannten Transfers (req-059), je Kennung eine
 * Punktfolge. Was fehlt, zeichnet die Karte als Gerade -- ist der Server oder
 * der Routing-Dienst stumm, bleibt die Antwort leer, und auf der Karte steht
 * keine Fehlermeldung.
 */
export async function ladeTransferVerlaeufe(
  transferIds: string[],
): Promise<Record<string, ActivityPosition[]>> {
  if (transferIds.length === 0) return {};

  try {
    const response = await fetch(
      `${TRANSFERS_API}/verlauf?ids=${encodeURIComponent(transferIds.join(","))}`,
    );
    if (!response.ok) return {};

    const body = (await response.json()) as {
      verlaeufe?: Record<string, ActivityPosition[]>;
    };
    return body.verlaeufe ?? {};
  } catch {
    return {};
  }
}

/** Legt den Transfer zwischen zwei Programmpunkten an. */
export async function saveNewTransfer(
  fromActivityId: string,
  toActivityId: string,
  values: TransferInputValues,
): Promise<Transfer | null> {
  try {
    return await transferAntwort(
      await fetch(TRANSFERS_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...values, fromActivityId, toActivityId }),
      }),
    );
  } catch {
    return null;
  }
}

/** Aendert Verkehrsmittel, Titel, Dauer und Strecke eines Transfers. */
export async function saveTransferChanges(
  transferId: string,
  values: TransferInputValues,
): Promise<Transfer | null> {
  try {
    return await transferAntwort(
      await fetch(TRANSFERS_API, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...values, id: transferId }),
      }),
    );
  } catch {
    return null;
  }
}

/** Entfernt einen Transfer und liefert den entfernten zurueck. */
export async function removeTransfer(
  transferId: string,
): Promise<Transfer | null> {
  try {
    return await transferAntwort(
      await fetch(TRANSFERS_API, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: transferId }),
      }),
    );
  } catch {
    return null;
  }
}
