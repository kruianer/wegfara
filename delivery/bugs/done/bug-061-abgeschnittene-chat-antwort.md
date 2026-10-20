---
id: bug-061
app: wegfara
req: req-081
priority: hoch
created: 2026-10-17
---

# Observed

Im Chatfenster kann eine Antwort **mitten im Satz enden** und wird
trotzdem als vollständige Antwort abgelegt. Nichts an ihr sagt, dass sie
abgeschnitten ist.

Gefunden und **gemessen** im Code-Review des Workers vom 13.10.2026
(Befund N1, Schweregrad hoch) — nicht vermutet, sondern mit
nachgebildetem Ereignisstrom nachgewiesen.

# Expected

Endet eine Antwort, weil die Token-Grenze erreicht ist, dann:

- **sagt die App das** — an der Antwort selbst erkennbar
- und legt keine halbe Antwort als vollständige ab

# Steps

Eine Frage stellen, die eine lange Antwort erzwingt — bei Opus 5 mit
hohem Denkaufwand genügt eine schwere Frage. Die Antwort endet im Satz,
der Verlauf zeigt sie wie jede andere.

# Ursache

`MAX_TOKENS = 8192` in
[anthropic-client.ts](../../../lib/ai/anthropic-client.ts) (Zeile 29) ist
eine harte Grenze für **Nachdenken und Antworttext gemeinsam** — nicht
8192 Token Antwort, sondern 8192 Token Nachdenken *plus* Antwort.

