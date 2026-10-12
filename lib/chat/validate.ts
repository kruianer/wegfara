/**
 * Was eine geschriebene Nachricht des Chats erfuellen muss (req-081). Die
 * Regeln stehen in lib/ und sind ohne laufendes Next.js testbar; geprueft
 * wird mit ihnen in der Oberflaeche und noch einmal serverseitig.
 */

/**
 * Wie lang eine Nachricht hoechstens sein darf. Eine Obergrenze gehoert dazu:
 * was hier hineinkommt, geht als Zusammenhang mit jeder weiteren Frage erneut
 * an den Dienst und kostet dort jedes Mal.
 */
export const CHAT_MAX_ZEICHEN = 4000;

export const CHAT_ERRORS = {
  leer: "Bitte etwas schreiben.",
  zuLang: `Bitte auf ${CHAT_MAX_ZEICHEN} Zeichen kürzen.`,
};

/**
 * Der zu sendende Text -- null, wenn nichts zu senden ist. Leerraum am Rand
 * zaehlt nicht: eine Nachricht aus Leerzeichen ist keine.
 */
export function zuSendenderText(eingabe: string): string | null {
  const text = eingabe.trim();
  if (text.length === 0) return null;
  return text;
}

/** Der Grund, warum diese Eingabe nicht hinausgeht -- null, wenn sie darf. */
export function chatEingabeFehler(eingabe: string): string | null {
  const text = zuSendenderText(eingabe);
  if (text === null) return CHAT_ERRORS.leer;
  if (text.length > CHAT_MAX_ZEICHEN) return CHAT_ERRORS.zuLang;
  return null;
}
