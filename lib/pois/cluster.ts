import type { Poi, PoiPosition } from "./types";
import { distanceKm } from "./distance";

export interface PoiCluster {
  position: PoiPosition;
  members: Poi[];
  radiusKm: number;
}

/**
 * Gruppiert POIs greedy nach Naehe (siehe delivery/design/planer README,
 * Abschnitt "1. POIs" und die Logikklasse in "Reiseplaner v4.dc.html",
 * Methode `drawPoi`): ein POI schliesst sich der ersten bestehenden
 * Gruppe an, deren Mittelpunkt naeher als radiusKm liegt, sonst eroeffnet
 * er eine neue Gruppe. Der Mittelpunkt einer Gruppe ist der Schwerpunkt
 * ihrer Mitglieder und wird bei jedem Beitritt neu berechnet. Nur Gruppen
 * mit mindestens zwei Mitgliedern werden als Cluster-Zone zurueckgegeben;
 * ihr Radius ist die groesste Mitgliedsdistanz zum Mittelpunkt plus 8 km,
 * mindestens aber 12 km.
 */
export function clusterPois(pois: Poi[], radiusKm: number): PoiCluster[] {
  const groups: { lat: number; lng: number; members: Poi[] }[] = [];

  for (const poi of pois) {
    const group = groups.find(
      (g) => distanceKm({ lat: g.lat, lng: g.lng }, poi.position) < radiusKm,
    );
    if (group) {
      group.members.push(poi);
      group.lat =
        group.members.reduce((sum, m) => sum + m.position.lat, 0) /
        group.members.length;
      group.lng =
        group.members.reduce((sum, m) => sum + m.position.lng, 0) /
        group.members.length;
    } else {
      groups.push({
        lat: poi.position.lat,
        lng: poi.position.lng,
        members: [poi],
      });
    }
  }

  return groups
    .filter((g) => g.members.length >= 2)
    .map((g) => {
      const center = { lat: g.lat, lng: g.lng };
      const maxDistanceKm = Math.max(
        ...g.members.map((m) => distanceKm(center, m.position)),
      );
      return {
        position: center,
        members: g.members,
        radiusKm: Math.max(maxDistanceKm + 8, 12),
      };
    });
}