Die Denk-Token werden dabei nicht ausgeliefert (Anzeige-Vorgabe
„omitted"), es entstehen also keine `text_delta`, solange nachgedacht
wird. Was `stop_reason: "max_tokens"` auslöst, bleibt unbemerkt.

Gemessene Fälle:

| | Verlauf | Ergebnis |
|---|---|---|
| **A** | Denk-Block, dann `max_tokens`, kein Text | `text=''`, `fehler={ art: 'leer' }` |
| **B** | Denk-Block, halbe Antwort, dann `max_tokens` | `text='… und dann'`, **`fehler=null`** |
| **C** | Gegenprobe `end_turn` | `text='Gern.'`, `fehler=null` |

**Fall A** sagt dem Nutzer etwas Falsches: „Antwort ohne Inhalt" statt
„zu lang geworden".

**Fall B ist der schwerere.** `fehler=null` heißt für
[app/api/chat/route.ts](../../../app/api/chat/route.ts) (Zeilen 176–183):
Die abgeschnittene Antwort wird mit `createChatNachricht` normal abgelegt.
Sie steht danach als vollständige Antwort im Verlauf, überdauert das
Neuladen, und **geht im nächsten Zug als Zusammenhang wieder an das
Modell**. Die einzige Spur ist der abgebrochene Satz.

Das ist dasselbe Muster wie bug-021, bug-026, bug-027 und bug-032: ein
Fehlerzustand, den die App verschluckt.

Dass `thinking` und `effort` unberührt bleiben, war eine bewusste
Entscheidung in req-081 (jedes Modell hat andere erlaubte Werte, eine
eigene Einstellung wäre eine zweite Liste). Die Entscheidung bleibt
richtig — was fehlt, ist die Behandlung ihrer Folge.

# Erwartete Behebung

In dieser Reihenfolge:

1. **`stop_reason: "max_tokens"` behandeln** — als benannter Grund (etwa
   `"abgeschnitten"` in `AiFehlerArt`) mit einem Satz, der sagt, was war:
   die Antwort wurde zu lang. Dazu der Repro-Test für Fall B, der heute
   rot wäre. Das allein beendet die stille Ablage halber Antworten.
2. **Prüfen, ob 8192 reicht**, wenn Nachdenken mitzählt. Die
   Herstellerhinweise zum Wechsel auf Opus 5 führen genau diese
   Konstellation — eine Strecke, die `thinking` nie gesetzt hat — als
   blockierenden Punkt.

Ob eine abgeschnittene Antwort überhaupt abgelegt wird oder verworfen,
entscheidet die Umsetzung — als vollständige darf sie nicht durchgehen.

# Notes

Betrifft alle drei Modelle, Opus 5 am stärksten: Die Modellauswahl bietet
es als „stark, teuer" an, also für die schweren Fragen, bei denen am
längsten nachgedacht wird.

Der Code-Review nennt als dritten Punkt, dass ein Abbruch durch den
Nutzer die Antwort bezahlt und verliert (N3, mittel). Das ist ein eigener
Fall und nicht Teil dieses Bugs.

# Behoben (2026-10-19)

**`stop_reason: "max_tokens"` ist jetzt ein benannter Grund.**
`createAnthropicChatClient` in
[anthropic-client.ts](../../../lib/ai/anthropic-client.ts) prüft das
`message_delta`-Ereignis zusätzlich zu `"refusal"` auf
`stop_reason === "max_tokens"` und bricht den Strom mit
`{ art: "abgeschnitten", detail: … }` ab — genauso wie beim Fehlschlag
durch den Dienst selbst. Das greift für Fall A (kein Text) und Fall B
(halber Satz) gleich: in beiden Fällen kommt `fehler.art === "abgeschnitten"`
beim Aufrufer an, nie mehr `fehler=null`.

Der neue Grund steht in
[fehler.ts](../../../lib/ai/fehler.ts) als `AiFehlerArt` und mit eigenem
Satz in `AI_FEHLER_TEXT` — die Oberfläche
(`app/plan/components/chat-fenster.tsx`) liest ihn generisch über
`AI_FEHLER_TEXT[fehler]` und brauchte keine Änderung.

Dass eine solche Antwort nicht als vollständige abgelegt wird, war
bereits route-seitig vorhanden: `app/api/chat/route.ts` legt bei jedem
`{ art: "fehler" }`-Stück keine `ChatNachricht` an und schließt den Strom
— das greift jetzt auch für `"abgeschnitten"`, ohne dass die Route
angefasst werden musste.

**`MAX_TOKENS` ist von 8192 auf 16000 angehoben.** Laut Anthropics
aktueller Dokumentation (platform.claude.com, Stand 2026-10-19) haben
Opus 5, Sonnet 5 und Haiku 4.5 ein Limit von 128K Ausgabe-Token je
Anfrage — 8192 lag weit darunter und damit unnötig knapp. Nachdenken
zählt dort ausdrücklich gegen `max_tokens`:

> Thinking has a cost: the tokens Claude spends reasoning are billed as
> output tokens, even when the thinking text isn't returned to you, and
> they count toward `max_tokens` alongside the response text.

16000 ist der Wert, den Anthropics eigene Beispiele für adaptives
Nachdenken ohne Effort-Änderung durchgängig als „roomy" verwenden — reicht
großzügig für Nachdenken plus eine Chat-Antwort, ohne die Kostenobergrenze
unbegrenzt zu öffnen (vgl. den bestehenden Kommentar zur Obergrenze). Ganz
ausschließen lässt sich `max_tokens` bei hohem Denkaufwand (Opus 5, Sonnet
5: `high` als Vorgabe) nie — dafür sorgt jetzt Punkt 1, dass es benannt
wird statt zu verschwinden.

`thinking` und `effort` bleiben unberührt, wie in req-081 entschieden.

# Prüfung

Neue Tests, die ohne die Behebung fehlschlagen:

- `lib/ai/anthropic-client.test.ts` — zwei neue Fälle in der Beschreibung
  „Fehlschlaege der Anthropic-Anbindung": Fall A (Denk-Block, dann
  `max_tokens`, kein Text → `fehler.art === "abgeschnitten"`, nicht
  `"leer"`) und Fall B (halber Satz, dann `max_tokens` →
  `fehler.art === "abgeschnitten"`, nicht mehr `fehler=null`). Der
  bestehende Test „begrenzt die Laenge einer Antwort" prüft jetzt
  `max_tokens === 16000`.

Volle Suite (`npm test`, 4648 Tests), Lint (`npm run lint`) und
`tsc --noEmit` (`npm run types`) sind grün.
