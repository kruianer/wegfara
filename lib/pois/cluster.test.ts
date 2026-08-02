import { describe, expect, it } from "vitest";
import { clusterPois } from "./cluster";
import type { Poi } from "./types";

function poi(overrides: Partial<Poi> & { id: string }): Poi {
  return {
    tripId: "trip-1",
    name: "POI",
    ort: "Ort",
    type: "sehenswuerdigkeit",
    position: { lat: 40.85, lng: 14.27 },
    status: "weiss_nicht",
    ...overrides,
  };
}

describe("clusterPois", () => {
  it("bildet keine Cluster-Zone fuer einen einzelnen POI", () => {
    const clusters = clusterPois([poi({ id: "a" })], 60);

    expect(clusters).toHaveLength(0);
  });

  it("bildet keine Cluster-Zone fuer zwei POIs weit ausserhalb des Radius", () => {
    const clusters = clusterPois(
      [
        poi({ id: "a", position: { lat: 40.85, lng: 14.27 } }),
        poi({ id: "b", position: { lat: 48.21, lng: 16.37 } }),
      ],
      60,
    );

    expect(clusters).toHaveLength(0);
  });

  it("gruppiert zwei nah beieinander liegende POIs zu einer Cluster-Zone", () => {
    const a = poi({ id: "a", position: { lat: 40.8518, lng: 14.2681 } }); // Neapel
    const b = poi({ id: "b", position: { lat: 40.8467, lng: 14.2497 } }); // Neapel, ~2km entfernt

    const clusters = clusterPois([a, b], 60);

    expect(clusters).toHaveLength(1);
    expect(clusters[0].members.map((m) => m.id).sort()).toEqual(["a", "b"]);
  });

  it("hat mindestens 12 km Radius, auch wenn die Mitglieder sehr nah beieinander liegen", () => {
    const a = poi({ id: "a", position: { lat: 40.8518, lng: 14.2681 } });
    const b = poi({ id: "b", position: { lat: 40.8519, lng: 14.2682 } });

    const clusters = clusterPois([a, b], 60);

    expect(clusters[0].radiusKm).toBe(12);
  });

  it("verkleinert die Cluster-Zone, wenn ein kleinerer Radius weniger POIs zusammenfasst", () => {
    // a und b liegen ~2km auseinander (Neapel), c liegt ~230km entfernt (Rom).
    // Bei einem grosszuegigen Radius schliesst sich c der Gruppe an, bei
    // einem kleinen Radius bleibt c aussen vor.
    const a = poi({ id: "a", position: { lat: 40.8518, lng: 14.2681 } });
    const b = poi({ id: "b", position: { lat: 40.8467, lng: 14.2497 } });
    const c = poi({ id: "c", position: { lat: 41.9028, lng: 12.4964 } });

    const large = clusterPois([a, b, c], 250);
    const small = clusterPois([a, b, c], 10);

    expect(large).toHaveLength(1);
    expect(large[0].members).toHaveLength(3);
    expect(small).toHaveLength(1);
    expect(small[0].members.map((m) => m.id).sort()).toEqual(["a", "b"]);
    expect(small[0].radiusKm).toBeLessThan(large[0].radiusKm);
  });

  it("laesst POIs mit weniger als zwei Mitgliedern unclustert", () => {
    const a = poi({ id: "a", position: { lat: 40.85, lng: 14.27 } });
    const b = poi({ id: "b", position: { lat: 40.85, lng: 14.27 } });
    const c = poi({ id: "c", position: { lat: 48.21, lng: 16.37 } });

    const clusters = clusterPois([a, b, c], 60);

    expect(clusters).toHaveLength(1);
    expect(clusters[0].members).toHaveLength(2);
  });
});
