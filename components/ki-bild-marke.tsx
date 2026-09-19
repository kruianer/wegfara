import {
  KI_BILD_SYMBOL_TEXT,
  KI_BILD_SYMBOL_TITEL,
  KI_BILD_SYMBOL_ZEICHEN,
} from "@/lib/pois/ki-bild";
import styles from "./ki-bild-marke.module.css";

/**
 * Das Zeichen eines KI-Bildes (req-072): unten rechts im Bild, überall
 * dasselbe — im POI-Formular, in der Großansicht, in der POI-Liste und im
 * Flyout der Karte.
 *
 * Es besteht aus Text und braucht kein SVG. Das ist Absicht: im Flyout der
 * Karte hängt das Bild in einer Schaltfläche, in der nur `<span>` und
 * `<img>` stehen dürfen (siehe poi-map.tsx) — ein Zeichen aus Text lässt
 * sich dort genauso bauen wie hier und sieht an beiden Stellen gleich aus.
 *
 * Die Fläche, in der es steht, muss `position: relative` tragen; sonst
 * setzte es sich an die nächste gesetzte Fläche darüber.
 */
export function KiBildMarke() {
  return (
    <span className={styles.marke} role="img" aria-label={KI_BILD_SYMBOL_TITEL}>
      <span className={styles.zeichen} aria-hidden="true">
        {KI_BILD_SYMBOL_ZEICHEN}
      </span>
      {KI_BILD_SYMBOL_TEXT}
    </span>
  );
}

/**
 * Dasselbe Zeichen als DOM-Element — für das Flyout der Karte (req-070),
 * das imperativ entsteht und deshalb nicht gerendert werden kann.
 */
export function kiBildMarkeElement(): HTMLSpanElement {
  const marke = document.createElement("span");
  marke.className = styles.marke;
  marke.setAttribute("role", "img");
  marke.setAttribute("aria-label", KI_BILD_SYMBOL_TITEL);

  const zeichen = document.createElement("span");
  zeichen.className = styles.zeichen;
  zeichen.setAttribute("aria-hidden", "true");
  zeichen.textContent = KI_BILD_SYMBOL_ZEICHEN;

  marke.appendChild(zeichen);
  marke.appendChild(document.createTextNode(KI_BILD_SYMBOL_TEXT));
  return marke;
}
