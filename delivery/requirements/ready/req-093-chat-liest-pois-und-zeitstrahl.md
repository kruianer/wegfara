---
id: req-093
title: Der Chat darf POIs und Zeitstrahl lesen
app: wegfara
area: Planung
priority: normal
created: 2026-10-27
---

# Goal (Why)

Der Chat weiß nichts über die geöffnete Reise. Frage ich „was haben wir
am Montag vor" oder „passt das Café noch in den Nachmittag", kann er nur
sagen, dass er den Plan nicht kennt — so steht es auch in seinem
Systemtext.

Damit ist er ein allgemeiner Gesprächspartner, der zufällig im Planer
wohnt. Nützlich wird er erst, wenn er über **diese** Reise reden kann.

Das war der Zuschnitt von req-081 („Keine Werkzeuge, kein Zugriff auf
Reisedaten"), und req-092 hat davon die erste Hälfte aufgehoben: Er darf
im Web suchen. Dieses Requirement hebt die zweite auf — aber nur
**lesend**.

Dass der Unterschied zählt, hat sich schon gezeigt: Auf die Frage nach
Cafés nannte der Chat zwei mit Bewertungen, ohne die POIs der Reise zu
kennen. Er kann nicht sagen, ob einer davon schon in der Sammlung liegt
oder gar eingeplant ist.

# Function (What)

Der Chat bekommt **vier lesende Werkzeuge**. Keines ändert etwas; alle
beantworten nur Fragen.

| Werkzeug | Was es liefert |
|---|---|
| `reise_lesen` | Titel, Zeitraum, Hauptort, Zustand, Teilnehmerzahl |
| `pois_lesen` | die POI-Sammlung der Reise |
| `tagesplan_lesen` | die Programmpunkte eines Reisetags, in zeitlicher Folge |
| `kosten_lesen` | die Kostenaufstellung der Reise |

Die Kosten kommen mit, weil „was kostet der Tag" eine der drei Fragen
ist, die req-081 als Beispiel nennt — und weil sie lesend und gefahrlos
ist.

## Was ein Werkzeug sehen darf

**Nur die geöffnete Reise.** Der Chat läuft je Reise
(`/api/chat?tripId=…`), und die Werkzeuge bekommen diese Kennung vom
Server — **nicht** vom Modell. Das Modell kann keine andere Reise
nennen, auch nicht die eines anderen Accounts.

Das ist die eiserne Regel: Der Mandant kommt aus der Anmeldung, nie aus
der Anfrage (req-024). Bei einem Werkzeug ist die „Anfrage" das, was das
Modell sagt — und ein Modell lässt sich durch den Text einer Webseite
beeinflussen, die es gerade gelesen hat (req-092). Eine Kennung von ihm
anzunehmen, wäre deshalb eine Lücke.

## Was ein Werkzeug nicht zurückgibt

Die Werkzeuge geben **nicht** zurück, was die Datenbank hergibt, sondern
das, was eine Antwort braucht:

- **Keine Langtexte.** Ein POI-Langtext kann sehr lang sein; zwanzig
  davon sprengen jedes Kontextfenster und kosten bei jeder Frage erneut.
  Der Kurztext genügt.
- **Keine Kennungen** (UUIDs), außer wo das Modell sie zum Nachfragen
  braucht. Sie sind für ein Gespräch wertlos und verbrauchen Platz.
- **Keine Fotos**, keine Bildpfade.
- **Keine personenbezogenen Angaben** der Teilnehmer: keine Namen, keine
  E-Mail-Adressen, keine Positionen. `reise_lesen` nennt die **Anzahl**
  der Teilnehmer, nicht wer sie sind.
- **Keine Zugangsschlüssel**, keine Bankverbindung, keine Dokumente.

## Wie viele Aufrufe

Die Zahl der Werkzeugaufrufe je Antwort ist **begrenzt**, wie bei der
Web-Suche (`WEB_SUCHE_MAX_USES`). Ein Modell, das sich verrennt, soll
nicht zwanzig Tage einzeln abfragen.

Die Grenze steht als benannter Wert an einer Stelle.

## Was der Nutzer sieht

**Dass der Chat in den Plan gesehen hat, muss sichtbar sein** — wie bei
der Web-Suche. Im Verlauf steht, welche Auskunft er geholt hat („sieht in
den Tagesplan …"), damit eine Antwort nachvollziehbar bleibt und sich von
einer geratenen unterscheidet.

Die Quellenzeile der Web-Suche bleibt, wie sie ist. Ein Blick in den
eigenen Plan ist keine Quelle im Netz und gehört nicht zwischen die
Adressen.

## Der Systemtext

Heute sagt er: „Du kennst die geöffnete Reise nicht und kannst in der App
nichts ändern." Der erste Teil wird falsch und muss weichen. Der
**zweite bleibt** — und zwar ausdrücklich: Der Chat kann lesen, aber
nichts ändern. Wird er gebeten, etwas zu verschieben oder anzulegen, sagt
er das offen, statt es zu versprechen.

## Wenn ein Werkzeug scheitert

Schlägt ein Aufruf fehl, **bleibt die Antwort stehen** und der Grund
steht dabei — dasselbe Muster wie bei der gescheiterten Web-Suche
(req-092) und bei `refusal` und `max_tokens`.

# GUI

- Die Meldung über einen Werkzeugaufruf erscheint im Verlauf
  (`app/plan/components/chat-fenster.tsx`), am Eintrag der Antwort — in
  derselben Art wie „sucht im Web …" aus req-092.
- Es kommt kein neues Gestaltungsmittel hinzu und kein Bedienelement:
  Der Nutzer löst keine Werkzeuge aus, er sieht nur, dass sie liefen.
- Bei 375, 768 und 1280 px gelten die vier Regeln aus `stack.md`.
- Kontrast nach `lib/design/kontrast.ts`.

# Acceptance Criteria

- [ ] Gegeben die Reise hat am Montag drei Programmpunkte, wenn ich
      frage „was haben wir am Montag vor", dann nennt die Antwort diese
      drei in zeitlicher Folge.
- [ ] Gegeben die Sammlung enthält einen POI „Café Uhl", wenn ich frage
      „haben wir schon ein Café", dann nennt die Antwort ihn.
- [ ] Gegeben ich frage nach dem Plan, wenn die Antwort kommt, dann steht
      im Verlauf, dass der Chat in den Plan gesehen hat.
- [ ] Gegeben ich frage etwas, das keinen Plan braucht („was ist ein
      Transfer"), wenn die Antwort kommt, dann wurde kein Werkzeug
      aufgerufen.
- [ ] Gegeben ich frage nach den Kosten des Montags, wenn die Antwort
      kommt, dann beruht sie auf der Kostenaufstellung der Reise.
- [ ] Gegeben ich bitte den Chat, das Abendessen zu verschieben, wenn die
      Antwort kommt, dann sagt er, dass er nichts ändern kann — und
      ändert nichts.
- [ ] Gegeben ein Werkzeugaufruf scheitert, wenn ich den Verlauf ansehe,
      dann steht der Text, der bis dahin kam, UND der Grund dabei.
- [ ] Gegeben das Modell würde mehr Werkzeuge aufrufen als erlaubt, wenn
      die Antwort kommt, dann wurde die Grenze eingehalten.
- [ ] Gegeben mein Account hat zwei Reisen, wenn ich im Chat der einen
      nach Programmpunkten frage, dann enthält die Antwort nur die dieser
      Reise.
- [ ] Gegeben das Modell nennt in einem Werkzeugaufruf eine fremde
      Reisekennung, wenn der Aufruf ausgeführt wird, dann wird sie
      ignoriert und die geöffnete Reise verwendet.
- [ ] Gegeben ein POI hat einen langen Langtext, wenn der Chat die
      Sammlung liest, dann ist dieser Langtext NICHT Teil des
      Werkzeugergebnisses.
- [ ] Gegeben die Reise hat Teilnehmer, wenn der Chat die Reise liest,
      dann erfährt er deren Anzahl, aber keine Namen und keine
      E-Mail-Adressen.
- [ ] Gegeben die Web-Suche aus req-092, wenn ich eine Frage stelle, die
      beides braucht, dann kann der Chat suchen UND in den Plan sehen.

# Constraints

- **Nur lesend.** Kein Werkzeug schreibt, löscht oder verschiebt. Das ist
  nicht nur Zuschnitt, sondern Sicherheit: Ein Modell, das Webseiten
  liest (req-092), darf von dort keine Handlung in die Reise tragen.
- Die Reisekennung kommt **ausschließlich** vom Server, aus derselben
  Quelle wie heute (`/api/chat?tripId=…`, geprüft mit
  `tripBelongsToAccount`). Ein vom Modell genannter Wert wird nie
  verwendet — auch nicht geprüft und dann verwendet.
- Die Werkzeuge nutzen die vorhandenen Lesefunktionen
  (`listPois`, `listActivities`, `listTransfers`, `lib/plan/tagesplan.ts`).
  Es entsteht keine zweite Abfrage neben ihnen.
- Diese Lesefunktionen liefern heute **den ganzen Account** und werden
  erst beim Aufrufer je Reise gefiltert. Für die Werkzeuge muss die
  Einschränkung auf die Reise **in der Abfrage** liegen, nicht danach —
  sonst hängt die Trennung an einer Zeile im Aufrufer.
- Was ein Werkzeug zurückgibt, wird **ausdrücklich zusammengestellt**,
  Feld für Feld. Kein `JSON.stringify` einer Datenbankzeile: Sonst wandert
  beim nächsten neuen Feld ungefragt etwas ins Modell.
- Die Werkzeugnamen und ihre Beschreibungen stehen an **einer** Stelle,
  bei der Web-Suche (`WEB_SUCHE_WERKZEUG` in `lib/ai/anthropic-client.ts`).
- `MAX_TOKENS` zählt Werkzeugergebnisse mit, wie schon Nachdenken und
  Suchergebnisse (bug-061). Die Meldung „abgeschnitten" muss weiter
  greifen.
- Die Prüfung `gab === 0` darf eine Antwort, die mit einem Werkzeugaufruf
  beginnt, nicht als leer verwerfen (bug-032, req-092).
- Der Verlauf bleibt lesbar: Werkzeugaufrufe und ihre Ergebnisse werden
  **nicht** als Nachrichten gespeichert. Gespeichert wird, was gefragt und
  was geantwortet wurde.

# Out of Scope

- **Schreibende Werkzeuge.** POIs anlegen, Programmpunkte verschieben,
  Kosten ändern, Tage planen — das ist der nächste Schritt und braucht
  eine eigene Überlegung zur Bestätigung durch den Nutzer.
- Dokumente, Teilnehmernamen, Positionen, Bewertungsrunden und Stimmen
  lesen.
- Den Chat im Begleiter. Er ist für den Planer gedacht (req-081).
- Reiseübergreifend lesen („vergleiche mit meiner letzten Reise").
- Die POI-Sammlung durchsuchen lassen, die nicht zur Reise gehört.
- Den gedruckten Reiseplan (req-080) aus dem Chat erzeugen.
- Das Agent SDK einführen. Ob die Werkzeugschleife von Hand läuft
  (`stop_reason: "tool_use"`) oder über den `toolRunner` des SDK, ist
  eine Frage der Umsetzung, nicht dieses Requirements.
