/**
 * Teilt den Langtext eines Programmpunkts fuer die aufgeklappte Kachel im
 * Begleiter (bug-069): Der Anfang steht dort, wo vorher der Kurztext stand,
 * darunter "Weniger anzeigen", danach der Rest. So steht der Knopf zum
 * Zuklappen ungefaehr an der Stelle, an der man gerade "Mehr lesen" getippt
 * hat, statt hinter Langtext und Fotos.
 *
 * Geschnitten wird nur an einem Satzende -- am ersten, das nicht vor der
 * Laenge des Kurztexts liegt. Gibt es keines mehr, bleibt der ganze Langtext
 * der Anfang und der Rest ist leer.
 */
export function teileLangtext(
  langText: string,
  kurzText: string,
): { anfang: string; rest: string } {
  const satzende = /[.!?…]["'“”»«)]*\s+/g;
  let treffer: RegExpExecArray | null;
  while ((treffer = satzende.exec(langText)) !== null) {
    const schnitt = treffer.index + treffer[0].length;
    if (schnitt < kurzText.trim().length) continue;
    const anfang = langText.slice(0, schnitt).trimEnd();
    const rest = langText.slice(schnitt).trim();
    if (rest === "") break;
    return { anfang, rest };
  }
  return { anfang: langText, rest: "" };
}
