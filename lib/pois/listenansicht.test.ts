import { describe, expect, it } from "vitest";
import {
  anzahlGesetzterFilter,
  filterChips,
  filterUmschalten,
  gefiltertePois,
  leereListeGrund,
  ohneFilterwert,
  passtZurSuche,
  POI_AUSWAHL_SORTIERUNGEN,
  POI_SORTIERUNGEN,
  sortierRichtung,
  sortiertePois,
  LEERER_POI_FILTER,
  VORGEWAEHLTE_SORTIERUNG,
  type PoiFilter,
} from "./listenansicht";
import type { Poi } from "./types";

function poi(overrides: Partial<Poi> & { id: string; name: string }): Poi {
  return {
    tripId: "trip-1",
    number: 1,
    ort: "Ravello",
    type: "sehenswuerdigkeit",
    position: { lat: 40.85, lng: 14.27 },
    status: "weiss_nicht",
    ...overrides,
  };
}

const POIS: Poi[] = [
  poi({ id: "a", name: "Villa Rufolo", number: 1, status: "gesetzt" }),
  poi({
    id: "b",
    name: "Trattoria da Nennella",
    number: 2,
    type: "restaurant",
    status: "gesetzt",
  }),
  poi({
    id: "c",
    name: "Da Vincenzo",
    number: 3,
    type: "restaurant",
    status: "wenn_zeit",
  }),
];

function filter(overrides: Partial<PoiFilter> = {}): PoiFilter {
  return { ...LEERER_POI_FILTER, ...overrides };
}

describe("gefiltertePois (req-060)", () => {
  it("zeigt ohne Filter alle POIs", () => {
    expect(gefiltertePois(POIS, LEERER_POI_FILTER)).toEqual(POIS);
  });

  it("zeigt bei gewaehltem Typ nur POIs dieses Typs", () => {
    const gezeigt = gefiltertePois(
      POIS,
      filter({ typeFilter: ["restaurant"] }),
    );

    expect(gezeigt.map((p) => p.id)).toEqual(["b", "c"]);
  });

  it("zeigt bei gewaehltem Status nur POIs dieses Status", () => {
    const gezeigt = gefiltertePois(POIS, filter({ statusFilter: ["gesetzt"] }));

    expect(gezeigt.map((p) => p.id)).toEqual(["a", "b"]);
  });

  it("verlangt beide Filter zugleich", () => {
    const gezeigt = gefiltertePois(
      POIS,
      filter({ typeFilter: ["restaurant"], statusFilter: ["gesetzt"] }),
    );

    expect(gezeigt.map((p) => p.id)).toEqual(["b"]);
  });

  it("laesst die Reihenfolge, in der die POIs hereinkommen", () => {
    const gezeigt = gefiltertePois(
      [...POIS].reverse(),
      filter({ statusFilter: ["gesetzt"] }),
    );

    expect(gezeigt.map((p) => p.id)).toEqual(["b", "a"]);
  });
});

describe("gefiltertePois -- Mehrfachwahl je Feld (req-098)", () => {
  const SAMMLUNG: Poi[] = [
    poi({
      id: "fix-bio",
      name: "Guggenheim",
      status: "gesetzt",
      gegend: "BIO",
    }),
    poi({
      id: "alt-bio",
      name: "Mercado",
      status: "wahrscheinlich",
      gegend: "BIO",
      type: "restaurant",
    }),
    poi({ id: "fix-sse", name: "Concha", status: "gesetzt", gegend: "SSE" }),
    poi({
      id: "nein-bio",
      name: "Carlton",
      status: "auf_keinen_fall",
      gegend: "BIO",
    }),
    poi({ id: "offen-ohne", name: "Puente", status: "weiss_nicht" }),
  ];

  it("verbindet zwei Status mit „oder“", () => {
    const gezeigt = gefiltertePois(
      SAMMLUNG,
      filter({ statusFilter: ["gesetzt", "wahrscheinlich"] }),
    );

    expect(gezeigt.map((p) => p.id)).toEqual(["fix-bio", "alt-bio", "fix-sse"]);
  });

  it("verbindet Status und Gegend mit „und“", () => {
    const gezeigt = gefiltertePois(
      SAMMLUNG,
      filter({ statusFilter: ["gesetzt"], gegendFilter: ["BIO"] }),
    );

    expect(gezeigt.map((p) => p.id)).toEqual(["fix-bio"]);
  });

  it("filtert in einem Feld ohne Wahl nicht", () => {
    const nurGegend = gefiltertePois(
      SAMMLUNG,
      filter({ statusFilter: [], typeFilter: [], gegendFilter: ["BIO"] }),
    );

    // Alle Status und alle Typen der Gegend BIO.
    expect(nurGegend.map((p) => p.id)).toEqual([
      "fix-bio",
      "alt-bio",
      "nein-bio",
    ]);
  });

  it("nimmt bei der Gegend auch „ohne“ in die Menge", () => {
    const gezeigt = gefiltertePois(
      SAMMLUNG,
      filter({ gegendFilter: ["SSE", "ohne"] }),
    );

    expect(gezeigt.map((p) => p.id)).toEqual(["fix-sse", "offen-ohne"]);
  });
});

