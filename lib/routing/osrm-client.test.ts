// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { createOsrmClient, environmentOsrmBaseUrl } from "./osrm-client";

const PRAIANO = { lat: 40.6114, lng: 14.6896 };
const POSITANO = { lat: 40.6281, lng: 14.4842 };

function antwort(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function client(fetchMock: unknown, baseUrl = "https://osrm.example") {
  return createOsrmClient({
    baseUrl,
    fetch: fetchMock as unknown as typeof fetch,
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

describe("createOsrmClient -- Profile (req-059)", () => {
  function angefragteUrl(fetchMock: ReturnType<typeof vi.fn>): string {
    return String(fetchMock.mock.calls[0][0]);
  }

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
