import { stilCss } from "@/lib/design/stil";

/**
 * Schreibt die gemeinsamen Design-Tokens (lib/design/stil.ts, req-089) als
 * Stylesheet in die Seite. Es steht im Root-Layout und erreicht damit jede
 * Ansicht -- schon beim ersten Zeichnen, weil es mit dem HTML kommt und
 * nicht nachgeladen wird.
 */
export function StilBlatt() {
  return <style dangerouslySetInnerHTML={{ __html: stilCss() }} />;
}
