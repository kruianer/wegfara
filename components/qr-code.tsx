import type { QrCode as QrCodeData } from "@/lib/qr/qr-code";
import styles from "./qr-code.module.css";

/**
 * Zeigt einen QR-Code als SVG (req-023). Farben und Ruhezone sind bewusst
 * fest: ein QR-Code wird von einer fremden Kamera gelesen und braucht
 * dafuer schwarze Module auf weissem Grund -- ein Code, der sich dem
 * Farbschema anpasst, laesst sich im dunklen Modus nicht mehr abscannen.
 */
export function QrCode({ code, label }: { code: QrCodeData; label: string }) {
  return (
    <svg
      className={styles.qr}
      viewBox={`0 0 ${code.size} ${code.size}`}
      role="img"
      aria-label={label}
      shapeRendering="crispEdges"
    >
      <rect width={code.size} height={code.size} fill="#ffffff" />
      <path d={code.path} fill="#000000" />
    </svg>
  );
}
