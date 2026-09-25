/**
 * Die Nummer eines POI, wie sie im Planer geschrieben steht (req-013,
 * req-074): mit dem Gitter davor -- in der POI-Liste, in der Auswahlliste
 * "Noch unverplant" und am Programmpunkt des Zeitstrahls. Der Kartenmarker
 * traegt die blanke Zahl, weil dort kein Platz fuer ein Zeichen mehr ist; es
 * ist dieselbe Nummer. Eine zweite Zaehlung gibt es nicht -- die Zahl kommt
 * immer aus `poi.number`.
 */
export function formatPoiNummer(number: number): string {
  return `#${number}`;
}
