import { beforeEach, describe, expect, it } from "vitest";
import {
  kartenStatusAus,
  ladeKartenStatus,
  ladeListenEinstellungen,
  ladePlanFilter,
  listenEinstellungenAus,
  speichereKartenStatus,
  speichereListenEinstellungen,
  speicherePlanFilter,
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
      gegendFilter: "alle",
      sortierung: "name",
    });

    expect(ladeListenEinstellungen("trip-1")).toEqual({
      typeFilter: "restaurant",
      statusFilter: "gesetzt",
      gegendFilter: "alle",
      sortierung: "name",
    });
  });

  it("merkt je Reise getrennt -- eine andere Reise faengt unbefangen an", () => {
    speichereListenEinstellungen("trip-1", {
      typeFilter: "restaurant",
      statusFilter: "gesetzt",
      gegendFilter: "alle",
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
        gegendFilter: "alle",
        sortierung: "laenge",
      }),
    ).toEqual({
      typeFilter: "alle",
      statusFilter: "gesetzt",
      gegendFilter: "alle",
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

/**
 * Der Filter der POI-Auswahl in der Planung (req-083) ueberdauert den
 * Wechsel des Reisetages und des Planer-Bereichs ebenso wie die beiden
 * obigen -- je Reise, in der Sitzungsablage, und faellt beim Reisewechsel
 * auf "Alle" zurueck.
 */
describe("Plan-Filter der POI-Auswahl (req-083)", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it('gibt ohne gemerkten Stand "Alle" zurueck', () => {
    expect(ladePlanFilter("trip-1")).toBe("alle");
  });

  it("gibt zurueck, was zu dieser Reise gemerkt wurde", () => {
    speicherePlanFilter("trip-1", "unverplant");

    expect(ladePlanFilter("trip-1")).toBe("unverplant");
  });

  it('merkt je Reise getrennt -- eine andere Reise faengt bei "Alle" an', () => {
    speicherePlanFilter("trip-1", "verplant");

    expect(ladePlanFilter("trip-2")).toBe("alle");
    expect(ladePlanFilter("trip-1")).toBe("verplant");
  });

  it('faellt bei einem unbekannten Wert auf "Alle" zurueck', () => {
    window.sessionStorage.setItem(
      "wegfara.plan.planung-filter.trip-1",
      '"irgendwas"',
    );

    expect(ladePlanFilter("trip-1")).toBe("alle");
  });

  it("beruehrt die Filter der Liste und der Karte nicht", () => {
    speicherePlanFilter("trip-1", "verplant");

    expect(ladeListenEinstellungen("trip-1")).toEqual(
      VORGEWAEHLTE_LISTEN_EINSTELLUNGEN,
    );
    expect(ladeKartenStatus("trip-1")).toEqual(DEFAULT_MAP_VISIBLE_STATUSES);
  });
});