describe("Suche in der POI-Liste (req-098)", () => {
  const SAMMLUNG: Poi[] = [
    poi({
      id: "gugg",
      name: "Guggenheim-Museum",
      ort: "Bilbao",
      status: "gesetzt",
    }),
    poi({
      id: "merc",
      name: "Mercado de la Ribera",
      ort: "Bilbao",
      status: "wahrscheinlich",
    }),
    poi({
      id: "conc",
      name: "Playa de la Concha",
      ort: "San Sebastián",
      status: "gesetzt",
    }),
  ];

  it("findet „Gugg“ im Namen", () => {
    expect(
      gefiltertePois(SAMMLUNG, LEERER_POI_FILTER, "Gugg").map((p) => p.id),
    ).toEqual(["gugg"]);
  });

  it("findet die POIs eines Orts", () => {
    expect(
      gefiltertePois(SAMMLUNG, LEERER_POI_FILTER, "Bilbao").map((p) => p.id),
    ).toEqual(["gugg", "merc"]);
  });

  it("achtet weder auf Gross- und Kleinschreibung noch auf Akzente", () => {
    expect(passtZurSuche(SAMMLUNG[2], "san sebastian")).toBe(true);
    expect(passtZurSuche(SAMMLUNG[0], "  GUGG ")).toBe(true);
  });

  it("laesst bei leerem Begriff jeden durch", () => {
    expect(gefiltertePois(SAMMLUNG, LEERER_POI_FILTER, "  ")).toEqual(SAMMLUNG);
  });

  it("wirkt zusaetzlich zu den Filtern", () => {
    const gezeigt = gefiltertePois(
      SAMMLUNG,
      filter({ statusFilter: ["gesetzt"] }),
      "Bilbao",
    );

    expect(gezeigt.map((p) => p.id)).toEqual(["gugg"]);
  });
});

describe("Gesetzte Filter, Chips und Leermeldung (req-098)", () => {
  it("zaehlt die Felder mit Wahl, nicht die Werte", () => {
    expect(anzahlGesetzterFilter(LEERER_POI_FILTER)).toBe(0);
    expect(
      anzahlGesetzterFilter(
        filter({
          statusFilter: ["gesetzt", "wahrscheinlich"],
          gegendFilter: ["BIO"],
        }),
      ),
    ).toBe(2);
  });

  it("stellt jeden gewaehlten Wert als Chip auf, Status zuerst", () => {
    expect(
      filterChips(
        filter({
          typeFilter: ["strand"],
          statusFilter: ["wahrscheinlich", "gesetzt"],
          gegendFilter: ["BIO", "ohne"],
        }),
      ).map((chip) => chip.label),
    ).toEqual(["Fix", "Alternative", "BIO", "ohne", "Strand"]);
  });

  it("nimmt mit dem Kreuz eines Chips genau diesen Wert heraus", () => {
    const vorher = filter({
      statusFilter: ["gesetzt", "wahrscheinlich"],
      gegendFilter: ["BIO"],
    });

    expect(ohneFilterwert(vorher, { feld: "status", wert: "gesetzt" })).toEqual(
      filter({ statusFilter: ["wahrscheinlich"], gegendFilter: ["BIO"] }),
    );
    expect(ohneFilterwert(vorher, { feld: "gegend", wert: "BIO" })).toEqual(
      filter({ statusFilter: ["gesetzt", "wahrscheinlich"] }),
    );
  });

  it("schaltet einen Wert mit der Pille an und wieder aus", () => {
    const an = filterUmschalten(LEERER_POI_FILTER, "typ", "hotel");
    expect(an.typeFilter).toEqual(["hotel"]);
    expect(filterUmschalten(an, "typ", "hotel")).toEqual(LEERER_POI_FILTER);
  });

  it("nennt in der Leermeldung die gesetzten Filter", () => {
    expect(
      leereListeGrund(
        filter({ statusFilter: ["auf_keinen_fall"], gegendFilter: ["RIO"] }),
      ),
    ).toBe("Status „Nein“ und Gegend „RIO“ kommen zusammen nicht vor.");
    expect(leereListeGrund(filter({ typeFilter: ["hotel"] }))).toBe(
      "Typ „Hotel“ kommt nicht vor.",
    );
    expect(
      leereListeGrund(filter({ statusFilter: ["gesetzt", "wahrscheinlich"] })),
    ).toBe("Status „Fix“ oder „Alternative“ kommen nicht vor.");
  });

  it("nennt in der Leermeldung auch den Suchbegriff", () => {
    expect(leereListeGrund(LEERER_POI_FILTER, "Louvre")).toBe(
      "Die Suche „Louvre“ findet nichts in Name und Ort.",
    );
    expect(
      leereListeGrund(filter({ statusFilter: ["gesetzt"] }), "Louvre"),
    ).toBe("Die Suche „Louvre“ und Status „Fix“ kommen zusammen nicht vor.");
  });
});

