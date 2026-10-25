---
id: req-084
title: Verzug auch auf dem Weg zum nächsten Programmpunkt
app: wegfara
area: Reise
priority: hoch
created: 2026-10-25
---

# Goal (Why)

Als Teilnehmer will ich während einer langen Fahrt wissen, ob ich den
nächsten Programmpunkt noch rechtzeitig erreiche. Heute schweigt der
Live-Status genau dann, wenn die Frage dringend ist: Zwischen zwei
Programmpunkten verschwindet die Status-Pille, und bei einem Transfer von
drei Stunden sehe ich drei Stunden lang keine Aussage.

Das ist die Zeit, in der sich ein Verzug noch abwenden lässt — durch eine
kürzere Pause, einen gestrichenen Zwischenstopp, einen Anruf beim
Restaurant. Steht die Gruppe erst am Ort, ist die Verspätung Tatsache.

Aufgefallen auf der Reise „30 Johr zämma" am 25.10.2026: vor einem langen
Transfer war nicht erkennbar, ob die Ankunft im Plan liegt.

# Function (What)

Der Live-Status (req-051) zeigt den Verzug künftig **auch**, wenn gerade
kein Programmpunkt läuft, sondern der nächste erst ansteht.

Die Frage ist dabei eine andere, und die Rechnung auch:

- **Läuft ein Programmpunkt** (wie bisher): Wie weit bin ich vom Ort
  entfernt, an dem ich jetzt sein müsste? Maßstab ist die reine Fahrzeit.
- **Steht der nächste an** (neu): Reicht die Zeit bis zu seiner Startzeit
  für die Fahrt dorthin? Maßstab ist die Fahrzeit **gegen die verbleibende
  Zeit**.

Beispiel: Der nächste Programmpunkt beginnt um 13:30, es ist 10:30, die
Fahrzeit beträgt 150 Minuten. Verbleibend sind 180 Minuten — also
30 Minuten Luft. Bei einer Fahrzeit von 200 Minuten wären es 20 Minuten
zu spät.

Die Anzeige unterscheidet die beiden Fälle, denn „Im Zeitplan" heißt
beim laufenden Punkt „ich bin da" und beim anstehenden „ich komme hin":

| Lage | Pille |
|---|---|
| Fahrzeit passt mit Luft | „Ankunft im Plan" |
| Fahrzeit überschreitet die Startzeit | „N Min zu spät" |

Die Schwelle ist dieselbe wie bisher: Weniger als 5 Minuten Überschreitung
gelten als im Plan (`IM_ZEITPLAN_UNTER_MIN`). Ein Puffer von wenigen
Minuten ist innerhalb der Genauigkeit, die eine Fahrzeitschätzung hat.

Unverändert bleibt:

- Ohne geteilte Position gibt es keinen Verzug (req-050).
- Hat der nächste Programmpunkt keinen Ort hinterlegt, gibt es keinen
  Verzug — ohne Ziel keine Fahrzeit.
- Ist heute nichts mehr geplant, gibt es keinen nächsten Punkt und damit
  keinen Verzug.
- Antwortet der Routing-Dienst nicht, erscheint der Hinweis, dass sich der
  Verzug gerade nicht ermitteln lässt (siehe bug-067).

Ein **Transfer** bleibt dabei, was er ist: die Verbindung zwischen zwei
Programmpunkten, ohne eigene Start- und Endzeit. Er wird nicht zu einem
Programmpunkt gemacht und taucht im Live-Status nicht als Zeile auf. Die
Fahrzeit kommt weiterhin aus der aktuellen Position, nicht aus
`durationMin` des Transfers — unterwegs zählt, wo ich wirklich bin.

# GUI

- Mockup: `delivery/design/design 1.0/Reise Companion.dc.html`,
  Abschnitt Live-Status
- Bindend: eng folgen. Die Pille behält Form, Platz und Farben aus
  req-051 — „good" bei Ankunft im Plan, „warn" bei Verspätung. Es kommt
  kein neues Element hinzu; nur der Fall, in dem die Pille erscheint, und
  ihre Beschriftung ändern sich.

# Acceptance Criteria

- [x] Gegeben es ist 10:30, der nächste Programmpunkt beginnt um 13:30,
      ich teile meine Position und die Fahrzeit dorthin beträgt
      150 Minuten, wenn ich den Live-Status ansehe, dann zeigt die
      Status-Pille „Ankunft im Plan".
