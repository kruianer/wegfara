import { describe, expect, it, vi } from "vitest";
import type { AiAntwort, AiClient } from "@/lib/ai/client";
import {
  beschreibungsPrompt,
  parseBeschreibung,
  schlageBeschreibungVor,
} from "./beschreibung";
import { POI_SHORT_TEXT_MAX_LENGTH } from "./validate";

/** Eine KI, die diesen Text liefert -- oder, bei null, gar keinen (bug-032). */
function ki(antwort: string | null): AiClient {
  const ergebnis: AiAntwort =
    antwort === null
      ? { ok: false, fehler: { art: "netz", detail: "network down" } }
      : { ok: true, text: antwort };
  return {
    complete: vi.fn(async () => ergebnis),
    completeWithWebSearch: vi.fn(async () => ergebnis),
  };
}

describe("beschreibungsPrompt (req-058)", () => {
  it("nennt Name und Art des Ortes", () => {
    const prompt = beschreibungsPrompt({
      name: "Villa Rufolo",
      type: "sehenswuerdigkeit",
    });

    expect(prompt).toContain("Villa Rufolo");
    expect(prompt).toContain("Sehenswürdigkeit");
  });

  it("nennt die Adresse, wenn sie bekannt ist", () => {
    const prompt = beschreibungsPrompt({
      name: "Villa Rufolo",
      type: "sehenswuerdigkeit",
      address: "Piazza Duomo 1",
      ort: "Ravello",
    });

    expect(prompt).toContain("Piazza Duomo 1");
    expect(prompt).toContain("Ravello");
  });
});

describe("parseBeschreibung (req-058)", () => {
  it("liest Kurz- und Langtext aus der Antwort", () => {
    const beschreibung = parseBeschreibung(
      '{"kurz": "Gärten mit Meerblick", "lang": "Ein Palast aus dem 13. Jahrhundert."}',
    );

    expect(beschreibung).toEqual({
      shortText: "Gärten mit Meerblick",
      longText: "Ein Palast aus dem 13. Jahrhundert.",
    });
  });

  it("findet das JSON auch in einem Codeblock", () => {
    const beschreibung = parseBeschreibung(
      '```json\n{"kurz": "Gärten", "lang": "Ein Palast."}\n```',
    );

    expect(beschreibung?.shortText).toBe("Gärten");
  });

  it("kuerzt einen zu langen Kurztext auf das erlaubte Mass", () => {
    const zuLang = "a".repeat(POI_SHORT_TEXT_MAX_LENGTH + 50);
    const beschreibung = parseBeschreibung(
      JSON.stringify({ kurz: zuLang, lang: "Text" }),
    );

    expect(beschreibung?.shortText).toHaveLength(POI_SHORT_TEXT_MAX_LENGTH);
  });

  it("liefert nichts bei einer Antwort ohne JSON", () => {
    expect(parseBeschreibung("Dazu weiss ich nichts.")).toBeNull();
  });

  it("liefert nichts, wenn beide Texte leer sind", () => {
    expect(parseBeschreibung('{"kurz": "", "lang": ""}')).toBeNull();
  });
});

describe("schlageBeschreibungVor (req-058)", () => {
  it("fragt die KI mit Websuche", async () => {
    const client = ki('{"kurz": "Gärten", "lang": "Ein Palast."}');

    await schlageBeschreibungVor(client, {
      name: "Villa Rufolo",
      type: "sehenswuerdigkeit",
    });

    expect(client.completeWithWebSearch).toHaveBeenCalledOnce();
    expect(client.complete).not.toHaveBeenCalled();
  });

  it("liefert den Vorschlag der KI", async () => {
    const beschreibung = await schlageBeschreibungVor(
      ki('{"kurz": "Gärten", "lang": "Ein Palast."}'),
      { name: "Villa Rufolo", type: "sehenswuerdigkeit" },
    );

    expect(beschreibung?.shortText).toBe("Gärten");
  });

  it("liefert nichts, wenn die KI nicht antwortet", async () => {
    const beschreibung = await schlageBeschreibungVor(ki(null), {
      name: "Villa Rufolo",
      type: "sehenswuerdigkeit",
    });

    expect(beschreibung).toBeNull();
  });
});
