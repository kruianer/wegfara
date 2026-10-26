---
id: req-090
title: Chat-Modelle vom Dienst statt aus einer Liste im Quelltext
app: wegfara
area: Planung
priority: normal
created: 2026-10-26
---

# Goal (Why)

Die Modellauswahl im Chat zeigt drei Modelle aus einer Liste im
Quelltext (`lib/chat/modelle.ts`). Als Reiseleiter will ich dort die
Modelle sehen, die Anthropic **wirklich** anbietet — ohne dass jemand
die Liste nachträgt.

Dass eine solche Liste veraltet, ist keine Vermutung. Sie ist es schon:

| In der Auswahl | Beim Dienst verfügbar (laut SDK) |
|---|---|
| `claude-opus-5` | `claude-opus-5`, **`claude-opus-5-5`** |
| `claude-sonnet-5` | `claude-sonnet-5`, **`claude-sonnet-5-5`** |
| `claude-haiku-4-5` | `claude-haiku-4-5`, **`claude-haiku-5-5`** |

Drei neuere Modelle stehen nicht zur Wahl, und niemand merkt es. Der
Kommentar in `modelle.ts` begründet die Liste ausdrücklich damit, dass
„eine zweite Liste daneben unbemerkt veraltet" — richtig erkannt, aber
die Liste selbst ist genau diese zweite Liste. Die erste führt Anthropic.

Dazu kommt das Ende eines Modells: Wird eines abgekündigt und
abgeschaltet, scheitert jede Anfrage damit. Heute fällt das erst auf,
wenn die Antwort ausbleibt.

# Function (What)

Die Modellauswahl im Chat wird **beim Dienst erfragt**, nicht im
Quelltext geführt. Anthropic bietet dafür eine Schnittstelle, die das
SDK schon mitbringt (`client.models.list()`).

## Was der Dienst liefert

Je Modell unter anderem:

- `id` — die Kennung für die Anfrage
- `display_name` — der Name für Menschen, also die Beschriftung
- `lifecycle` — `active`, `deprecated` oder `retired`
- `line` — die Reihe (`opus`, `sonnet`, `haiku`), ohne sie aus der
  Kennung zu raten
- `max_input_tokens`, `max_tokens` — die Grenzen des Modells

## Welche Modelle zur Wahl stehen

**Nur `active`.** Ein `retired` Modell lässt sich nicht mehr aufrufen —
es anzubieten wäre eine Falle. Ein `deprecated` Modell antwortet zwar
noch, ist aber auf dem Weg zur Abschaltung; es gehört nicht in eine
Auswahl, in der man sich gerade für etwas entscheidet.

Die Reihenfolge ist die des Dienstes: Er nennt die neueren zuerst.

Die Beschriftung ist `display_name` — nicht die Kennung. „Claude Sonnet
5.5" liest sich, `claude-sonnet-5-5` nicht.

Der Satz „stark, teuer" / „ausgewogen" / „schnell, günstig" aus der
heutigen Liste entfällt. Er ist ein Urteil, das der Dienst nicht
liefert, und wäre bei einem neuen Modell wieder geraten. Was stattdessen
dastehen kann, sind die Zahlen des Dienstes — etwa die Größe des
Kontextfensters.

## Wenn die Abfrage nicht gelingt

Der Dienst kann schweigen, und der Zugangsschlüssel kann fehlen. Dann
steht in der Auswahl **das, womit die Unterhaltung schon läuft**, und
sonst nichts — mit dem Hinweis, dass die Liste gerade nicht zu holen
war. Eine leere Auswahl, die den Chat unbenutzbar macht, darf es nicht
geben.

Die Antwort des Dienstes wird **zwischengespeichert**: Der Katalog
ändert sich selten, und die Auswahl darf nicht bei jedem Öffnen des
Chats eine Anfrage auslösen. Fällt der Dienst aus, trägt der
Zwischenspeicher die Auswahl weiter — wie bug-067 es für die Fahrzeit
verlangt.

## Die Kennung im Verlauf

Unverändert: Welche Antwort von welchem Modell kam, bleibt am Eintrag
ablesbar (req-081). Eine Kennung, die der Dienst nicht mehr nennt,
**bleibt stehen wie sie ist** — eine Antwort aus einem abgelösten Modell
soll ihre Herkunft nicht verlieren. `chatModellLabel` tut das heute
schon richtig.

## Das vorgewählte Modell

Heute steht `claude-sonnet-5` fest im Quelltext. Künftig ist es das
neueste `active` Modell der Reihe **Sonnet** (`line: "sonnet"`) — die
ausgewogene Mitte, ohne eine Kennung festzuschreiben. Gibt es keines,
gilt das erste `active` Modell der Liste.

# GUI

- Die Auswahl bleibt, wo sie ist, und bleibt ein `select`
  (`app/plan/components/chat-fenster.tsx`). Es kommt kein neues
  Bedienelement hinzu.