- [x] Gegeben es ist 10:30, der nächste Programmpunkt beginnt um 13:30
      und die Fahrzeit beträgt 200 Minuten, wenn ich den Live-Status
      ansehe, dann zeigt die Status-Pille „20 Min zu spät".
- [x] Gegeben die Fahrzeit überschreitet die Startzeit um 3 Minuten, wenn
      ich den Live-Status ansehe, dann zeigt die Status-Pille „Ankunft im
      Plan" — eine Überschreitung unter 5 Minuten gilt als im Plan.
- [x] Gegeben die Fahrzeit überschreitet die Startzeit um genau
      5 Minuten, wenn ich den Live-Status ansehe, dann zeigt die
      Status-Pille „5 Min zu spät".
- [x] Gegeben unter „Laut Plan" steht der nächste Programmpunkt mit „ab
      13:30", wenn ich den Live-Status ansehe, dann steht diese Uhrzeit
      weiterhin dort UND daneben die Status-Pille.
- [x] Gegeben ein Programmpunkt läuft gerade und ich bin 25 Fahrminuten
      entfernt, wenn ich den Live-Status ansehe, dann zeigt die Pille
      „25 Min zu spät" — die bisherige Rechnung beim laufenden Punkt
      bleibt unverändert.
- [x] Gegeben ein Programmpunkt läuft gerade und ich bin am Ort, wenn ich
      den Live-Status ansehe, dann zeigt die Pille „Im Zeitplan" — nicht
      „Ankunft im Plan".
- [x] Gegeben der nächste Programmpunkt hat keinen Ort hinterlegt, wenn
      ich den Live-Status ansehe, dann wird KEIN Verzug angezeigt.
- [x] Gegeben ich teile meine Position nicht und der Reiseleiter auch
      nicht, wenn der nächste Programmpunkt ansteht, dann wird KEIN
      Verzug angezeigt.
- [x] Gegeben heute ist nichts mehr geplant, wenn ich den Live-Status
      ansehe, dann steht dort „Nichts mehr für heute geplant" und KEIN
      Verzug.
- [x] Gegeben der Routing-Dienst antwortet nicht, wenn der nächste
      Programmpunkt ansteht, dann erscheint an Stelle der Pille der
      Hinweis, dass sich der Verzug gerade nicht ermitteln lässt.
- [x] Gegeben zwischen mir und dem nächsten Programmpunkt liegt ein
      Transfer, wenn ich den Live-Status ansehe, dann erscheint der
      Transfer dort NICHT als eigene Zeile.

# Constraints

- Die Fahrzeit kommt weiterhin von OSRM hinter der austauschbaren
  Schnittstelle aus req-051 (`lib/routing/client.ts`). Es kommt kein
  zweiter Dienst dazu.
- Die Abfrage wird nicht häufiger als bisher gestellt
  (`LAGE_INTERVALL_MS`, eine Minute). Der Dienst ist fremd und
  unentgeltlich; ihn wegen einer feineren Anzeige öfter zu fragen, wäre
  nicht angemessen.
- Die beiden Rechnungen gehören in `lib/live-status/verzug.ts`, nicht in
  die Komponente. Die Entscheidung, welche Beschriftung erscheint, ist
  Fachlogik und gehört unter Tests.
- `Verzug` ist heute ein Typ mit vier Fällen (`lib/live-status/types.ts`).
  Dass „Im Zeitplan" nun zwei Bedeutungen hat, muss am Typ ablesbar sein
  — nicht an einem Wahrheitswert, der nebenher mitgeführt wird.

# Out of Scope

- Vorschläge, was bei Verzug zu tun ist („Museum streichen") — eigenes
  Requirement, schon in req-051 ausgeklammert.
- Verkehrslage in die Fahrzeit einrechnen.
- Den Verzug in den Plan zurückschreiben oder Programmpunkte verschieben.
- Benachrichtigung, wenn ein Verzug entsteht — hier geht es allein um die
  Anzeige, solange der Begleiter offen ist.
- Den Verzug im Planer anzeigen. Der Live-Status ist der Begleiter.
- Mehrere Programmpunkte vorausrechnen („der ganze Tag verschiebt sich").
