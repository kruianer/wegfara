import { describe, expect, it } from "vitest";
import { enthaeltWebadresse, parseGoogleMapsLink } from "./google-link";

describe("parseGoogleMapsLink (req-026)", () => {
  it("liest die Ortskennung aus query_place_id", () => {
    const target = parseGoogleMapsLink(
      "https://www.google.com/maps/search/?api=1&query=Villa%20Rufolo&query_place_id=ChIJVillaRufolo",
    );

    expect(target).toEqual({ kind: "placeId", placeId: "ChIJVillaRufolo" });
  });

  it("liest die Ortskennung aus q=place_id:...", () => {
    const target = parseGoogleMapsLink(
      "https://www.google.com/maps/?q=place_id:ChIJVillaRufolo",
    );

    expect(target).toEqual({ kind: "placeId", placeId: "ChIJVillaRufolo" });
  });

  it("liest die Ortskennung aus dem data-Teil eines langen Browser-Links", () => {
    const target = parseGoogleMapsLink(
      "https://www.google.de/maps/place/Villa+Rufolo/@40.6491,14.6113,17z/data=!4m6!1sChIJ_ABCdef-123!8m2!3d40.6491!4d14.6113",
    );

    expect(target).toEqual({ kind: "placeId", placeId: "ChIJ_ABCdef-123" });
  });

  /**
   * Hinter den Kurzlinks der App steht meist die Feature-Kennung des Ortes
   * in Hex-Form statt seiner Place-ID (bug-026). Sie taugt nicht fuer die
   * Places API — nachgeschlagen wird dann bewusst der Name.
   */
  it("schlaegt bei einer Feature-Kennung in Hex-Form den Namen nach", () => {
    const target = parseGoogleMapsLink(
      "https://www.google.com/maps/place/inatura+-+Erlebnis+Naturschau+Dornbirn/@47.409286,9.7370139,17z/data=!4m6!3m5!1s0x479b6b4a8e60626b:0x53b81cddba9fa03a!8m2!3d47.409286!4d9.7370139",
    );

    expect(target).toEqual({
      kind: "query",
      query: "inatura - Erlebnis Naturschau Dornbirn",
      position: { lat: 47.409286, lng: 9.7370139 },
    });
  });

  it("nimmt die Hex-Kennung auch dann nicht, wenn sie kodiert ist", () => {
    const target = parseGoogleMapsLink(
      "https://www.google.com/maps/place/Villa+Rufolo/@40.6491,14.6113,17z/data=!3m5!1s0x479b6b4a8e60626b%3A0x53b81cddba9fa03a!8m2",
    );

    expect(target).toMatchObject({ kind: "query", query: "Villa Rufolo" });
  });

  it("findet die Place-ID auch neben einer Feature-Kennung", () => {
    const target = parseGoogleMapsLink(
      "https://www.google.com/maps/place/Villa+Rufolo/@40.6,14.6,17z/data=!3m5!1s0x1234abcd:0x5678ef90!8m2!16s%2Fg%2F1!1sChIJVillaRufolo",
    );

    expect(target).toEqual({ kind: "placeId", placeId: "ChIJVillaRufolo" });
  });

  it("liest ohne Kennung den Ortsnamen und die Kartenmitte aus dem Pfad", () => {
    const target = parseGoogleMapsLink(
      "https://www.google.de/maps/place/Villa+Rufolo/@40.6491,14.6113,17z",
    );

    expect(target).toEqual({
      kind: "query",
      query: "Villa Rufolo",
      position: { lat: 40.6491, lng: 14.6113 },
    });
  });

  it("erkennt einen Kurzlink aus der App", () => {
    const target = parseGoogleMapsLink("https://maps.app.goo.gl/aBcD1234");

    expect(target).toEqual({
      kind: "shortLink",
      url: "https://maps.app.goo.gl/aBcD1234",
    });
  });

  it("findet den Link auch, wenn Text davor steht", () => {
    const target = parseGoogleMapsLink(
      "Schau mal: Villa Rufolo\nhttps://maps.app.goo.gl/aBcD1234",
    );

    expect(target).toEqual({
      kind: "shortLink",
      url: "https://maps.app.goo.gl/aBcD1234",
    });
  });

  it("liefert null fuer Text ohne Link", () => {
    expect(parseGoogleMapsLink("Villa Rufolo, Ravello")).toBeNull();
  });

  it("liefert null fuer einen Link, der nicht zu Google Maps gehoert", () => {
    expect(parseGoogleMapsLink("https://example.com/villa-rufolo")).toBeNull();
  });

  it("liefert null fuer eine Google-Seite ausserhalb von Maps", () => {
    expect(
      parseGoogleMapsLink("https://www.google.com/search?q=Villa+Rufolo"),
    ).toBeNull();
  });

  it("nimmt eine Koordinate im Pfad nicht fuer einen Ortsnamen", () => {
    const target = parseGoogleMapsLink(
      "https://www.google.com/maps/place/40.6491,14.6113",
    );

    expect(target).toEqual({ kind: "query", query: "", position: undefined });
  });
});

describe("enthaeltWebadresse (req-048)", () => {
  it("erkennt eine eingefügte Webadresse", () => {
    expect(enthaeltWebadresse("https://example.com/villa")).toBe(true);
    expect(enthaeltWebadresse("Schau mal: http://maps.example.com/x")).toBe(
      true,
    );
  });

  it("hält einen Suchbegriff für keine Webadresse", () => {
    expect(enthaeltWebadresse("Villa Rufolo Ravello")).toBe(false);
    expect(enthaeltWebadresse("")).toBe(false);
  });
});