- Beschriftung je Eintrag: `display_name` des Dienstes.
- Solange die Liste geholt wird, ist die Auswahl bedienbar und zeigt das
  laufende Modell — kein Flackern, kein leerer Zustand.
- Konnte die Liste nicht geholt werden, steht der Hinweis darüber oder
  daneben, sichtbar und in Worten (keine stille Verkürzung auf einen
  Eintrag).
- Tippziel mindestens 44×44 px (`stack.md`, Regel 4).

# Acceptance Criteria

- [ ] Gegeben der Dienst nennt fünf `active` Modelle, wenn ich die
      Auswahl öffne, dann stehen genau diese fünf darin.
- [ ] Gegeben der Dienst nennt ein Modell mit `lifecycle: "retired"`,
      wenn ich die Auswahl öffne, dann steht es NICHT darin.
- [ ] Gegeben der Dienst nennt ein Modell mit `lifecycle: "deprecated"`,
      wenn ich die Auswahl öffne, dann steht es NICHT darin.
- [ ] Gegeben ein Modell heißt beim Dienst „Claude Sonnet 5.5", wenn ich
      die Auswahl öffne, dann steht dort dieser Name und nicht
      `claude-sonnet-5-5`.
- [ ] Gegeben der Dienst nennt die neueren Modelle zuerst, wenn ich die
      Auswahl öffne, dann stehen sie in dieser Reihenfolge.
- [ ] Gegeben eine neue Unterhaltung, wenn ich sie beginne, dann ist das
      neueste `active` Modell der Reihe Sonnet vorgewählt.
- [ ] Gegeben der Dienst nennt kein Modell der Reihe Sonnet, wenn ich
      eine Unterhaltung beginne, dann ist das erste `active` Modell
      vorgewählt.
- [ ] Gegeben der Dienst antwortet nicht, wenn ich den Chat öffne, dann
      steht in der Auswahl das laufende Modell UND ein Hinweis, dass die
      Liste gerade nicht zu holen war.
- [ ] Gegeben es ist kein Zugangsschlüssel der Art `anthropic`
      hinterlegt, wenn ich den Chat öffne, dann sehe ich denselben
      Hinweis wie bisher auf den fehlenden Schlüssel — und keine leere
      Auswahl.
- [ ] Gegeben die Liste wurde geholt, wenn ich den Chat erneut öffne,
      dann wird sie nicht erneut beim Dienst erfragt.
- [ ] Gegeben eine Antwort kam von einem Modell, das der Dienst nicht
      mehr nennt, wenn ich den Verlauf ansehe, dann steht die Kennung
      dieses Modells weiterhin am Eintrag.
- [ ] Gegeben ich wähle ein Modell und schicke eine Frage, wenn die
      Antwort kommt, dann wurde sie mit genau diesem Modell erzeugt.

# Constraints

- Die Abfrage läuft **auf dem Server**, nie im Browser. Der
  Zugangsschlüssel gehört dem Account (req-028), liegt verschlüsselt in
  der Datenbank und verlässt den Server nicht — wie beim Chat selbst
  (`app/api/chat/route.ts`).
- Benutzt wird `client.models.list()` aus dem schon vorhandenen SDK. Es
  kommt keine eigene HTTP-Anfrage und keine weitere Abhängigkeit dazu.
- Welche Modelle zur Wahl stehen, entscheidet **eine** Stelle. Die
  heutige Liste in `lib/chat/modelle.ts` wird ersetzt, nicht ergänzt —
  sonst steht wieder eine zweite Liste daneben.
- Die Reihe (`line`) kommt aus dem Feld des Dienstes. Sie wird **nicht**
  aus der Kennung geraten; das SDK sagt ausdrücklich, dass man das nicht
  darf.
- `istChatModell` prüft heute gegen die feste Liste. Künftig darf eine
  Kennung nicht abgelehnt werden, nur weil die Liste gerade nicht
  geholt werden konnte — sonst lässt der Ausfall des Katalogs den Chat
  scheitern.
- Der Zwischenspeicher hat ein Höchstalter und liegt im Server, nicht im
  Browser.

# Out of Scope

- Modelle anderer Anbieter in der Auswahl. Der Chat redet mit Anthropic
  (req-081); der OpenAI-Schlüssel `ki_suche` taugt dafür nicht.
- Preise anzeigen. Der Katalog nennt keine, und sie zu pflegen wäre
  wieder eine Liste im Quelltext.
- Die Fähigkeiten (`capabilities`) auswerten, um Modelle auszusortieren.
  Solange der Chat keine Werkzeuge ruft, braucht er davon nichts.
- Je Account oder Reise festlegen, welche Modelle erlaubt sind.
- Werkzeuge und Steuerung der App durch den Chat — das bleibt der
  nächste Schritt aus req-081.
- Am Wechsel mitten in der Unterhaltung wird nichts geändert: Er geht
  heute schon, und der Wechsel gilt ab der nächsten Frage
  (`chat-fenster.tsx`).