describe("Richtung der Sortierung (req-098)", () => {
  it("nennt fuer jede Ordnung ihre Richtung", () => {
    const pois = [
      poi({ id: "a", name: "A", number: 1 }),
      poi({ id: "b", name: "B", number: 32 }),
    ];

    expect(POI_SORTIERUNGEN.map((art) => sortierRichtung(art, pois))).toEqual([
      "1 → 32",
      "A → Z",
      "Fix zuerst",
      "beste zuerst",
    ]);
  });
});

describe("sortiertePois (req-060)", () => {
  const NACH_NUMMER: Poi[] = [
    poi({ id: "a", name: "Villa Rufolo", number: 1, status: "wenn_zeit" }),
    poi({
      id: "b",
      name: "Ausgrabungsstätte Pompeji",
      number: 2,
      status: "gesetzt",
      bewertung: 4.5,
    }),
    poi({
      id: "c",
      name: "Bucht bei Praiano",
      number: 3,
      status: "weiss_nicht",
      bewertung: 4.8,
    }),
  ];

  /** Die Sortierung arbeitet auf einer beliebigen Reihenfolge. */
  const GEMISCHT = [NACH_NUMMER[2], NACH_NUMMER[0], NACH_NUMMER[1]];

  it("ordnet vorgewaehlt nach Nummer", () => {
    expect(
      sortiertePois(GEMISCHT, VORGEWAEHLTE_SORTIERUNG).map((p) => p.number),
    ).toEqual([1, 2, 3]);
    expect(VORGEWAEHLTE_SORTIERUNG).toBe("nummer");
  });

  it("ordnet nach Name", () => {
    expect(sortiertePois(GEMISCHT, "name").map((p) => p.name)).toEqual([
      "Ausgrabungsstätte Pompeji",
      "Bucht bei Praiano",
      "Villa Rufolo",
    ]);
  });

  it("ordnet nach Status, Gesetzt zuerst", () => {
    expect(sortiertePois(GEMISCHT, "status").map((p) => p.id)).toEqual([
      "b",
      "c",
      "a",
    ]);
  });

  it("ordnet nach Bewertung, die beste zuerst", () => {
    expect(sortiertePois(GEMISCHT, "bewertung").map((p) => p.id)).toEqual([
      "c",
      "b",
      "a",
    ]);
  });

  it("stellt POIs ohne Bewertung ans Ende", () => {
    const ohne = [
      poi({ id: "x", name: "Ohne", number: 1 }),
      poi({ id: "y", name: "Auch ohne", number: 2 }),
      poi({ id: "z", name: "Mit", number: 3, bewertung: 3.1 }),
    ];

    expect(sortiertePois(ohne, "bewertung").map((p) => p.id)).toEqual([
      "z",
      "x",
      "y",
    ]);
  });

  it("entscheidet bei gleichem Wert nach der Nummer", () => {
    const gleich = [
      poi({ id: "spaet", name: "Gleich", number: 9, bewertung: 4 }),
      poi({ id: "frueh", name: "Gleich", number: 2, bewertung: 4 }),
    ];

    expect(sortiertePois(gleich, "bewertung").map((p) => p.id)).toEqual([
      "frueh",
      "spaet",
    ]);
    expect(sortiertePois(gleich, "name").map((p) => p.id)).toEqual([
      "frueh",
      "spaet",
    ]);
  });

  it("laesst die hereingereichte Liste unveraendert", () => {
    const vorher = [...GEMISCHT];

    sortiertePois(GEMISCHT, "name");

    expect(GEMISCHT).toEqual(vorher);
  });
});

