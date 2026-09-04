/**
 * Ueberlappende Programmpunkte teilen sich die Breite des Zeitstrahls
 * (req-039, Funktion) -- so wie req-004 zeitgleiche nebeneinander stellt.
 * Wer wie breit und an welcher Stelle liegt, steht hier und nicht in der
 * Oberflaeche.
 */

export interface Lane {
  /** Die wievielte Spur, von links ab 0. */
  lane: number;
  /** Wie viele Spuren sich an dieser Stelle die Breite teilen, mindestens 1. */
  lanes: number;
}

interface Block {
  /** ISO-Datum+Zeit ohne Zeitzone -- als Text vergleichbar (YYYY-MM-DDTHH:mm). */
  startAt: string;
  endAt: string;
}

/**
 * Verteilt Bloecke auf Spuren: was sich zeitlich ueberschneidet, kommt
 * nebeneinander, was sich nicht beruehrt, bleibt in derselben Spur und damit
 * ueber die volle Breite.
 *
 * Die Spurzahl gilt je Traube sich beruehrender Bloecke, nicht fuer den
 * ganzen Tag -- ein Paar am Vormittag macht den Abend nicht schmal. Ein Ende
 * genau auf dem Beginn des naechsten ist keine Ueberschneidung.
 *
 * Die Rueckgabe steht in der Reihenfolge der uebergebenen Bloecke.
 */
export function assignLanes(blocks: Block[]): Lane[] {
  const order = blocks
    .map((block, index) => ({ block, index }))
    .sort(
      (a, b) =>
        a.block.startAt.localeCompare(b.block.startAt) ||
        a.block.endAt.localeCompare(b.block.endAt) ||
        a.index - b.index,
    );

  const result: Lane[] = blocks.map(() => ({ lane: 0, lanes: 1 }));
  // Die aktuelle Traube: die Bloecke, die sich (ueber Nachbarn) beruehren,
  // und je Spur das spaeteste Ende darin.
  let cluster: number[] = [];
  let laneEnds: string[] = [];

  function closeCluster() {
    for (const index of cluster) result[index].lanes = laneEnds.length;
    cluster = [];
    laneEnds = [];
  }

  for (const { block, index } of order) {
    // Beruehrt der Block keine der offenen Spuren mehr, beginnt eine neue
    // Traube -- die vorige bekommt ihre endgueltige Spurzahl.
    if (laneEnds.every((end) => end <= block.startAt)) closeCluster();

    let lane = laneEnds.findIndex((end) => end <= block.startAt);
    if (lane === -1) lane = laneEnds.length;
    laneEnds[lane] =
      laneEnds[lane] && laneEnds[lane] > block.endAt
        ? laneEnds[lane]
        : block.endAt;

    result[index].lane = lane;
    cluster.push(index);
  }
  closeCluster();

  return result;
}
