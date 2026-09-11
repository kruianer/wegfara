import type { InputHTMLAttributes } from "react";
import styles from "./tippziel-checkbox.module.css";

type Props = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type" | "className"
> & {
  /**
   * Legt die Trefferflaeche ueber die Zeile, statt sie im Fluss Platz
   * beanspruchen zu lassen (bug-029): sichtbar und im Layout ist dann nur
   * das Kaestchen, die 44x44 px ragen unsichtbar darueber hinaus. Fuer
   * dichte Zeilen wie den Statusfilter der Karte, die sonst auf 44 px Hoehe
   * auseinandergezogen wuerden.
   *
   * Sie waechst dabei nach unten (bug-044): nach oben ragt sie nur wenige
   * Pixel ueber das Kaestchen, der Rest liegt darunter. Dadurch duerfen die
   * Zeilen dicht stehen, ohne dass die Flaeche einer Zeile das Kaestchen der
   * Zeile darueber abdeckt. Der Aufrufer muss dafuer zwei Dinge einhalten:
   * der Zeilenabstand ist groesser als der Ueberstand oben, und unter der
   * letzten Zeile ist Platz fuer den Ueberstand unten.
   */
  ueberlagernd?: boolean;
};

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
 * nutzen sie die POI-Liste und der Statusfilter der Karte.
 */
export function TippzielCheckbox({ ueberlagernd, ...props }: Props) {
  return (
    <span
      className={
        ueberlagernd ? `${styles.wrap} ${styles.wrapUeberlagernd}` : styles.wrap
      }
    >
      <input type="checkbox" className={styles.input} {...props} />
      {/* Nur Zierde -- angeklickt wird das Feld darunter, das die ganze
          Trefferflaeche einnimmt. */}
      <span className={styles.box} aria-hidden="true" />
    </span>
  );
}
