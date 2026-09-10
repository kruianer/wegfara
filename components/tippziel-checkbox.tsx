import type { InputHTMLAttributes } from "react";
import styles from "./tippziel-checkbox.module.css";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "className">;

/**
 * Eine Ankreuzbox in gewohnter Groesse, die sich trotzdem mit dem Finger
 * treffen laesst: die Trefferflaeche ist 44x44 px gross (siehe
 * delivery/stack.md, Bildschirmbreiten, Regel 4), gezeichnet wird darin nur
 * ein kleines Kaestchen.
 *
 * Warum nicht die Ankreuzbox des Browsers selbst auf 44x44 px setzen: sie
 * malt sich dann ueber die ganze Flaeche und sieht unnatuerlich gross aus
 * (bug-025). Ein unsichtbarer Rand hilft nicht -- das Kaestchen des Browsers
 * fuellt auch den. Deshalb traegt hier das unsichtbare Eingabefeld die
 * Trefferflaeche und das Kaestchen darueber das Aussehen.
 *
 * Liegt in components/, weil beide Bereiche sie brauchen koennen; im Planer
 * nutzen sie die POI-Liste und die Legende der Karte.
 */
export function TippzielCheckbox(props: Props) {
  return (
    <span className={styles.wrap}>
      <input type="checkbox" className={styles.input} {...props} />
      {/* Nur Zierde -- angeklickt wird das Feld darunter, das die ganze
          Trefferflaeche einnimmt. */}
      <span className={styles.box} aria-hidden="true" />
    </span>
  );
}
