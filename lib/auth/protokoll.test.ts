// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { protokolliereErfolg, protokolliereFehlschlag } from "./protokoll";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Das Log der Anmeldung (req-066)", () => {
  it("nennt Vorgang und Schritt in einer greppbaren Zeile", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});

    protokolliereFehlschlag("passkey-anmeldung", "passkey-unbekannt");

    expect(log).toHaveBeenCalledWith(
      "anmeldung: vorgang=passkey-anmeldung schritt=passkey-unbekannt",
    );
  });

  it("haengt den geworfenen Fehler daneben, nicht in die Zeile", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const grund = new Error("kaputt");

    protokolliereFehlschlag(
      "passkey-einrichten",
      "speichern-fehlgeschlagen",
      grund,
    );

    expect(log).toHaveBeenCalledWith(
      "anmeldung: vorgang=passkey-einrichten schritt=speichern-fehlgeschlagen",
      grund,
    );
  });

  it("haelt auch fest, dass ein Vorgang geglueckt ist", () => {
    // Sonst liesse sich nicht unterscheiden, ob eine Anmeldung gar nicht
    // erst ankam oder unterwegs scheiterte.
    const log = vi.spyOn(console, "info").mockImplementation(() => {});

    protokolliereErfolg("anmeldelink", "3f2b");

    expect(log).toHaveBeenCalledWith(
      "anmeldung: vorgang=anmeldelink schritt=geglueckt",
      { participantId: "3f2b" },
    );
  });
});
