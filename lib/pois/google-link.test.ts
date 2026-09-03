import { describe, expect, it } from "vitest";
import { parseGoogleMapsLink } from "./google-link";

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
