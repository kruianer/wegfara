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

describe("environmentOsrmBaseUrl (req-051)", () => {
  it("nimmt die Adresse aus der Umgebung, wenn sie gesetzt ist", () => {
    vi.stubEnv("OSRM_BASE_URL", "http://beelink:5000");

    expect(environmentOsrmBaseUrl()).toBe("http://beelink:5000");

    vi.unstubAllEnvs();
  });

  it("faellt sonst auf den oeffentlichen OSRM-Server zurueck", () => {
    vi.stubEnv("OSRM_BASE_URL", "");

    expect(environmentOsrmBaseUrl()).toBe("https://router.project-osrm.org");

    vi.unstubAllEnvs();
  });
});