/**
 * Das Feld „Verplanung“ und die Ordnung „Dauer“ der POI-Auswahl (req-099) --
 * in derselben Filterlogik wie die POI-Liste, kein zweiter Weg.
 */
describe("Verplanung und Dauer in der POI-Auswahl (req-099)", () => {
  const SSE_FREI = poi({
    id: "sse-frei",
    name: "Playa de la Concha",
    number: 3,
    gegend: "SSE",
    durationMinutes: 45,
  });
  const SSE_VERPLANT = poi({
    id: "sse-verplant",
    name: "Monte Igueldo",
    number: 2,
    gegend: "SSE",
  });
  const BIO_FREI = poi({
    id: "bio-frei",
    name: "Guggenheim",
    number: 1,
    gegend: "BIO",
  });
  const alle = [BIO_FREI, SSE_VERPLANT, SSE_FREI];
  const counts = new Map([[SSE_VERPLANT.id, 1]]);
  const filter = (teil: Partial<PoiFilter>): PoiFilter => ({
    ...LEERER_POI_FILTER,
    ...teil,
  });

  it("verknuepft „Noch unverplant“ und Gegend „SSE“ mit und", () => {
    expect(
      gefiltertePois(
        alle,
        filter({ planFilter: ["unverplant"], gegendFilter: ["SSE"] }),
        "",
        counts,
      ),
    ).toEqual([SSE_FREI]);
  });

  it("verknuepft beide Werte der Verplanung mit oder", () => {
    expect(
      gefiltertePois(
        alle,
        filter({ planFilter: ["unverplant", "verplant"] }),
        "",
        counts,
      ),
    ).toEqual(alle);
  });

  it("zaehlt die Verplanung als gesetzten Filter und stellt ihren Chip vorn", () => {
    const gesetzt = filter({
      planFilter: ["unverplant"],
      gegendFilter: ["SSE"],
    });

    expect(anzahlGesetzterFilter(gesetzt)).toBe(2);
    expect(filterChips(gesetzt).map((chip) => chip.label)).toEqual([
      "Noch unverplant",
      "SSE",
    ]);
  });

  it("schaltet einen Wert der Verplanung an und ueber den Chip wieder ab", () => {
    const an = filterUmschalten(filter({}), "verplanung", "verplant");
    expect(an.planFilter).toEqual(["verplant"]);

    expect(
      ohneFilterwert(an, { feld: "verplanung", wert: "verplant" }).planFilter,
    ).toEqual([]);
  });

  it("nennt die Verplanung in der Leermeldung", () => {
    expect(
      leereListeGrund(
        filter({ planFilter: ["verplant"], gegendFilter: ["BIO"] }),
      ),
    ).toBe(
      "Verplanung „Mindestens einmal“ und Gegend „BIO“ kommen zusammen nicht vor.",
    );
  });

  it("laesst die POI-Liste ohne die Verplanung filtern wie bisher", () => {
    expect(gefiltertePois(alle, filter({ gegendFilter: ["SSE"] }))).toEqual([
      SSE_VERPLANT,
      SSE_FREI,
    ]);
  });

  it("kennt in der Auswahl fuenf Ordnungen, die fuenfte ist die Dauer -- die Liste behaelt vier", () => {
    expect(POI_AUSWAHL_SORTIERUNGEN).toEqual([...POI_SORTIERUNGEN, "dauer"]);
    expect(POI_SORTIERUNGEN).not.toContain("dauer");
    expect(sortierRichtung("dauer", alle)).toBe("kürzeste zuerst");
  });

  it("ordnet nach Dauer die kuerzeste zuerst, bei gleicher nach Nummer", () => {
    // Ohne eingetragene Dauer gilt die geschaetzte des Typs: 2,5 h.
    expect(sortiertePois(alle, "dauer").map((p) => p.id)).toEqual([
      SSE_FREI.id,
      BIO_FREI.id,
      SSE_VERPLANT.id,
    ]);
  });
});
