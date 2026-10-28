import { beforeEach, describe, expect, it } from "vitest";
import {
  kartenStatusAus,
  ladeAuswahlZugeklappt,
  speichereAuswahlZugeklappt,
  ladeKartenStatus,
  ladeSuchgebietAusgeblendet,
  speichereSuchgebietAusgeblendet,
  ladeListenEinstellungen,
  ladeAuswahlEinstellungen,
  auswahlEinstellungenAus,
  listenEinstellungenAus,
  speichereKartenStatus,
  speichereListenEinstellungen,
  speichereAuswahlEinstellungen,
  VORGEWAEHLTE_AUSWAHL_EINSTELLUNGEN,
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

  it("gibt zurueck, was zu dieser Reise gemerkt wurde -- auch mehrere Werte je Feld (req-098)", () => {
    speichereListenEinstellungen("trip-1", {
      typeFilter: ["restaurant"],
      statusFilter: ["gesetzt", "wahrscheinlich"],
      gegendFilter: ["Bilbao", "ohne"],
      sortierung: "name",
    });

    expect(ladeListenEinstellungen("trip-1")).toEqual({
      typeFilter: ["restaurant"],
      statusFilter: ["gesetzt", "wahrscheinlich"],
      gegendFilter: ["Bilbao", "ohne"],
      sortierung: "name",
    });
  });

  it("macht aus einem alten Stand mit einzelnen Werten Mengen (req-098)", () => {
    // So stand es bis req-098 in der Ablage: ein Wert je Feld oder "alle".
    window.sessionStorage.setItem(
      "wegfara.plan.poi-liste.trip-1",
      JSON.stringify({
        typeFilter: "alle",
        statusFilter: "gesetzt",
        gegendFilter: "Bilbao",
        sortierung: "status",
      }),
    );

    expect(ladeListenEinstellungen("trip-1")).toEqual({
      typeFilter: [],
      statusFilter: ["gesetzt"],
      gegendFilter: ["Bilbao"],
      sortierung: "status",
    });
  });

  it("merkt keinen Suchbegriff (req-098)", () => {
    speichereListenEinstellungen("trip-1", {
      ...VORGEWAEHLTE_LISTEN_EINSTELLUNGEN,
      // Was ein Aufrufer versehentlich mitgibt, kommt nicht zurueck.
      ...({ suche: "Gugg" } as object),
    });

    expect(ladeListenEinstellungen("trip-1")).not.toHaveProperty("suche");
  });

  it("merkt je Reise getrennt -- eine andere Reise faengt unbefangen an", () => {
    speichereListenEinstellungen("trip-1", {
      typeFilter: ["restaurant"],
      statusFilter: ["gesetzt"],
      gegendFilter: [],
      sortierung: "name",
    });

    expect(ladeListenEinstellungen("trip-2")).toEqual(
      VORGEWAEHLTE_LISTEN_EINSTELLUNGEN,
    );
    // Die erste Reise behaelt ihren Stand.
    expect(ladeListenEinstellungen("trip-1").typeFilter).toEqual([
      "restaurant",
    ]);
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
        typeFilter: ["kutschfahrt", "strand"],
        statusFilter: "gesetzt",
        gegendFilter: ["", 7, "Bilbao"],
        sortierung: "laenge",
      }),
    ).toEqual({
      typeFilter: ["strand"],
      statusFilter: ["gesetzt"],
      gegendFilter: ["Bilbao"],
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
 * Filter und Sortierung der POI-Auswahl in der Planung (req-083, req-099)
 * ueberdauern den Wechsel des Reisetages und des Planer-Bereichs ebenso wie
 * die beiden obigen -- je Reise, in der Sitzungsablage, und fallen beim
 * Reisewechsel auf die Vorgabe zurueck.
 */
describe("Einstellungen der POI-Auswahl (req-083, req-099)", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it("gibt ohne gemerkten Stand die Vorgabe zurueck -- nichts gefiltert", () => {
    expect(ladeAuswahlEinstellungen("trip-1")).toEqual(
      VORGEWAEHLTE_AUSWAHL_EINSTELLUNGEN,
    );
    expect(VORGEWAEHLTE_AUSWAHL_EINSTELLUNGEN.planFilter).toEqual([]);
  });

  it("gibt zurueck, was zu dieser Reise gemerkt wurde -- auch die Dauer als Ordnung", () => {
    const einstellungen = {
      ...VORGEWAEHLTE_AUSWAHL_EINSTELLUNGEN,
      planFilter: ["unverplant" as const],
      gegendFilter: ["SSE"],
      sortierung: "dauer" as const,
    };
    speichereAuswahlEinstellungen("trip-1", einstellungen);

    expect(ladeAuswahlEinstellungen("trip-1")).toEqual(einstellungen);
  });

  it("merkt je Reise getrennt -- eine andere Reise faengt bei der Vorgabe an", () => {
    speichereAuswahlEinstellungen("trip-1", {
      ...VORGEWAEHLTE_AUSWAHL_EINSTELLUNGEN,
      planFilter: ["verplant"],
    });

    expect(ladeAuswahlEinstellungen("trip-2")).toEqual(
      VORGEWAEHLTE_AUSWAHL_EINSTELLUNGEN,
    );
    expect(ladeAuswahlEinstellungen("trip-1").planFilter).toEqual(["verplant"]);
  });

  it("liest die beiden einzelnen Filter von vor req-099 als Mengen", () => {
    window.sessionStorage.setItem(
      "wegfara.plan.planung-filter.trip-1",
      '"unverplant"',
    );
    window.sessionStorage.setItem(
      "wegfara.plan.poi-auswahl-gegend.trip-1",
      '"Bilbao"',
    );

    expect(ladeAuswahlEinstellungen("trip-1")).toMatchObject({
      planFilter: ["unverplant"],
      gegendFilter: ["Bilbao"],
    });
  });

  it('macht aus dem alten "alle" die leere Menge und verwirft Unbekanntes', () => {
    expect(auswahlEinstellungenAus({ planFilter: "alle" }).planFilter).toEqual(
      [],
    );
    expect(
      auswahlEinstellungenAus({ planFilter: ["irgendwas", "verplant"] })
        .planFilter,
    ).toEqual(["verplant"]);
  });

  it("merkt keinen Suchbegriff", () => {
    speichereAuswahlEinstellungen("trip-1", {
      ...VORGEWAEHLTE_AUSWAHL_EINSTELLUNGEN,
      suche: "Concha",
    } as typeof VORGEWAEHLTE_AUSWAHL_EINSTELLUNGEN);

    expect(
      window.sessionStorage.getItem("wegfara.plan.poi-auswahl.trip-1"),
    ).not.toMatch(/Concha/);
  });

  it("laesst „Dauer“ in der POI-Liste nicht gelten -- dort steht sie nicht", () => {
    expect(listenEinstellungenAus({ sortierung: "dauer" }).sortierung).toBe(
      "nummer",
    );
  });

  it("beruehrt die Filter der Liste und der Karte nicht", () => {
    speichereAuswahlEinstellungen("trip-1", {
      ...VORGEWAEHLTE_AUSWAHL_EINSTELLUNGEN,
      planFilter: ["verplant"],
    });

    expect(ladeListenEinstellungen("trip-1")).toEqual(
      VORGEWAEHLTE_LISTEN_EINSTELLUNGEN,
    );
    expect(ladeKartenStatus("trip-1")).toEqual(DEFAULT_MAP_VISIBLE_STATUSES);
  });
});
/**
 * Ob die POI-Auswahl zugeklappt ist (req-099) -- je Reise gemerkt wie die
 * Filter (bug-052).
 */
describe("Zugeklappte POI-Auswahl (req-099)", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it("steht ohne gemerkten Stand offen", () => {
    expect(ladeAuswahlZugeklappt("trip-1")).toBe(false);
  });

  it("merkt je Reise getrennt", () => {
    speichereAuswahlZugeklappt("trip-1", true);

    expect(ladeAuswahlZugeklappt("trip-1")).toBe(true);
    expect(ladeAuswahlZugeklappt("trip-2")).toBe(false);
  });

  it("steht nach dem Aufklappen wieder offen", () => {
    speichereAuswahlZugeklappt("trip-1", true);
    speichereAuswahlZugeklappt("trip-1", false);

    expect(ladeAuswahlZugeklappt("trip-1")).toBe(false);
  });

  it("laesst die Auswahl bei einem unbrauchbaren Eintrag offen", () => {
    window.sessionStorage.setItem("wegfara.plan.poi-auswahl-zu.trip-1", '"ja"');

    expect(ladeAuswahlZugeklappt("trip-1")).toBe(false);
  });
});

