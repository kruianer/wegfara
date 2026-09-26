import { beforeEach, describe, expect, it } from "vitest";
import {
  kartenStatusAus,
  ladeKartenStatus,
  ladeListenEinstellungen,
  listenEinstellungenAus,
  speichereKartenStatus,
  speichereListenEinstellungen,
  VORGEWAEHLTE_LISTEN_EINSTELLUNGEN,
} from "./ansicht-einstellungen";
import { DEFAULT_MAP_VISIBLE_STATUSES } from "./status-meta";

/**
 * Filter und Sortierung der POI-Liste ueberdauern die Komponente (bug-052) --
 * je Reise, in der Sitzungsablage.
 */
describe("Ansichts-Einstellungen der POI-Liste (bug-052)", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it("gibt ohne gemerkten Stand die unbefangene Liste zurueck", () => {
    expect(ladeListenEinstellungen("trip-1")).toEqual(
      VORGEWAEHLTE_LISTEN_EINSTELLUNGEN,
    );
  });

  it("gibt zurueck, was zu dieser Reise gemerkt wurde", () => {
    speichereListenEinstellungen("trip-1", {
      typeFilter: "restaurant",
      statusFilter: "gesetzt",
      sortierung: "name",
    });

    expect(ladeListenEinstellungen("trip-1")).toEqual({
      typeFilter: "restaurant",
      statusFilter: "gesetzt",
      sortierung: "name",
    });
  });

  it("merkt je Reise getrennt -- eine andere Reise faengt unbefangen an", () => {
    speichereListenEinstellungen("trip-1", {
      typeFilter: "restaurant",
      statusFilter: "gesetzt",
      sortierung: "name",
    });

    expect(ladeListenEinstellungen("trip-2")).toEqual(
      VORGEWAEHLTE_LISTEN_EINSTELLUNGEN,
    );
    // Die erste Reise behaelt ihren Stand.
    expect(ladeListenEinstellungen("trip-1").typeFilter).toBe("restaurant");
  });

  it("faellt bei einem beschaedigten Eintrag auf die Vorgabe zurueck", () => {
    window.sessionStorage.setItem("wegfara.plan.poi-liste.trip-1", "{kaputt");

    expect(ladeListenEinstellungen("trip-1")).toEqual(
      VORGEWAEHLTE_LISTEN_EINSTELLUNGEN,
    );
  });

  it("ersetzt unbekannte Werte einzeln durch ihre Vorgabe", () => {
    expect(
      listenEinstellungenAus({
        typeFilter: "kutschfahrt",
        statusFilter: "gesetzt",
        sortierung: "laenge",
      }),
    ).toEqual({
      typeFilter: "alle",
      statusFilter: "gesetzt",
      sortierung: "nummer",
    });
  });

  it("nimmt auch etwas anderes als ein Objekt hin", () => {
    expect(listenEinstellungenAus(null)).toEqual(
      VORGEWAEHLTE_LISTEN_EINSTELLUNGEN,
    );
    expect(listenEinstellungenAus("alle")).toEqual(
      VORGEWAEHLTE_LISTEN_EINSTELLUNGEN,
    );
  });
});

/**
 * Die Statusauswahl der Karte (req-013) hatte dasselbe Problem und wird
 * ebenso gemerkt -- getrennt von den Filtern der Liste (bug-052, Notes).
 */
describe("Ansichts-Einstellungen der Karte (bug-052)", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it("gibt ohne gemerkten Stand die Vorauswahl zurueck", () => {
    expect(ladeKartenStatus("trip-1")).toEqual(DEFAULT_MAP_VISIBLE_STATUSES);
  });

  it("gibt zurueck, was zu dieser Reise gemerkt wurde", () => {
    speichereKartenStatus("trip-1", ["gesetzt", "wenn_zeit"]);

    expect(ladeKartenStatus("trip-1")).toEqual(["gesetzt", "wenn_zeit"]);
  });

  it("laesst eine leere Auswahl leer", () => {
    speichereKartenStatus("trip-1", []);

    expect(ladeKartenStatus("trip-1")).toEqual([]);
  });

  it("wirft unbekannte Status aus der gemerkten Auswahl", () => {
    expect(kartenStatusAus(["gesetzt", "vielleicht"])).toEqual(["gesetzt"]);
  });

  it("faellt bei etwas anderem als einer Liste auf die Vorauswahl zurueck", () => {
    expect(kartenStatusAus("gesetzt")).toEqual(DEFAULT_MAP_VISIBLE_STATUSES);
  });

  it("beruehrt die Filter der Liste nicht", () => {
    speichereKartenStatus("trip-1", ["gesetzt"]);

    expect(ladeListenEinstellungen("trip-1")).toEqual(
      VORGEWAEHLTE_LISTEN_EINSTELLUNGEN,
    );
  });
});
