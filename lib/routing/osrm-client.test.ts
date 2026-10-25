// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createOsrmClient,
  environmentOsrmBaseUrl,
  OSRM_WARTEZEITEN_MS,
} from "./osrm-client";

const PRAIANO = { lat: 40.6114, lng: 14.6896 };
const POSITANO = { lat: 40.6281, lng: 14.4842 };

function antwort(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** Die Adresse, die der Client beim ersten Aufruf angefragt hat. */
function angefragteUrl(fetchMock: { mock: { calls: unknown[][] } }): string {
  return String(fetchMock.mock.calls[0]?.[0]);
}

function client(fetchMock: unknown, baseUrl = "https://osrm.example") {
  return createOsrmClient({
    baseUrl,
    fetch: fetchMock as unknown as typeof fetch,
    // Wiederholt wird ohne Pause -- die Wartezeiten prueft bug-067 eigens.
    wartezeitenMs: [0, 0],
  });
}

describe("createOsrmClient (req-051)", () => {
  it("liefert die Fahrzeit der Route in Minuten", async () => {
    const fetchMock = vi.fn(async () =>
      antwort({ code: "Ok", routes: [{ duration: 1500 }] }),
    );

    expect(
      await client(fetchMock).fahrzeitMinuten(PRAIANO, POSITANO),
    ).toBeCloseTo(25);
  });

  it("fragt OSRM mit Laenge vor Breite", async () => {
    const fetchMock = vi.fn(async () =>
      antwort({ code: "Ok", routes: [{ duration: 60 }] }),
    );

    await client(fetchMock).fahrzeitMinuten(PRAIANO, POSITANO);

    expect(fetchMock).toHaveBeenCalledWith(
      "https://osrm.example/route/v1/driving/" +
        "14.6896,40.6114;14.4842,40.6281?overview=false&alternatives=false",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it("liefert null, wenn der Dienst nicht erreichbar ist", async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error("network down");
    });

    expect(
      await client(fetchMock).fahrzeitMinuten(PRAIANO, POSITANO),
    ).toBeNull();
  });

  it("liefert null bei einer Fehler-Antwort", async () => {
    const fetchMock = vi.fn(async () => antwort({}, 502));

    expect(
      await client(fetchMock).fahrzeitMinuten(PRAIANO, POSITANO),
    ).toBeNull();
  });

  it("liefert null, wenn OSRM keine Route kennt", async () => {
    const fetchMock = vi.fn(async () =>
      antwort({ code: "NoRoute", routes: [] }),
    );

    expect(
      await client(fetchMock).fahrzeitMinuten(PRAIANO, POSITANO),
    ).toBeNull();
  });

  it("liefert null bei unlesbarer Antwort", async () => {
    const fetchMock = vi.fn(
      async () => new Response("kein json", { status: 200 }),
    );

    expect(
      await client(fetchMock).fahrzeitMinuten(PRAIANO, POSITANO),
    ).toBeNull();
  });
});

describe("createOsrmClient -- Strecke (req-052)", () => {
  it("liefert Laenge und Dauer der Route", async () => {
    const fetchMock = vi.fn(async () =>
      antwort({ code: "Ok", routes: [{ duration: 1500, distance: 12340 }] }),
    );

    expect(await client(fetchMock).strecke(PRAIANO, POSITANO)).toEqual({
      dauerMinuten: 25,
      distanzKm: 12.34,
      abschnitte: [],
    });
  });

  it("liefert null, wenn der Dienst nicht erreichbar ist", async () => {
    // Dann traegt der Reiseleiter die Angaben selbst ein (req-052).
    const fetchMock = vi.fn(async () => {
      throw new Error("network down");
    });

    expect(await client(fetchMock).strecke(PRAIANO, POSITANO)).toBeNull();
  });

  it("liefert null, wenn OSRM keine Route kennt", async () => {
    const fetchMock = vi.fn(async () =>
      antwort({ code: "NoRoute", routes: [] }),
    );

    expect(await client(fetchMock).strecke(PRAIANO, POSITANO)).toBeNull();
  });

  it("liefert null, wenn die Antwort keine Laenge nennt", async () => {
    const fetchMock = vi.fn(async () =>
      antwort({ code: "Ok", routes: [{ duration: 1500 }] }),
    );

    expect(await client(fetchMock).strecke(PRAIANO, POSITANO)).toBeNull();
  });
});

describe("createOsrmClient -- Abschnitte (req-059)", () => {
  /** Eine Route mit zwei benannten Abschnitten, wie OSRM sie liefert. */
  function mitAbschnitten() {
    return vi.fn(async () =>
      antwort({
        code: "Ok",
        routes: [
          {
            duration: 1500,
            distance: 12340,
            legs: [
              {
                steps: [
                  { name: "Via Lorenzo d'Amalfi", distance: 300 },
                  { name: "", ref: "SS163", distance: 8000 },
                  // Der letzte Schritt einer Route ist die Ankunft ohne Laenge.
                  { name: "", distance: 0 },
                ],
              },
            ],
          },
        ],
      }),
    );
  }

  it("liefert die Abschnitte der Route mit Strasse und Laenge", async () => {
    expect(
      (await client(mitAbschnitten()).strecke(PRAIANO, POSITANO))?.abschnitte,
    ).toEqual([
      { strasse: "Via Lorenzo d'Amalfi", distanzKm: 0.3 },
      { strasse: "SS163", distanzKm: 8 },
    ]);
  });

  it("fragt die Abschnitte beim Dienst mit an", async () => {
    const fetchMock = mitAbschnitten();

    await client(fetchMock).strecke(PRAIANO, POSITANO);

    expect(angefragteUrl(fetchMock)).toContain("steps=true");
  });

  it("holt fuer die blosse Fahrzeit keine Abschnitte", async () => {
    // Der Live-Status fragt sie oft ab (req-051) -- ohne Wegbeschreibung.
    const fetchMock = mitAbschnitten();

    await client(fetchMock).fahrzeitMinuten(PRAIANO, POSITANO);

    expect(angefragteUrl(fetchMock)).not.toContain("steps=true");
  });

  it("liefert ohne Abschnitte in der Antwort eine leere Liste", async () => {
    const fetchMock = vi.fn(async () =>
      antwort({ code: "Ok", routes: [{ duration: 60, distance: 1000 }] }),
    );

    expect(
      (await client(fetchMock).strecke(PRAIANO, POSITANO))?.abschnitte,
    ).toEqual([]);
  });
});

describe("createOsrmClient -- Profile (req-059)", () => {
  it("rechnet ohne Angabe mit dem Auto", async () => {
    const fetchMock = vi.fn(async () =>
      antwort({ code: "Ok", routes: [{ duration: 60, distance: 1000 }] }),
    );

    await client(fetchMock).strecke(PRAIANO, POSITANO);

    expect(angefragteUrl(fetchMock)).toContain("/route/v1/driving/");
  });

  it("fragt fuer das Rad das Rad-Profil an", async () => {
    const fetchMock = vi.fn(async () =>
      antwort({ code: "Ok", routes: [{ duration: 60, distance: 1000 }] }),
    );

    await client(fetchMock).strecke(PRAIANO, POSITANO, "rad");

    expect(angefragteUrl(fetchMock)).toContain("/route/v1/bike/");
  });

  it("fragt fuer zu Fuß das Fuss-Profil an", async () => {
    const fetchMock = vi.fn(async () =>
      antwort({ code: "Ok", routes: [{ duration: 60, distance: 1000 }] }),
    );

    await client(fetchMock).strecke(PRAIANO, POSITANO, "fuss");

    expect(angefragteUrl(fetchMock)).toContain("/route/v1/foot/");
  });

  it("nimmt zu jedem Profil dessen eigene oeffentliche Adresse", async () => {
    // Eine OSRM-Instanz rechnet immer nur ihr eigenes Profil.
    vi.stubEnv("OSRM_BASE_URL", "");
    const fetchMock = vi.fn(async () =>
      antwort({ code: "Ok", routes: [{ duration: 60, distance: 1000 }] }),
    );

    await createOsrmClient({
      fetch: fetchMock as unknown as typeof fetch,
    }).strecke(PRAIANO, POSITANO, "fuss");

    expect(angefragteUrl(fetchMock)).toContain("routed-foot");
    vi.unstubAllEnvs();
  });
});

describe("environmentOsrmBaseUrl (req-051)", () => {
  it("nimmt die Adresse aus der Umgebung, wenn sie gesetzt ist", () => {
    vi.stubEnv("OSRM_BASE_URL", "http://beelink:5000");

    expect(environmentOsrmBaseUrl()).toBe("http://beelink:5000");
    expect(environmentOsrmBaseUrl("rad")).toBe("http://beelink:5000");

    vi.unstubAllEnvs();
  });

  it("faellt sonst auf den oeffentlichen Dienst des Profils zurueck", () => {
    vi.stubEnv("OSRM_BASE_URL", "");

    expect(environmentOsrmBaseUrl()).toBe(
      "https://routing.openstreetmap.de/routed-car",
    );
    expect(environmentOsrmBaseUrl("rad")).toBe(
      "https://routing.openstreetmap.de/routed-bike",
    );
    expect(environmentOsrmBaseUrl("fuss")).toBe(
      "https://routing.openstreetmap.de/routed-foot",
    );

    vi.unstubAllEnvs();
  });
});

describe("createOsrmClient -- Rueckfall bei Ausfall (bug-067)", () => {
  /** Ohne Wartezeit zwischen den Versuchen, damit der Test nicht schlaeft. */
  function geduldig(fetchMock: unknown, zeitgrenzeMs = 5_000) {
    return createOsrmClient({
      baseUrl: "https://osrm.example",
      fetch: fetchMock as unknown as typeof fetch,
      wartezeitenMs: [0, 0],
      zeitgrenzeMs,
    });
  }

  /** Ein abgewiesener Verbindungsversuch, wie ihn Node meldet. */
  function verbindungAbgewiesen() {
    return new TypeError("fetch failed", {
      cause: Object.assign(new Error("connect ECONNREFUSED"), {
        code: "ECONNREFUSED",
      }),
    });
  }

  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "info").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("wiederholt einen abgewiesenen Verbindungsversuch", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(verbindungAbgewiesen())
      .mockResolvedValueOnce(
        antwort({ code: "Ok", routes: [{ duration: 1500 }] }),
      );

    expect(
      await geduldig(fetchMock).fahrzeitMinuten(PRAIANO, POSITANO),
    ).toBeCloseTo(25);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("wiederholt bei einer Stoerung des Dienstes (HTTP 5xx)", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(antwort({}, 502))
      .mockResolvedValueOnce(
        antwort({ code: "Ok", routes: [{ duration: 60, distance: 1000 }] }),
      );

    expect(await geduldig(fetchMock).strecke(PRAIANO, POSITANO)).not.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("gibt nach drei Versuchen auf", async () => {
    const fetchMock = vi.fn(async () => {
      throw verbindungAbgewiesen();
    });

    expect(
      await geduldig(fetchMock).fahrzeitMinuten(PRAIANO, POSITANO),
    ).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("wartet zwischen den Versuchen immer laenger", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(async () => {
      throw verbindungAbgewiesen();
    });

    const ergebnis = createOsrmClient({
      baseUrl: "https://osrm.example",
      fetch: fetchMock as unknown as typeof fetch,
    }).fahrzeitMinuten(PRAIANO, POSITANO);

    await vi.advanceTimersByTimeAsync(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(OSRM_WARTEZEITEN_MS[0]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(OSRM_WARTEZEITEN_MS[0]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(OSRM_WARTEZEITEN_MS[1]);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(await ergebnis).toBeNull();
    expect(OSRM_WARTEZEITEN_MS[1]).toBeGreaterThan(OSRM_WARTEZEITEN_MS[0]);

    vi.useRealTimers();
  });

  it("wiederholt nicht, wenn der Dienst keine Route kennt", async () => {
    // Eine fachliche Antwort wird durch Wiederholen nicht besser.
    const fetchMock = vi.fn(async () =>
      antwort({ code: "NoRoute", routes: [] }, 400),
    );

    expect(
      await geduldig(fetchMock).fahrzeitMinuten(PRAIANO, POSITANO),
    ).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("bricht einen Abruf ab, auf den der Dienst nicht antwortet", async () => {
    // Der Dienst nimmt die Verbindung an und schweigt dann.
    const fetchMock = vi.fn(
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((_, reject) => {
          init?.signal?.addEventListener("abort", () =>
            reject(init.signal?.reason),
          );
        }),
    );

    expect(
      await geduldig(fetchMock, 10).fahrzeitMinuten(PRAIANO, POSITANO),
    ).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("schreibt die Ursache jedes Fehlschlags ins Log", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(verbindungAbgewiesen())
      .mockResolvedValueOnce(antwort({}, 503))
      .mockRejectedValueOnce(
        new DOMException("The operation timed out.", "TimeoutError"),
      );

    await geduldig(fetchMock).fahrzeitMinuten(PRAIANO, POSITANO);

    const zeilen = vi.mocked(console.warn).mock.calls.map(([z]) => String(z));
    expect(zeilen).toEqual([
      expect.stringContaining("grund=ECONNREFUSED"),
      expect.stringContaining("grund=http-503"),
      expect.stringContaining("grund=zeitueberlauf"),
    ]);
    expect(zeilen[0]).toContain("routing:");
    expect(zeilen[0]).toContain("versuch=1/3");
    expect(zeilen[2]).toContain("versuch=3/3");
  });

  it("schreibt keine Koordinaten ins Log", async () => {
    // Die Position der Gruppe gehoert nicht ins Server-Log.
    const fetchMock = vi.fn(async () => {
      throw verbindungAbgewiesen();
    });

    await geduldig(fetchMock).fahrzeitMinuten(PRAIANO, POSITANO);

    for (const aufruf of vi.mocked(console.warn).mock.calls) {
      expect(JSON.stringify(aufruf)).not.toContain("14.6896");
    }
  });
});