/**
 * Ob das Suchgebiet auf der Karte ausgeblendet ist (req-102) -- je Reise
 * gemerkt wie die Statusauswahl der Karte (bug-052).
 */
describe("Ausgeblendetes Suchgebiet (req-102)", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it("ist ohne gemerkten Stand sichtbar", () => {
    expect(ladeSuchgebietAusgeblendet("trip-1")).toBe(false);
  });

  it("merkt je Reise getrennt", () => {
    speichereSuchgebietAusgeblendet("trip-1", true);

    expect(ladeSuchgebietAusgeblendet("trip-1")).toBe(true);
    expect(ladeSuchgebietAusgeblendet("trip-2")).toBe(false);
  });

  it("ist nach dem Einblenden wieder sichtbar", () => {
    speichereSuchgebietAusgeblendet("trip-1", true);
    speichereSuchgebietAusgeblendet("trip-1", false);

    expect(ladeSuchgebietAusgeblendet("trip-1")).toBe(false);
  });

  it("laesst das Gebiet bei einem unbrauchbaren Eintrag sichtbar", () => {
    window.sessionStorage.setItem("wegfara.plan.suchgebiet-aus.trip-1", '"ja"');

    expect(ladeSuchgebietAusgeblendet("trip-1")).toBe(false);
  });
});
