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
